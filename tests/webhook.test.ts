import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/orders", () => ({ markPaid: vi.fn(), markExpired: vi.fn() }));

import { POST } from "../app/webhooks/stripe/route";
import { markExpired, markPaid } from "../lib/orders";

const SECRET = "whsec_test_secret";
const signer = new Stripe("sk_test_unused");

function event(type: string, session: Record<string, unknown>) {
  return JSON.stringify({ id: "evt_1", object: "event", type, data: { object: { id: "cs_test_1", object: "checkout.session", ...session } } });
}

function deliver(payload: string, secret = SECRET) {
  const signature = signer.webhooks.generateTestHeaderString({ payload, secret });
  return POST(new Request("http://app/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
}

const paid = {
  client_reference_id: "8d2f0c9e-1b3a-4c5d-9e7f-6a5b4c3d2e1f",
  payment_status: "paid",
  customer_details: { email: "sam@example.com" },
  collected_information: { shipping_details: { name: "Sam", address: { country: "US" } } },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unused");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
});

describe("POST /webhooks/stripe", () => {
  it("records a paid checkout against the order in client_reference_id", async () => {
    const response = await deliver(event("checkout.session.completed", paid));
    expect(response.status).toBe(200);
    expect(markPaid).toHaveBeenCalledWith({
      orderId: paid.client_reference_id,
      checkoutSessionId: "cs_test_1",
      email: "sam@example.com",
      shipping: { name: "Sam", address: { country: "US" } },
    });
  });

  it("does not record a completed checkout whose payment has not cleared", async () => {
    expect((await deliver(event("checkout.session.completed", { ...paid, payment_status: "unpaid" }))).status).toBe(200);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("records a delayed payment when it succeeds", async () => {
    await deliver(event("checkout.session.async_payment_succeeded", paid));
    expect(markPaid).toHaveBeenCalledOnce();
  });

  it.each(["checkout.session.expired", "checkout.session.async_payment_failed"])("expires the order on %s", async (type) => {
    await deliver(event(type, { client_reference_id: paid.client_reference_id, payment_status: "unpaid" }));
    expect(markExpired).toHaveBeenCalledWith(paid.client_reference_id);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("acknowledges events it does not use", async () => {
    expect((await deliver(event("payment_intent.created", {}))).status).toBe(200);
    expect(markPaid).not.toHaveBeenCalled();
    expect(markExpired).not.toHaveBeenCalled();
  });

  it("refuses a body signed with another secret", async () => {
    expect((await deliver(event("checkout.session.completed", paid), "whsec_forged"))).toHaveProperty("status", 400);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("refuses a request without a signature", async () => {
    const response = await POST(new Request("http://app/webhooks/stripe", { method: "POST", body: event("checkout.session.completed", paid) }));
    expect(response.status).toBe(400);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("refuses a signed body that was changed in transit", async () => {
    const payload = event("checkout.session.completed", paid);
    const signature = signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const tampered = payload.replace("sam@example.com", "eve@example.com");
    const response = await POST(new Request("http://app/webhooks/stripe", { method: "POST", body: tampered, headers: { "stripe-signature": signature } }));
    expect(response.status).toBe(400);
    expect(markPaid).not.toHaveBeenCalled();
  });
});
