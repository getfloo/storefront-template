import "server-only";
import { cookies } from "next/headers";
import { createCart } from "@/lib/orders";

const CART_COOKIE = "cart";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The shopper's cart id, or null before they add anything. Readable from any page. */
export async function currentCartId(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && UUID.test(value) ? value : null;
}

/** The cart id, creating the cart and its cookie first. Server actions only: pages cannot set cookies. */
export async function ensureCartId(): Promise<string> {
  const existing = await currentCartId();
  if (existing) return existing;
  const id = await createCart();
  (await cookies()).set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return id;
}
