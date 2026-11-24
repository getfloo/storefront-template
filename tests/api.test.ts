import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: () => { throw new Error("tests never open a database"); } }));
vi.mock("@/lib/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/orders")>()),
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  listOrders: vi.fn(),
  getOrder: vi.fn(),
  fulfillOrder: vi.fn(),
}));

import { POST as fulfillRoute } from "../app/api/orders/[id]/fulfill/route";
import { GET as getOrderRoute } from "../app/api/orders/[id]/route";
import { operations as orderOperations } from "../app/api/orders/openapi";
import { GET as listOrdersRoute } from "../app/api/orders/route";
import { PATCH as patchProductRoute } from "../app/api/products/[id]/route";
import { operations as productOperations } from "../app/api/products/openapi";
import { GET as listProductsRoute, POST as createProductRoute } from "../app/api/products/route";
import { Conflict, createProduct, fulfillOrder, getOrder, listOrders, listProducts, updateProduct } from "../lib/orders";

const keyHeaders = {
  "X-Floo-Auth-Method": "api_key",
  "X-Floo-Api-Consumer-Id": "consumer-9",
  "X-Floo-Api-Key-Id": "key-42",
  "X-Floo-Api-Key-Scopes": "api",
};

const productId = "0b8f3c2e-6a1d-4f5b-9c7e-2d4a6b8c0e1f";
const orderId = "8d2f0c9e-1b3a-4c5d-9e7f-6a5b4c3d2e1f";
const product = {
  id: productId, slug: "canvas-tote", name: "Canvas tote", description: "Heavy canvas.", priceCents: 2400,
  stock: 40, image: "/products/canvas-tote.svg", active: true,
  createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"),
};
const order = {
  id: orderId, status: "paid" as const, cartId: "5d1c8f7a-3b2e-4c6d-9a8b-7e6f5d4c3b2a", checkoutSessionId: "cs_test_1",
  customerId: null, email: "sam@example.com", totalCents: 4800, currency: "usd",
  shipping: { name: "Sam" }, createdAt: new Date("2026-01-03T00:00:00Z"), paidAt: new Date("2026-01-03T00:01:00Z"), fulfilledAt: null,
  items: [{ orderId, productId, name: "Canvas tote", unitCents: 2400, quantity: 2 }],
};

const operations = [...productOperations, ...orderOperations];

// Every response a handler gives must match what the OpenAPI document declares.
async function expectDocumented(method: string, path: string, response: Response): Promise<unknown> {
  const declared = operations.find((operation) => operation.method === method && operation.path === path)?.responses[response.status];
  expect(declared?.schema, `${method.toUpperCase()} ${path} ${response.status} is not documented`).toBeDefined();
  const body: unknown = await response.json();
  declared?.schema?.parse(body);
  return body;
}

const request = (path: string, init: RequestInit = {}) => new Request(`http://app${path}`, { ...init, headers: keyHeaders });
const context = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("products", () => {
  it("lists every product, inactive ones included", async () => {
    vi.mocked(listProducts).mockResolvedValue([product]);
    const response = await listProductsRoute(request("/api/products"));
    expect(await expectDocumented("get", "/api/products", response)).toMatchObject({ products: [{ slug: "canvas-tote" }] });
    expect(listProducts).toHaveBeenCalledWith({ includeInactive: true });
  });

  it("creates a product", async () => {
    vi.mocked(createProduct).mockResolvedValue(product);
    const body = { slug: "canvas-tote", name: "Canvas tote", description: "Heavy canvas.", priceCents: 2400, stock: 40, image: "/products/canvas-tote.svg" };
    const response = await createProductRoute(request("/api/products", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(201);
    await expectDocumented("post", "/api/products", response);
    expect(createProduct).toHaveBeenCalledWith(body);
  });

  it.each([
    ["not JSON", "nope"],
    ["a price below Stripe's minimum", JSON.stringify({ slug: "a", name: "A", description: "A", priceCents: 10, stock: 1, image: "/a.svg" })],
    ["a slug with spaces", JSON.stringify({ slug: "a b", name: "A", description: "A", priceCents: 100, stock: 1, image: "/a.svg" })],
  ])("answers %s with 400", async (_label, body) => {
    const response = await createProductRoute(request("/api/products", { method: "POST", body }));
    expect(response.status).toBe(400);
    await expectDocumented("post", "/api/products", response);
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("answers a taken slug with 409", async () => {
    vi.mocked(createProduct).mockRejectedValue(new Conflict("A product with slug canvas-tote already exists."));
    const body = { slug: "canvas-tote", name: "Canvas tote", description: "Heavy canvas.", priceCents: 2400, stock: 40, image: "/products/canvas-tote.svg" };
    const response = await createProductRoute(request("/api/products", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(409);
    await expectDocumented("post", "/api/products", response);
  });

  it("changes only the fields sent", async () => {
    vi.mocked(updateProduct).mockResolvedValue({ ...product, stock: 5 });
    const response = await patchProductRoute(request(`/api/products/${productId}`, { method: "PATCH", body: '{"stock": 5}' }), context(productId));
    expect(await expectDocumented("patch", "/api/products/{id}", response)).toMatchObject({ product: { stock: 5 } });
    expect(updateProduct).toHaveBeenCalledWith(productId, { stock: 5 });
  });

  it("answers an empty change with 400 and an unknown product with 404", async () => {
    const empty = await patchProductRoute(request(`/api/products/${productId}`, { method: "PATCH", body: "{}" }), context(productId));
    expect(empty.status).toBe(400);
    vi.mocked(updateProduct).mockResolvedValue(undefined);
    const missing = await patchProductRoute(request(`/api/products/${productId}`, { method: "PATCH", body: '{"active": false}' }), context(productId));
    expect(missing.status).toBe(404);
    await expectDocumented("patch", "/api/products/{id}", missing);
  });
});

describe("orders", () => {
  it("lists paid and fulfilled orders by default, without the shopper's cart id", async () => {
    vi.mocked(listOrders).mockResolvedValue([order]);
    const response = await listOrdersRoute(request("/api/orders"));
    const body = await expectDocumented("get", "/api/orders", response) as { orders: Record<string, unknown>[] };
    expect(body.orders[0]).not.toHaveProperty("cartId");
    expect(body.orders[0]).toMatchObject({ status: "paid", items: [{ quantity: 2 }] });
    expect(listOrders).toHaveBeenCalledWith(undefined);
  });

  it("filters by status and rejects an unknown one", async () => {
    vi.mocked(listOrders).mockResolvedValue([]);
    await listOrdersRoute(request("/api/orders?status=paid"));
    expect(listOrders).toHaveBeenCalledWith("paid");
    const response = await listOrdersRoute(request("/api/orders?status=shipped"));
    expect(response.status).toBe(400);
    await expectDocumented("get", "/api/orders", response);
  });

  it("gets one order, or 404", async () => {
    vi.mocked(getOrder).mockResolvedValueOnce(order).mockResolvedValueOnce(undefined);
    expect((await getOrderRoute(request(`/api/orders/${orderId}`), context(orderId))).status).toBe(200);
    const missing = await getOrderRoute(request(`/api/orders/${orderId}`), context(orderId));
    expect(missing.status).toBe(404);
    await expectDocumented("get", "/api/orders/{id}", missing);
  });

  it("fulfills a paid order", async () => {
    vi.mocked(fulfillOrder).mockResolvedValue({ ...order, status: "fulfilled", fulfilledAt: new Date("2026-01-04T00:00:00Z") });
    const response = await fulfillRoute(request(`/api/orders/${orderId}/fulfill`, { method: "POST" }), context(orderId));
    expect(await expectDocumented("post", "/api/orders/{id}/fulfill", response)).toMatchObject({ order: { status: "fulfilled" } });
  });

  it("answers fulfilling an unpaid order with 409", async () => {
    vi.mocked(fulfillOrder).mockRejectedValue(new Conflict("Order is pending; only a paid order can be fulfilled."));
    const response = await fulfillRoute(request(`/api/orders/${orderId}/fulfill`, { method: "POST" }), context(orderId));
    expect(response.status).toBe(409);
    await expectDocumented("post", "/api/orders/{id}/fulfill", response);
  });

  it("refuses a request that did not come through the gateway", async () => {
    await expect(listOrdersRoute(new Request("http://app/api/orders"))).rejects.toThrow("did not come through the floo gateway");
    expect(listOrders).not.toHaveBeenCalled();
  });
});
