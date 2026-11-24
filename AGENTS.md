# Storefront on floo

A small store: products, a cookie cart, Stripe Checkout, customer accounts, and an
agent API. A Next.js App Router app on floo with managed Postgres. Keep one web
service, TypeScript, Drizzle with postgres, and Tailwind CSS v4.
floo API calls go to `https://api.getfloo.com` with `Authorization: Bearer $FLOO_KEY`
and `X-Floo-Org-Id: $FLOO_ORG`; reference: `https://api.getfloo.com/openapi.json`.

## Map
- `/`, `/products/[slug]`, `/cart`: the shop. Public.
- `/account`, `/orders`: customer sign-in and order history (User accounts).
- `/thanks`: where Stripe returns the buyer.
- `/webhooks/stripe`: Stripe's webhook. Public; the signature is the check.
- `/api/products`, `/api/products/{id}`, `/api/orders`, `/api/orders/{id}`,
  `/api/orders/{id}/fulfill`: the agent API, behind `access = "api_key"`.

## Order rules (keep these true)
- `lib/orders.ts` owns every write. Pages, server actions (`app/actions.ts`), the
  webhook (`lib/webhook.ts`), the API and `scripts/seed.ts` call it.
- An order is created `pending` at checkout with the prices the shopper saw
  (`order_items.unit_cents`), and Stripe charges exactly those (`checkoutLineItems`).
  Never send Stripe a price from anywhere else.
- Only `markPaid` moves an order to `paid`, and only from `pending`, in one
  transaction that also lowers stock and empties the cart. That guard is what makes a
  retried webhook harmless; keep the `status = 'pending'` condition.
- `checkout.session.completed` is not payment: record it only when
  `payment_status` is not `unpaid`. Delayed methods arrive as
  `checkout.session.async_payment_succeeded`.
- The order id travels as the Checkout Session's `client_reference_id`.
- Stock is checked at checkout but not held, and stops at zero when paid
  (`greatest(stock - n, 0)`). A database check keeps it at zero or more.
- `fulfillOrder` moves only `paid` to `fulfilled`.
- Prices are integers in the smallest currency unit. One currency: `CURRENCY` in
  `lib/store.ts`.

## Callers and identity
- Shoppers carry no floo identity. A signed-in shopper is `currentCustomer()` in
  `lib/customer.ts`, which asks floo's sign-in service at `FLOO_AUTH_URL`. Use its
  `id` as `orders.customer_id`. Never add password storage or your own sessions.
- `/api` callers come from `callerFrom(request.headers)` in `lib/identity.ts`: an app
  API key with the `api` scope, or an app member's own floo key.
- `/webhooks/stripe` trusts nothing but `stripe.webhooks.constructEvent` on the raw
  body (`request.text()`). Never parse the body first.

## Secrets
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are `required` in `floo.app.toml`;
  set them with `floo env set <NAME> --stdin`, `--env prod` for live keys. Never ask
  the user to paste them into the chat.
- Read them through `requiredEnv` in `lib/stripe.ts`, and create the Stripe client
  with `getStripe()` inside a handler. `next build` loads route modules without
  secrets, so a client created at import fails the build.

## Where to work
- Tables: `db/schema.ts`. After editing, `npm run db:generate`, commit the SQL and
  `drizzle/meta/`, never edit an applied migration. Migrations run once per deploy
  through `migrate_command`.
- API: a handler at `app/api/<name>/route.ts`, its contract in
  `app/api/<name>/openapi.ts` built from the zod schema in `lib/orders.ts`, listed in
  `app/api/operations.ts`. `scripts/test` fails on an undocumented handler or a
  response that does not match its schema.
- Styles: tokens in `app/globals.css` (`bg-canvas`, `bg-panel`, `text-ink`,
  `text-muted`, `border-line`, `bg-accent`). Store name and shipping countries:
  `lib/store.ts`.
- Tests: `tests/*.test.ts`, with the database and Stripe mocked. `npm test` runs
  route type generation, typecheck, lint and Vitest.

## Ship
```sh
npm run build && npm test
git add . && git commit -m "Describe the change"
git push
```
`floo status --wait` follows the deploy; `floo logs query` shows runtime logs.
