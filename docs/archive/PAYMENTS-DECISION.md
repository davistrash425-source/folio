# Choosing a payment provider for Folio Pro

Researched Oct 25, 2026. Nothing was signed up for or bought. Fees come from provider pages where marked (official) and from third-party reviews otherwise; **re-check the pricing page before you commit**, because these change.

## The short version

**Use a merchant of record (MoR).** A MoR is the company that legally sells your product to the customer. It collects and pays the VAT and sales tax in every country, handles refunds and chargebacks, and sends you the net money. For a solo seller in Israel with customers worldwide, that removes the biggest headache (tax registration in the EU, UK, US states). The price is a higher fee than plain Stripe.

**Recommendation: Polar to start, Paddle as the "more established" alternative.** Skip Stripe (not available to Israeli businesses) and Lemon Squeezy (being folded into Stripe).

## Comparison

| | Stripe (direct) | Lemon Squeezy | Paddle | Polar | Creem |
| --- | --- | --- | --- | --- | --- |
| Can an Israeli business sign up? | **No.** Israel is not on Stripe's supported-countries page (official, stripe.com/global). Workaround: a US company via Stripe Atlas (about $500 plus US filings, a US bank account, yearly US tax paperwork) | Pays out through Stripe, so likely the same limit; not verified | Israel is not on Paddle's blocked-seller list (official). Payouts by wire or Payoneer, in USD/EUR/GBP etc., not ILS. Israeli payout was not confirmed on an official page; ask Paddle | **Yes.** Israel is on the payout list (official, polar.sh docs) | **Yes.** Israel is in the 86-country list (official, docs.creem.io) |
| Merchant of record? | No (you handle tax yourself; Stripe Tax can calculate but not file) | Yes | Yes | Yes | Yes |
| Fee on a sale | 2.9% + 30c, plus 0.5% Billing, plus tax tooling | 5% + 50c | 5% + 50c | 5% + 50c (new accounts) or 4% + 40c (accounts made before May 27, 2026), +1.5% for non-US cards, +0.5% subscriptions on the older rate (official) | 3.9% + 40c (official docs example) |
| Cost of one $12 month | about $0.75 | $1.10 | $1.10 (9.2%) | about $1.28 (10.7%) | about $0.87 |
| Cost of one $120 year | about $4.35 | $6.50 | $6.50 (5.4%) | about $8.30 | about $5.08 |
| Payout cost to Israel | Not possible directly | Unknown | No Paddle fee; bank conversion cost | $2/mo per active payout account, 0.25% + 25c per payout, 0.25-1% currency conversion (official) | 7 (USD/EUR) or 1% of the payout, whichever is higher, for bank transfer; min $50, paid 1st and 15th |
| Subscriptions, webhooks, customer portal | Excellent | Good, but development has slowed | Good, mature | Good: subscriptions, hosted customer portal, webhooks | Basic but working |
| Next.js SDK | Excellent (`stripe`) | Official JS SDK, less polished | `@paddle/paddle-node-sdk`, `@paddle/paddle-js` | **`@polar-sh/nextjs`** (checkout and webhook route handlers for the App Router) | Small SDK and REST API |
| Risk | Cannot start | Stripe bought it in 2024 and is moving users to Stripe Managed Payments, which needs Stripe (Israel blocked) | Account review before approval; slower support for small sellers | Young company, so fewer years of track record | Youngest, smallest |

Vercel (official, vercel.com/pricing): the Hobby plan is "for personal, non-commercial use." **Pro costs $20 per month per developer seat.** Charging for Folio means moving the Vercel project to Pro first. That is $240 a year, so Pro needs about 20 monthly subscribers just to cover hosting.

## Why Polar first

1. Confirmed to pay out to Israel on its own documentation.
2. Best fit for this codebase: route handlers for checkout and webhooks drop straight into the Next.js App Router.
3. No monthly fee, and a sandbox mode so everything can be tested with fake cards before real money.
4. Fees are in the same range as Paddle.

Why not just Paddle: it is the most established and cheapest on the yearly plan, but it reviews each seller, and I could not confirm Israeli bank payout from an official page. If the owner would rather have the safer long-term name, apply to Paddle and ask the Israel payout question in the application. The build below is the same for both; only one module changes.

Creem is cheapest per sale but has the smallest track record; keep it as a fallback.

## Before choosing, the owner should

- Ask an Israeli accountant how to report income from a MoR (the MoR is your customer; you invoice it), and whether you need a registered business first. Providers will ask for your legal name, address and tax details. This also feeds item 5 (legal pages), because Terms and Privacy must name the seller.
- Keep the legal and DMCA work (items 5 and 6) moving; MoRs review the site and its legal pages during approval.
- Confirm the final fee on the provider's own pricing page the day you sign up.

## Build plan (Claude does this after you choose; no code written yet)

Everything hangs off `User.plan` in `lib/plans.ts`, which already switches photo, storage and gallery limits. New `User` fields must stay optional (see CLAUDE.md).

1. **Provider module** `lib/billing.ts`, the one place that talks to the provider, like `sendEmail` does for email. Without the provider env vars it uses a local stand-in, so dev and tests need no network. Env vars: access token, webhook secret, product ids for monthly and yearly.
2. **Data**: optional `User.billing` = customer id, subscription id, status, interval, `currentPeriodEnd`, `cancelAtPeriodEnd`. Changed only through `updateUser`.
3. **Checkout**: a server action `startCheckout(interval)` that calls `requireUser()`, creates a hosted checkout with the user's id in the metadata and redirects. Add `impersonationBlock()`. Success returns to `/dashboard/billing`.
4. **Webhook**: `app/api/webhooks/billing/route.ts`. Verifies the signature, ignores repeated deliveries (store the last event id), then on subscription active or renewed sets `plan: "pro"`; on cancelled or revoked (after the paid period ends) sets back to free. Looks up the user by metadata id, never by the email in the payload. Returns 2xx fast.
5. **Billing portal**: a "Manage billing" button that redirects to the provider's hosted portal (cancel, update card, invoices). A dashboard billing page shows plan, renewal date and cancellation state.
6. **Pricing page** `/pricing` (public, linked from the landing page and from the upgrade prompts shown when a limit is hit): Free vs Pro, $12/mo and $120/yr launch prices, 1,500 photos, 20 galleries, 50 GB.
7. **Downgrade rules** (when Pro ends):
   - Nothing is deleted. This matches the existing rule that accounts over their limit keep their photos but can't add more.
   - Free allows 0 client galleries, so existing galleries are hidden from visitors (not deleted) and show "Upgrade to restore" to the owner. Pro-only themes fall back to a Free theme on the live site; the draft keeps the choice.
   - Over 150 photos: all stay, uploading is blocked until under the limit. The site keeps showing them.
   - Grace: keep Pro until `currentPeriodEnd`, plus a few days for failed-payment retries, before downgrading. Email the photographer when payment fails and when the downgrade happens.
8. **Admin interplay**: `setPlan` stays as a manual override (comp accounts, support). Add `User.planSource` of `"billing"` or `"manual"`. The webhook never changes a `"manual"` plan, and `setPlan` keeps logging to `admin_actions`. The admin page shows subscription status read-only. Deleting an account cancels its subscription first; legal-hold accounts are never auto-deleted.
9. **Tests** (plain Node, provider faked with `t.mock.method(globalThis, "fetch", ...)`): bad webhook signature rejected, duplicate event harmless, user A cannot start checkout or open the portal for user B, downgrade keeps photos, manual plan untouched by webhooks. Add to `tests/ownership.test.ts` and `tests/signed-out.test.ts`.
10. **Rollout**: sandbox first, then one real $12 test purchase and refund by the owner, then switch the env vars in Vercel, then announce.
11. **Prerequisites to flip on**: Vercel Pro, legal pages reviewed (item 5), "Made with Folio" footer decided (item 10).

## Decision needed

Polar (recommended) or Paddle (apply and ask about Israel payouts), plus confirmation that you will upgrade Vercel to Pro ($20/mo) before the first charge.
