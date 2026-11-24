import "server-only";
import type Stripe from "stripe";
import { markExpired, markPaid } from "@/lib/orders";

// What each Stripe event means for an order. The order id travels as the Checkout
// Session's client_reference_id, set in app/actions.ts.
//
// checkout.session.completed means the shopper finished Checkout, not that the money
// arrived: with a delayed method such as a bank debit the session completes unpaid,
// then async_payment_succeeded or async_payment_failed follows.
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (!session.client_reference_id || session.payment_status === "unpaid") return;
      await markPaid({
        orderId: session.client_reference_id,
        checkoutSessionId: session.id,
        email: session.customer_details?.email ?? null,
        shipping: session.collected_information?.shipping_details ?? null,
      });
      return;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object;
      if (session.client_reference_id) await markExpired(session.client_reference_id);
      return;
    }
    default:
      // Subscribe the endpoint to the four events above only; anything else is acknowledged.
      return;
  }
}
