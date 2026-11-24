import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// No "server-only" import here: scripts/seed.ts imports this file directly.

/** What the store sells. Prices are in the currency's smallest unit (cents for usd). */
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(),
  // Stock goes down only when Stripe confirms payment (lib/orders.ts markPaid).
  stock: integer("stock").notNull(),
  // A path under public/, such as /products/tote.svg.
  image: text("image").notNull(),
  // Inactive products leave the shop but stay on past orders.
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("products_slug_idx").on(table.slug),
  check("products_price_positive", sql`${table.priceCents} > 0`),
  check("products_stock_not_negative", sql`${table.stock} >= 0`),
]);

/** A shopper's cart, identified by the cart cookie. Anyone can have one, signed in or not. */
export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cartItems = pgTable("cart_items", {
  cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
}, (table) => [
  primaryKey({ columns: [table.cartId, table.productId] }),
  check("cart_items_quantity_positive", sql`${table.quantity} > 0`),
]);

export const ORDER_STATUSES = ["pending", "paid", "fulfilled", "expired"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * One checkout. Created `pending` when the shopper leaves for Stripe, with the prices
 * they saw; `paid` only when Stripe's webhook says the money arrived; `fulfilled` when
 * an agent ships it through the API; `expired` when Stripe closes an unpaid checkout.
 */
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: text("status").$type<OrderStatus>().default("pending").notNull(),
  cartId: uuid("cart_id").notNull(),
  checkoutSessionId: text("checkout_session_id"),
  // The User accounts id when the shopper was signed in; null for a guest checkout.
  customerId: text("customer_id"),
  email: text("email"),
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull(),
  // Stripe's collected shipping name and address, set when the order is paid.
  shipping: jsonb("shipping"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("orders_checkout_session_id_idx").on(table.checkoutSessionId),
  index("orders_customer_id_created_at_idx").on(table.customerId, table.createdAt),
  index("orders_status_created_at_idx").on(table.status, table.createdAt),
  check("orders_status_known", sql`${table.status} in ('pending', 'paid', 'fulfilled', 'expired')`),
]);

/** What an order contained, with the name and price at checkout, so later edits never rewrite history. */
export const orderItems = pgTable("order_items", {
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  unitCents: integer("unit_cents").notNull(),
  quantity: integer("quantity").notNull(),
}, (table) => [
  primaryKey({ columns: [table.orderId, table.productId] }),
  check("order_items_quantity_positive", sql`${table.quantity} > 0`),
]);
