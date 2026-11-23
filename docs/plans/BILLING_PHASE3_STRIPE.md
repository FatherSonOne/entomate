# Billing rebuild — Phase 3: Stripe

Status 2026-11-22: code and database are done and tested in Stripe test mode.
Production billing stays **off** until the go-live steps below are done
(without `STRIPE_*` on Render, checkout returns 503 and the webhook rejects
every event).

Pricing (approved 2026-11-22): Solo $20/mo or $200/yr (15 bot hours/mo),
Team $100/mo or $1,000/yr (75 shared bot hours/mo), $10 per 10-hour pack
(Solo and Team only; Free has 2 bot hours and no packs).

## What shipped

| Part | Where |
|---|---|
| `POST /api/billing/checkout` `{ workspaceId, item }` → `{ id, url }`. Owners/admins only. Items: `solo_monthly`, `solo_yearly`, `team_monthly`, `team_yearly`, `bot_pack_10`. | `backend/routes/billing.js` |
| `POST /api/billing/webhook` — Stripe-Signature checked over the raw body. | same |
| Checkout rules, plan sync, pack grant | `backend/services/stripeBilling.js` |
| One grant per paid Checkout session (`stripe_bot_pack_grants` + `grant_stripe_bot_pack()`, which calls `add_bot_pack_hours`) | `supabase/migrations/20261122450000_stripe_bot_pack_grants.sql` (applied 2026-11-22 with `db query`, no ledger row) |
| Products and prices, found by lookup key | `backend/scripts/stripe-bootstrap-prices.js` |

Rules the code enforces:

- The webhook sets `tenant_organizations.plan`, `stripe_customer_id` and
  `stripe_subscription_id` as service_role. It re-reads the subscription from
  Stripe, so retried or out-of-order events give the same result.
- `active`, `trialing`, `past_due` keep the plan. Any other status drops the
  org to `free`, but only if it is still the org's current subscription.
- A pack is granted once per Checkout session, however often Stripe retries.
- Checkout refuses: a pack for a non-Solo/Team org (403); a second
  subscription when the org already has Solo/Team (409); the ecosystem bundle
  org (409); a deleted org (409).
- A saved customer that Stripe cannot find (for example a test-mode customer
  after the switch to live mode) is replaced at the next checkout.
- Success / cancel return to `FRONTEND_URL/settings?billing=success|cancelled`.

## Proof (2026-11-22, Stripe test mode, production database)

The real router ran on a local harness with `stripe listen` forwarding, signed
in as the `TEST_` user of `.test-account-wizard.local` (org `0e2c9759…`, Free):

1. Pack on Free → 403. Checkout on an org the user is not in → 403.
2. Solo monthly paid in Stripe Checkout with card 4242 →
   `customer.subscription.created` + `checkout.session.completed`, both 200 →
   plan `solo`, Stripe ids saved, `get_org_bot_hours` = 15 included.
3. Team checkout while on Solo → 409.
4. Pack paid → 10.0 pack hours, one grant row. The same event resent → 200,
   still 10.0 hours, one row.
5. Subscription cancelled → `customer.subscription.deleted` → plan `free`,
   subscription id cleared.

The test org was then returned to its earlier state (free, no Stripe ids, no
grants, no pack balance). Backend jest: 48 suites / 1,001 tests pass.

## Go-live steps (production)

1. Create the live prices:
   `STRIPE_SECRET_KEY=<live secret key> node backend/scripts/stripe-bootstrap-prices.js`
   (account `acct_1TIdQLGb3AGXe9w8`, Quantum Ecosystems; test-mode prices
   already exist there).
2. Stripe dashboard, live mode → Webhooks → add endpoint
   `https://entomate.onrender.com/api/billing/webhook` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its `whsec_…` secret.
3. Render service `entomate` → Environment: set `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET`. The startup log stops warning about both.
4. Do not put test keys on the production backend: anyone could then get a
   paid plan with card 4242.

## Legacy plans (starter / pro / business / ecosystem) → Solo / Team

Measured 2026-11-22: 5 orgs, **0 with a Stripe customer or subscription**, so
no org pays today and nothing has to move in Stripe.

| Org | Plan now | Plan |
|---|---|---|
| Quantum Ecosystems `a993efd7…` | `ecosystem` | Keep. The bundle stays unpriced ("contact us") and has no bot-hour limit; checkout refuses it, the webhook never writes it. |
| Entomate Test Org `65380e8d…` | `pro` | Seeded test org. Move to `team` (service-role update, no Stripe) in Phase 4, once the Settings UI knows `solo` / `team`. |
| 3 others | `free` | Nothing to do. |

Any starter / pro / business org that appears before the cleanup moves itself:
checkout lets it buy Solo or Team, and the webhook then replaces the legacy
plan. When no org is on `starter` / `pro` / `business`, a later migration drops
them from `tenant_organizations_plan_check`, and Phase 4 removes them from
`frontend/src/constants/plans.js`.

## Left for Phase 4

- The BillingSettings drawer: plan cards that call `/api/billing/checkout`, the
  `?billing=success|cancelled` return, hours used / left.
- `POST /api/billing/portal` (Stripe Customer Portal) for card changes, Solo ↔
  Team and cancel. The webhook already handles the subscription events the
  portal sends.
