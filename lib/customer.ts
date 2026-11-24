import "server-only";
import { headers } from "next/headers";
import { requiredEnv } from "@/lib/stripe";

/** A shopper signed in through User accounts ([managed.default.users] in floo.app.toml). */
export type Customer = { id: string; email: string; name: string };

/**
 * The signed-in shopper, or null for a guest. floo serves sign-in at /api/auth on this
 * app's own host and sets FLOO_AUTH_URL to it; the session cookie is first-party.
 * Shoppers sign up from /account; the store never stores passwords itself.
 */
export async function currentCustomer(): Promise<Customer | null> {
  const response = await fetch(`${requiredEnv("FLOO_AUTH_URL")}/get-session`, {
    headers: { cookie: (await headers()).get("cookie") ?? "" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Sign-in service answered ${response.status} for get-session.`);
  const session = await response.json() as { user: { id: string; email: string; name: string } } | null;
  return session && { id: session.user.id, email: session.user.email, name: session.user.name };
}
