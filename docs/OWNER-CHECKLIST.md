# Owner checklist: things only you can do

Written Oct 25, 2026. Production is `folio.cam`, hosted on Vercel (team `davi-438d`, project `folio`).

**What Claude checked (read-only, nothing was changed).** The Vercel project's environment variables, by name only. Secret values were not read.

| Variable | In Vercel? |
| --- | --- |
| `CRON_SECRET` | **Missing** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Set (production and preview) |
| All six `R2_*` variables | Set. `R2_PUBLIC_URL` is an `r2.dev` address, not a custom domain |
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
Status: account exists (logged in once), designation not started. The "Welcome…" account menu on dmca.copyright.gov did not open for Claude's browser; try it in your own browser. Full steps, the $6 fee, the PO-box rule and the 3-year renewal are in `docs/DMCA-AGENT-GUIDE.md` (branch `worktree-dmca-agent`).
Why: US safe harbour for hosting users' content depends on a registered agent.
1. Go to the US Copyright Office DMCA Designated Agent Directory (dmca.copyright.gov) and create an account. This costs money, so it's your decision.
2. Register the service name (Folio, `folio.cam`), the agent contact, and the address.
3. Renew every three years.
4. Tell Claude the agent's name and address. Claude adds them to the `/copyright` page (`app/(legal)`).

### 7. Photo domain on Cloudflare (30 min)
Why: `R2_PUBLIC_URL` is currently a rate-limited `r2.dev` address. A custom domain gives caching and a stable address.
1. Cloudflare must hold DNS for a domain you choose. A second domain is the plan in the backlog, e.g. `folio-photos.<tld>`. Registering one costs money, so it's your decision. `folio.cam`'s DNS is wherever you set up the wildcard for Vercel, so check before moving anything.
2. R2 → `folio-photos` → Settings → Custom Domains → Connect domain.
3. In Vercel, change `R2_PUBLIC_URL` to `https://<that domain>` and redeploy.
4. Existing photos keep working, because photo addresses are built from `R2_PUBLIC_URL` at read time. Verify with a published site and check the photo address in DevTools.

### 8. Photos for the example sites
Put your chosen photos in `folio-homepage-photos/` (git-ignored). Then Claude can run `npm run homepage-photos`, which writes `public/home/` and `app/ui/home-photos.json`, and commits both. Building three polished example sites also needs you to pick which photographers or styles to show.

### 9. Pick a payment provider (decision, no cost yet)
- Stripe has historically not onboarded Israeli businesses, so verify for your case.
- Paddle or Lemon Squeezy act as the seller (merchant of record) and handle US sales tax. This is easier to start with.
- Vercel's free (Hobby) plan forbids commercial use. Upgrade to Vercel Pro (about $20/mo) before charging.
- Tell Claude which one. Claude can then build checkout, webhooks and the pricing page ($12/mo, $120/yr launch prices are in the backlog).

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
| 8 | Run `npm run homepage-photos`, build example sites |
| 9 | Build billing and a pricing page |
| 10 | Add or remove the footer |

Claude cannot do 1, 2, 3, 7 for you: they need your Vercel/Cloudflare logins, and the instruction not to change production settings still stands.
