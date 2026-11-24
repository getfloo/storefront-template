import "server-only";
import Stripe from "stripe";

const stripeGlobal = globalThis as typeof globalThis & { flooStripe?: Stripe };

/** Reads a secret floo injects; `required` in floo.app.toml stops a deploy without it. */
export function requiredEnv(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET" | "FLOO_APP_URL" | "FLOO_AUTH_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Set it with floo env set ${name} --stdin, then redeploy.`);
  }
  return value;
}

// Created on first use, not at import: next build loads every route module without
// runtime secrets, and a client created at import throws there for a missing key.
export function getStripe(): Stripe {
  return stripeGlobal.flooStripe ??= new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
}
