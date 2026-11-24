import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { type OrderStatus, ORDER_STATUSES, cartItems, carts, orderItems, orders, products } from "@/db/schema";
import { CURRENCY, MAX_PER_PRODUCT } from "@/lib/store";

// The store's rules live here, shared by pages, server actions, the webhook, the
// /api routes and the seed script. One schema per input validates the API and
// generates its OpenAPI document, so they cannot drift.

/** A problem the caller can fix. Pages show its message; the API returns it as `error`. */
export class UserError extends Error {}
/** Invalid input; the API answers it with 400. */
export class InvalidInput extends UserError {}
/** The request conflicts with the current state, such as fulfilling an unpaid order; 409. */
export class Conflict extends UserError {}

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new InvalidInput(result.error.issues[0]?.message ?? "Invalid input.");
  return result.data;
}

const text = (label: string, max: number) =>
  z.string({ error: `${label} is required.` }).trim()
    .min(1, { error: `${label} is required.` })
    .max(max, { error: `${label} must be at most ${max} characters.` });
const wholeNumber = (label: string, min: number) =>
  z.number({ error: `${label} must be a whole number.` })
    .int({ error: `${label} must be a whole number.` })
    .min(min, { error: `${label} must be at least ${min}.` })
    .max(10_000_000, { error: `${label} is too large.` });

export const ProductInput = z.object({
  slug: z.string({ error: "Slug is required." }).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    error: "Slug must be lowercase letters, digits and single hyphens, like canvas-tote.",
  }).max(80).meta({ description: "The product's URL: /products/<slug>. Unique." }),
  name: text("Name", 120),
  description: text("Description", 2000),
  priceCents: wholeNumber("Price", 50).meta({ description: `Price in the smallest unit of ${CURRENCY}, for example 2400 for $24.00. Stripe's minimum is 50.` }),
  stock: wholeNumber("Stock", 0).meta({ description: "Units available to sell." }),
  image: z.string({ error: "Image is required." }).regex(/^\/[\w./-]+$/, { error: "Image must be a path under public/, like /products/tote.svg." })
    .meta({ description: "A path to a file in the app's public/ folder." }),
});

export const ProductPatch = ProductInput.omit({ slug: true }).partial().extend({
  active: z.boolean({ error: "active must be true or false." }).optional()
    .meta({ description: "false takes the product out of the shop; past orders keep it." }),
}).refine((patch) => Object.keys(patch).length > 0, { error: "Send at least one field to change." });

export const ListOrdersQuery = z.object({
  status: z.enum(ORDER_STATUSES, { error: `status must be one of ${ORDER_STATUSES.join(", ")}.` }).optional()
    .meta({ description: "Only orders in this status. Omit for paid and fulfilled orders." }),
});

export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderWithItems = Order & { items: OrderItem[] };
export type CartLine = { product: Product; quantity: number };

export async function listProducts(options: { includeInactive?: boolean } = {}): Promise<Product[]> {
  return getDb().select().from(products)
    .where(options.includeInactive ? undefined : eq(products.active, true))
    .orderBy(asc(products.name));
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const [product] = await getDb().select().from(products)
    .where(and(eq(products.slug, slug), eq(products.active, true)));
  return product;
}

export async function createProduct(input: z.output<typeof ProductInput>): Promise<Product> {
  const [product] = await getDb().insert(products).values(input).onConflictDoNothing().returning();
  if (!product) throw new Conflict(`A product with slug ${input.slug} already exists.`);
  return product;
}

export async function updateProduct(id: string, patch: z.output<typeof ProductPatch>): Promise<Product | undefined> {
  const [product] = await getDb().update(products).set({ ...patch, updatedAt: new Date() })
    .where(eq(products.id, id)).returning();
  return product;
}

export async function createCart(): Promise<string> {
  const [cart] = await getDb().insert(carts).values({}).returning({ id: carts.id });
  return cart.id;
}

export async function cartLines(cartId: string): Promise<CartLine[]> {
  const rows = await getDb().select({ product: products, quantity: cartItems.quantity })
    .from(cartItems).innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cartId)).orderBy(asc(products.name));
  return rows;
}

/** Sets how many of a product the cart holds; 0 removes it. Capped at stock and MAX_PER_PRODUCT. */
export async function setCartQuantity(cartId: string, productId: string, quantity: number): Promise<void> {
  const db = getDb();
  if (quantity <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
    return;
  }
  const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.active, true)));
  if (!product) throw new UserError("That product is no longer for sale.");
  const capped = Math.min(quantity, MAX_PER_PRODUCT, product.stock);
  if (capped === 0) throw new UserError(`${product.name} is out of stock.`);
  await db.insert(cartItems).values({ cartId, productId, quantity: capped })
    .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.productId], set: { quantity: capped } });
}

/**
 * Freezes the cart into a pending order at today's prices, refusing anything inactive
 * or short on stock. Stock is not held: it goes down when the order is paid.
 */
export async function createPendingOrder(cartId: string, customer: { id: string; email: string } | null): Promise<OrderWithItems> {
  return getDb().transaction(async (tx) => {
    const lines = await tx.select({ product: products, quantity: cartItems.quantity })
      .from(cartItems).innerJoin(products, eq(products.id, cartItems.productId))
      .where(eq(cartItems.cartId, cartId));
    if (lines.length === 0) throw new UserError("Your cart is empty.");
    for (const { product, quantity } of lines) {
      if (!product.active) throw new UserError(`${product.name} is no longer for sale. Remove it to check out.`);
      if (product.stock < quantity) {
        throw new UserError(`Only ${product.stock} of ${product.name} left. Lower the quantity to check out.`);
      }
    }
    const [order] = await tx.insert(orders).values({
      cartId,
      customerId: customer?.id ?? null,
      email: customer?.email ?? null,
      totalCents: lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0),
      currency: CURRENCY,
    }).returning();
    const items = await tx.insert(orderItems).values(lines.map(({ product, quantity }) => ({
      orderId: order.id,
      productId: product.id,
      name: product.name,
      unitCents: product.priceCents,
      quantity,
    }))).returning();
    return { ...order, items };
  });
}

export async function attachCheckoutSession(orderId: string, checkoutSessionId: string): Promise<void> {
  await getDb().update(orders).set({ checkoutSessionId }).where(eq(orders.id, orderId));
}

/**
 * Records that Stripe has the money: pending to paid, stock down by what was bought,
 * and the shopper's cart emptied, in one transaction. Only a pending order moves, so
 * a retried webhook or a second paid event changes nothing and returns false.
 */
export async function markPaid(payment: {
  orderId: string;
  checkoutSessionId: string;
  email: string | null;
  shipping: unknown;
}): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [order] = await tx.update(orders).set({
      status: "paid",
      checkoutSessionId: payment.checkoutSessionId,
      email: sql`coalesce(${payment.email}, ${orders.email})`,
      shipping: payment.shipping,
      paidAt: new Date(),
    }).where(and(eq(orders.id, payment.orderId), eq(orders.status, "pending"))).returning();
    if (!order) return false;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      // Stock was checked at checkout but not held, so two shoppers can pay for the
      // last unit. The payment already happened: record the order and stop at zero.
      await tx.update(products).set({ stock: sql`greatest(${products.stock} - ${item.quantity}, 0)`, updatedAt: new Date() })
        .where(eq(products.id, item.productId));
    }
    await tx.delete(cartItems).where(eq(cartItems.cartId, order.cartId));
    return true;
  });
}

/** Stripe closed the checkout without payment. Only a pending order expires. */
export async function markExpired(orderId: string): Promise<boolean> {
  const rows = await getDb().update(orders).set({ status: "expired" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending"))).returning({ id: orders.id });
  return rows.length > 0;
}

async function withItems(rows: Order[]): Promise<OrderWithItems[]> {
  if (rows.length === 0) return [];
  const items = await getDb().select().from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((order) => order.id))).orderBy(asc(orderItems.name));
  return rows.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id) }));
}

const PAID_OR_LATER: OrderStatus[] = ["paid", "fulfilled"];

export async function listOrders(status?: OrderStatus, limit = 100): Promise<OrderWithItems[]> {
  const rows = await getDb().select().from(orders)
    .where(status ? eq(orders.status, status) : inArray(orders.status, PAID_OR_LATER))
    .orderBy(desc(orders.createdAt)).limit(limit);
  return withItems(rows);
}

export async function getOrder(id: string): Promise<OrderWithItems | undefined> {
  const [order] = await withItems(await getDb().select().from(orders).where(eq(orders.id, id)));
  return order;
}

/** A signed-in customer's paid and fulfilled orders, newest first. */
export async function customerOrders(customerId: string): Promise<OrderWithItems[]> {
  const rows = await getDb().select().from(orders)
    .where(and(eq(orders.customerId, customerId), inArray(orders.status, PAID_OR_LATER)))
    .orderBy(desc(orders.createdAt)).limit(100);
  return withItems(rows);
}

/** Marks a paid order shipped. Refuses one that is not paid; fulfilling twice is a conflict. */
export async function fulfillOrder(id: string): Promise<OrderWithItems | undefined> {
  const [updated] = await getDb().update(orders).set({ status: "fulfilled", fulfilledAt: new Date() })
    .where(and(eq(orders.id, id), eq(orders.status, "paid"))).returning();
  if (updated) return getOrder(id);
  const existing = await getOrder(id);
  if (existing) throw new Conflict(`Order is ${existing.status}; only a paid order can be fulfilled.`);
  return undefined;
}

/** The Stripe Checkout line items for an order, at the prices frozen on it. */
export function checkoutLineItems(order: OrderWithItems) {
  return order.items.map((item) => ({
    quantity: item.quantity,
    price_data: { currency: order.currency, unit_amount: item.unitCents, product_data: { name: item.name } },
  }));
}
