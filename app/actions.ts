"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureCartId, currentCartId } from "@/lib/cart";
import { currentCustomer } from "@/lib/customer";
import { UserError, attachCheckoutSession, checkoutLineItems, createPendingOrder, setCartQuantity } from "@/lib/orders";
import { SHIP_TO_COUNTRIES } from "@/lib/store";
import { getStripe, requiredEnv } from "@/lib/stripe";

export type FormState = { error?: string };

function quantityFrom(formData: FormData): number {
  const quantity = Number(formData.get("quantity"));
  return Number.isInteger(quantity) ? quantity : 0;
}

export async function addToCart(_state: FormState, formData: FormData): Promise<FormState> {
  const productId = String(formData.get("productId"));
  try {
    await setCartQuantity(await ensureCartId(), productId, quantityFrom(formData));
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    throw error;
  }
  redirect("/cart");
}

export async function updateCartLine(_state: FormState, formData: FormData): Promise<FormState> {
  const cartId = await currentCartId();
  if (!cartId) return { error: "Your cart is empty." };
  try {
    await setCartQuantity(cartId, String(formData.get("productId")), quantityFrom(formData));
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    throw error;
  }
  revalidatePath("/cart");
  return {};
}

/** Freezes the cart into a pending order and sends the shopper to Stripe Checkout. */
export async function checkout(): Promise<FormState> {
  const cartId = await currentCartId();
  if (!cartId) return { error: "Your cart is empty." };
  const customer = await currentCustomer();
  let url: string;
  try {
    const order = await createPendingOrder(cartId, customer);
    const appUrl = requiredEnv("FLOO_APP_URL");
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      // The webhook finds the order by this id (lib/webhook.ts).
      client_reference_id: order.id,
      customer_email: customer?.email,
      line_items: checkoutLineItems(order),
      shipping_address_collection: { allowed_countries: [...SHIP_TO_COUNTRIES] },
      success_url: `${appUrl}/thanks`,
      cancel_url: `${appUrl}/cart`,
    });
    await attachCheckoutSession(order.id, session.id);
    if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL.");
    url = session.url;
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    throw error;
  }
  redirect(url);
}
