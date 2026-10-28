# Owner checklist: things only you can do

Written Oct 25, 2026. Production is `folio.cam`, hosted on Vercel (team `davi-438d`, project `folio`).

**What Claude checked (read-only, nothing was changed).** The Vercel project's environment variables, by name only. Secret values were not read.

| Variable | In Vercel? |
| --- | --- |
| `CRON_SECRET` | **Missing** (added Oct 25, see item 1) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Set (production and preview) |
| All six `R2_*` variables | Set. `R2_PUBLIC_URL` is `https://img.foliocdn.com` (custom domain, since Oct 26, 2026) |
| `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_ROOT_DOMAIN` (`folio.cam`) | Set |
| `RESEND_API_KEY`, `EMAIL_FROM` | Set. Production and preview only |
| `UPSTASH_REDIS_REST_*` | Set |
| `NEXT_PUBLIC_SENTRY_DSN` | Set |
| `ADMIN_EMAILS`, `REPORTS_EMAIL` | Set |

Not checked, because it can't be seen from here: whether Turnstile allows the hostnames, whether the R2 CORS rule exists, and whether uploads work.

A "vars" step means Vercel → project `folio` → Settings → Environment Variables. After adding or changing a variable, **redeploy** (Deployments → the latest one → ⋯ → Redeploy). Running code doesn't see new values until then.

---

## Do in this order

### 1. Add `CRON_SECRET` (DONE Oct 25, 2026 by Claude; only the verify step is left)
Why: `vercel.json` schedules `/api/cron/daily` at 04:00 UTC. The route answers 404 until the secret exists, so the cleanup job (deleted accounts' files, unfinished uploads, the draft-site reminder) never runs.
1. Make a secret. In a terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. Vercel → Settings → Environment Variables → Add `CRON_SECRET`, paste the value, tick **Production** (Preview isn't needed), mark it Sensitive, save.
3. Redeploy production.
4. Verify: Vercel → project → Settings → Cron Jobs (or the Cron tab) → Run on `/api/cron/daily`. Look for a 200. Without the secret it shows 404.

### 2. Turnstile hostnames (DONE Oct 25, 2026; verified by the owner)
Why: the widget only works on hostnames listed for it. If `folio.cam` is missing, sign-up and the contact form fail for real people.
1. Cloudflare dashboard → Turnstile → open the widget whose site key starts with `0x4AAAAAAFlI…` (the key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
2. Hostname Management: make sure `folio.cam` is listed. Adding the parent domain covers `*.folio.cam`, which the contact forms on photographers' sites need.
3. Verify: open `https://folio.cam/signup` in a private window. The "verifying you're human" check should appear and clear. Then send a message from a photographer's contact form, e.g. `https://<subdomain>.folio.cam`.
4. If it fails, the browser console shows a Turnstile error code (110200 = hostname not allowed).

### 3. Test a photo upload on folio.cam (DONE Oct 25, 2026 by Claude: upload worked, R2 returned 200)
Why: R2 CORS is unverified. Uploads go straight from the browser to the private bucket with a signed PUT, so a missing CORS rule breaks them.
1. Cloudflare → R2 → bucket `folio-originals` → Settings → CORS policy. It should contain:
   ```json
   [{ "AllowedOrigins": ["https://folio.cam"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
   Note: photographers use the dashboard on `folio.cam` itself. If uploads can also happen from `*.folio.cam`, add those origins. Cloudflare doesn't accept wildcard subdomains in the middle of a list, so list each origin you need.
2. Sign in at `https://folio.cam`, go to the dashboard, and upload one JPEG and one large one (over 20 MB, to test browser compression).
3. Verify: the photo appears in the dashboard, and `folio-photos` holds three WebP sizes under your user id. If it errors, open DevTools → Console/Network and look for a CORS error on the PUT to `*.r2.cloudflarestorage.com`.

### 4. Check the CSP in the browser console, then enforce it (DONE Oct 25, 2026 by Claude)
The policy is enforced on folio.cam. If a page ever misbehaves, the header is in `lib/security-headers.ts` (renaming it back to `Content-Security-Policy-Report-Only` turns enforcement off).
Why: the full Content-Security-Policy is report-only, so it logs problems but blocks nothing.
1. Open these in Chrome with DevTools → Console open: `folio.cam`, the sign-up page, the dashboard, the design editor with its preview, a published site, a client gallery, and `/admin`. Do an upload while you're there.
2. Look for red lines starting "[Report Only] Refused to …". Note each one (which page, which address).
3. Send them to Claude. If there are none, tell Claude. Claude will rename the header `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `lib/security-headers.ts` and update `tests/security-headers.test.ts`. The policy already includes `R2_PUBLIC_URL`, Turnstile, Sentry and the R2 upload address.
4. Do this **after** step 7 if you plan to move photos to a custom domain, because the policy follows `R2_PUBLIC_URL`. Not a blocker, since the policy updates when the variable does.

### 5. Terms, Privacy, copyright text and the lawyer review
Why: the pages in `app/(legal)` show a "Draft" banner. They need your real business details and a lawyer's review before you charge anyone, and ideally before launch.
1. Give Claude the business details it needs: legal name, address, contact email (the pages use `support@folio.cam`), and country/governing law.
2. Send the pages (`/terms`, `/privacy`, `/copyright`) to a lawyer. The BACKLOG notes say to get US-first wording checked, plus Israeli law if you are the operator there.
3. When the lawyer signs off, tell Claude. Claude sets `LEGAL_DRAFT = false` in `lib/legal.ts`, updates `LEGAL_UPDATED`, and runs the tests.
4. Also create the `support@folio.cam` address (a forward is fine). Suspended photographers are told to write there.

### 6. Register a DMCA agent (30 min, $6) (DONE Oct 26, 2026: DMCA-1084175, renew by Oct 2029)
Done: registered Oct 26, 2026 as DMCA-1084175 (status Active in the directory). Agent: David Leonardo Freeman, 1250 95th Street, Bay Harbor Islands, FL 33154, support@folio.cam; alternate names Folio, folio.cam, www.folio.cam. The agent block is live on `/copyright` (`DMCA_AGENT` in `lib/legal.ts`). **Renew by Oct 2029** ($6; the Copyright Office emails reminders). If the address, phone or email changes, amend the directory entry and update `DMCA_AGENT`. Background and the PO-box rule: `docs/DMCA-AGENT-GUIDE.md`.

### 7. Photo domain on Cloudflare (DONE Oct 26, 2026)
Done: `foliocdn.com` (bought on Cloudflare) serves the public bucket at `img.foliocdn.com`, with a cache rule (edge TTL 1 day, browser TTL 1 year). `R2_PUBLIC_URL` in Vercel is `https://img.foliocdn.com` (Production and Preview), and photos load from it on folio.cam. `folio.cam` itself stays on Vercel's DNS.
Optional, when you're ready: R2 → `folio-photos` → Settings → Public Development URL → Disable, to switch off the old rate-limited `r2.dev` address. To roll back instead, put `https://pub-92f7db47b99f413d8e69382fa98401db.r2.dev` back in Vercel and redeploy (only works while that address is enabled).
A takedown can stay in Cloudflare's cache for up to a day. For an urgent one, purge the photo's address: Cloudflare → `foliocdn.com` → Caching → Configuration → Purge Cache → Custom Purge.

### 8. Photos for the example sites (done Oct 26, 2026)
Done: the three example sites (`bronco`, `highsierra`, `streetlight`) are live and linked from the landing page. They were built with `npm run seed-examples` from the folders in `folio-homepage-photos/`; the owner ran it against production with their own Neon and R2 values (Vercel hides those from Claude). Edit them from the site switcher. The landing page contact sheet still comes from `folio-homepage-photos/Street/` via `npm run homepage-photos`.

### 9. Payment provider (DECIDED Oct 26, 2026: Polar; sandbox tested, production switch left)
- Polar is the seller (merchant of record) and handles sales tax; Stripe is unavailable to Israeli businesses. Checkout, webhook, the Plan page and `/pricing` are built and tested in Polar's sandbox (buy, cancel, uncancel, end).
- Before real money, you do these (Claude can help in the browser, but you log in and approve):
  1. Upgrade Vercel to Pro (about $20/mo); the free Hobby plan forbids commercial use.
  2. Have the lawyer review the Terms and Privacy pages, then flip `LEGAL_DRAFT`.
  3. Create a production Polar account (polar.sh, separate from the sandbox) with the two products ($12 a month, $120 a year), an organization token and a webhook to `https://www.folio.cam/api/webhooks/billing`.
  4. Add the four `POLAR_*` secrets in Vercel Production and set `POLAR_SERVER=production`.
  5. Make one real $12 purchase on your own account, check that the account becomes Pro, then refund it in Polar.

### 10. "Made with Folio" footer on client galleries (DONE Oct 25, 2026: Free shows it, Pro removes it)
Options: always shown, shown on Free only, or never. Tell Claude. It's a small code change.

### 11. Launch decisions
- Free plan launch: needs 1–7 done. Also decide whether `NEW_SITES_START_PUBLISHED` in `lib/site.ts` should stay `false` (new sites start as drafts, the safer default).
- Pro launch: needs 5, 9 and 10 done as well.

---

## What Claude can do once you decide

| Item | Claude's part |
| --- | --- |
| 4 | Enforce the CSP, fix anything the console reported |
| 5 | Flip `LEGAL_DRAFT`, insert business details |
| 6 | Add agent details to `/copyright` |
| 8 | Done: example sites built with `npm run seed-examples` |
| 9 | Build billing and a pricing page |
| 10 | Add or remove the footer |

Claude cannot do 1, 2, 3, 7 for you: they need your Vercel/Cloudflare logins, and the instruction not to change production settings still stands.
