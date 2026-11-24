# Storefront template for floo

A small online store: a product catalog, a cart, Stripe Checkout, customer accounts with order history, and an API your agents use to run fulfillment.

## What you get

- **Catalog and cart.** Products with prices and stock in managed Postgres. The cart lives on the server, keyed by a cookie, and never holds more than is in stock.
- **Stripe Checkout.** Stripe hosts the payment page, so card numbers never reach your app or floo. Prices come from your database, so you create nothing in Stripe but an account. Stripe collects the shipping address and emails the receipt.
- **Orders that add up.** An order is paid only when Stripe's signed webhook says the money arrived. Stock goes down and the cart empties in the same transaction, and a retried webhook changes nothing. Delayed payment methods, such as bank debits, are recorded when they clear.
- **Customer accounts.** Shoppers sign up with email and password, confirm a code floo emails, and see their orders at `/orders`. floo runs the sign-in and keeps users in your database. Guests can check out too.
- **Agent API.** List paid orders, mark them fulfilled, add products and change prices and stock, with an app API key and a generated OpenAPI document.

## Deploy with your agent

Paste this into Claude Code, Codex or Cursor:

```text
Deploy the template at https://github.com/getfloo/storefront-template on floo for me.
Follow https://getfloo.com/agents.md to create a floo-hosted project, replace its
starter code with this template's files (keep the project's [app] name in
floo.app.toml), push, and give me the live URL. The deploy stops on
STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET: have me set them with
`floo env set <NAME> --stdin` as the README says, never paste them to you.
```

Or click **Use this template** on GitHub, then:

```sh
curl -fsSL https://getfloo.com/install.sh | bash
floo auth login
git clone https://github.com/<you>/<your-repo>.git
cd <your-repo>
floo deploy
```

## Connect Stripe

Dev uses Stripe test mode; prod uses live mode. Each environment holds its own keys.

1. In the Stripe Dashboard, in test mode, copy the secret key and set it on dev:
   ```sh
   floo env set STRIPE_SECRET_KEY --stdin
   ```
2. Add a webhook endpoint at your dev URL plus `/webhooks/stripe`, listening for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`. Set its signing secret, then redeploy:
   ```sh
   floo env set STRIPE_WEBHOOK_SECRET --stdin
   floo deploy --rebuild
   ```
3. Load sample products into the empty store:
   ```sh
   floo run --service web -- npm run seed
   ```
4. Buy something with Stripe's test card `4242 4242 4242 4242`, any future date and any CVC.

To go live, repeat steps 1 and 2 in Stripe's live mode with `--env prod`, then release: `gh release create v1` for your GitHub repository, or `floo promote` for a floo-hosted project.

## Run the store with an agent

Mint an app API key with the `api` scope and hand it to your fulfillment agent:

```sh
floo apps consumers create fulfillment-agent
floo apps keys create fulfillment-key --consumer fulfillment-agent --scope api
```

| Method | Path | What |
|---|---|---|
| `GET` | `/api/orders?status=paid` | Orders ready to ship, with items and shipping address |
| `GET` | `/api/orders/{id}` | One order |
| `POST` | `/api/orders/{id}/fulfill` | Mark a paid order shipped |
| `GET` | `/api/products` | Every product, including ones taken out of the shop |
| `POST` | `/api/products` | Add a product |
| `PATCH` | `/api/products/{id}` | Change price, stock, details, or `active` |
| `GET` | `/api/openapi.json` | The OpenAPI document |

## Customize

Ask your agent for changes like these:

- "Take a tracking number when an order is fulfilled and show it on the customer's orders page."
- "Add product categories and a filter on the shop page."
- "Add a low-stock cron job that lists products with fewer than five left."
- "Upload product images to floo Storage instead of committing them to public/."

`AGENTS.md` tells the agent how the store is put together and which rules to keep.

## Private dev

`[[routes]]` in `floo.app.toml` applies to every environment, so dev is public like prod, with Stripe in test mode. Stripe sends webhooks without a floo sign-in, so an environment behind floo's team sign-in never receives them. To try changes before they reach the public dev URL, run the store on your machine and forward test webhooks to it with the [Stripe CLI](https://docs.stripe.com/stripe-cli): `stripe listen --forward-to localhost:3000/webhooks/stripe`, which prints the signing secret to use locally.

## Known limits

- Stock is checked at checkout but not held while the shopper pays, so two shoppers can buy the last unit. Both orders are recorded, stock stops at zero, and the agent sees both in `/api/orders?status=paid`.
- One currency (`CURRENCY` in `lib/store.ts`), no tax or shipping rates, no discount codes.
- floo does not send order emails yet; Stripe's receipt is the buyer's confirmation.

## Local development

```sh
npm install
npm test        # route types, typecheck, lint and tests; no database or Stripe account needed
floo dev        # migrations and the app against your dev database
```

---

Built on [floo](https://getfloo.com).
