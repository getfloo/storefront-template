// Store-wide settings. Change these to make the store yours.

export const STORE_NAME = "Corner Goods";

/** Every price and order is in this currency; Stripe charges in it. */
export const CURRENCY = "usd";

/** Countries Stripe Checkout lets the shopper ship to (ISO 3166-1 alpha-2). */
export const SHIP_TO_COUNTRIES = ["US", "CA"] as const;

/** Most of one product a single cart may hold. */
export const MAX_PER_PRODUCT = 10;

export function formatMoney(cents: number, currency = CURRENCY): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
