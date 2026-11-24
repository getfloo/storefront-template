import { z } from "zod";
import { ORDER_STATUSES } from "@/db/schema";
import { ListOrdersQuery, type OrderWithItems } from "@/lib/orders";
import { ApiError, type Operation } from "@/lib/openapi";

export const OrderJson = z.object({
  id: z.uuid(),
  status: z.enum(ORDER_STATUSES).meta({ description: "pending until Stripe confirms payment; paid orders are ready to ship." }),
  email: z.string().nullable(),
  customerId: z.string().nullable().meta({ description: "The shopper's account id, or null for a guest checkout." }),
  totalCents: z.int(),
  currency: z.string(),
  shipping: z.unknown().meta({ description: "Stripe's shipping details: name and address. Null until paid." }),
  checkoutSessionId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  fulfilledAt: z.iso.datetime().nullable(),
  items: z.array(z.object({
    productId: z.uuid(),
    name: z.string(),
    unitCents: z.int(),
    quantity: z.int(),
  })),
});

// The cart id stays server-side: it is the shopper's cookie value.
export const orderJson = (order: OrderWithItems) => ({
  id: order.id,
  status: order.status,
  email: order.email,
  customerId: order.customerId,
  totalCents: order.totalCents,
  currency: order.currency,
  shipping: order.shipping,
  checkoutSessionId: order.checkoutSessionId,
  createdAt: order.createdAt,
  paidAt: order.paidAt,
  fulfilledAt: order.fulfilledAt,
  items: order.items.map(({ productId, name, unitCents, quantity }) => ({ productId, name, unitCents, quantity })),
});

const OrderPath = z.object({ id: z.uuid().meta({ description: "The order's id, from listOrders." }) });
const notFound = { description: "No order has this id.", schema: ApiError };

// The contract for ./route.ts, ./[id]/route.ts and ./[id]/fulfill/route.ts.
export const operations: Operation[] = [
  {
    method: "get",
    path: "/api/orders",
    operationId: "listOrders",
    summary: "List the 100 newest orders. Defaults to paid and fulfilled; pass status=paid for orders to ship.",
    query: ListOrdersQuery,
    responses: {
      200: { description: "The matching orders, newest first.", schema: z.object({ orders: z.array(OrderJson) }) },
      400: { description: "A query parameter is invalid.", schema: ApiError },
    },
  },
  {
    method: "get",
    path: "/api/orders/{id}",
    operationId: "getOrder",
    summary: "Get one order with its items and shipping address.",
    params: OrderPath,
    responses: { 200: { description: "The order.", schema: z.object({ order: OrderJson }) }, 404: notFound },
  },
  {
    method: "post",
    path: "/api/orders/{id}/fulfill",
    operationId: "fulfillOrder",
    summary: "Mark a paid order shipped.",
    params: OrderPath,
    responses: {
      200: { description: "The fulfilled order.", schema: z.object({ order: OrderJson }) },
      404: notFound,
      409: { description: "The order is not paid, or is already fulfilled.", schema: ApiError },
    },
  },
];
