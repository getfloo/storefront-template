import type Stripe from "stripe";
import { getStripe, requiredEnv } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/webhook";

// Public by design: Stripe sends no floo credential, so the signature is the check.
// Stripe signs the exact bytes it sends, so the body is verified before it is parsed.
export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      request.headers.get("stripe-signature") ?? "",
      requiredEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  await handleStripeEvent(event);
  return new Response(null, { status: 200 });
}
