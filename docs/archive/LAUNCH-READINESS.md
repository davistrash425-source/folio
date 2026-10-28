# Launch readiness: Free plan, then Pro

Audit written Oct 25, 2026 (read-only). Nothing was launched or changed in production. Production is `www.folio.cam` on Vercel (team `davi-438d`, project `folio`). `folio.cam` redirects (308) to `www.folio.cam`; `*.folio.cam` is attached for photographers' sites.

Status words: **done**, **blocked on owner**, **blocked on another item** (items 5 to 10 in `docs/OWNER-CHECKLIST.md`), **open** (needs a decision or a fix).

## Verified locally (this worktree, main at `e32a802`)

| Check | Result |
| --- | --- |
| `npx next typegen` | Pass |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass, no warnings |
| `npm test` | 424 of 424 pass (about 100 s) |
| `npm run build` | Pass |

## Verified against production (read-only)

- **Smoke test.** `npm run test:smoke` only sends GET requests (no accounts created), but it uses Node's plain `http` module, which cannot follow the apex-to-HTTPS redirect, so it was not run as written. The same checks were repeated with `curl` against `https://www.folio.cam`: `/`, `/login`, `/signup`, `/forgot-password`, `/terms`, `/privacy`, `/copyright`, `/robots.txt` all 200; `/api/export` signed out gives 401; an unknown subdomain shows "doesn't exist yet"; `/api/cron/daily` without the secret gives 404 (correct; the bearer secret is required). `/dashboard` and `/admin` return 200 signed out because they stream a redirect or a 404 page (the test accepts this). Note: `npm run test:smoke` with `BASE_URL=https://...` is effectively untested against HTTPS. Worth a small fix later (use `https` when the URL says so).
- **Env var names in Vercel (names only, no values read).** Present: `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_ROOT_DOMAIN`, all six `R2_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `UPSTASH_REDIS_REST_URL/TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_EMAILS`, `REPORTS_EMAIL`, `CRON_SECRET` (Production only), `GOOGLE_CLIENT_ID/SECRET` (Google sign-in, not in the checklist). Not set (optional): `ADMIN_VIEWER_EMAILS`. Not set and not needed: `LEGAL_DRAFT` is a code constant, not an env var.
- **Deployments.** The newest production deployment is `3208a1a` (READY), a revert of the CSP enforcement. See gate 4.
- **Sentry (org `davi-k7`).** One unresolved issue in 14 days: FOLIO-1, `TurnstileError 600010` on `/signup`, 2 events, 0 users, about 2 hours before the audit.
- **Vercel runtime errors (7 days).** Four groups: a `pg` SSL-mode warning (318 events; a warning, not a failure), `DATABASE_URL must be set in production` (5 events on Oct 18, before the variable was set), one `Connection terminated unexpectedly` (Oct 21), one `R2 PUT failed: 411` (Oct 19, a single upload). Nothing new since Oct 21 apart from the warning.
- **Not visible from here:** Neon backups and restore window (no Neon connector), Cloudflare R2 settings, the Vercel plan (Hobby or Pro), Upstash and Resend dashboards, Resend domain verification (SPF/DKIM).

## Gate list: Free plan launch

Needs items 1 to 7 per the checklist.

| # | Gate | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `CRON_SECRET` set, cron works | **done** (verify step open) | Variable present in Production. Route answers 404 without bearer, as designed. Owner should still press Run on the Cron Jobs tab once and see a 200 (cannot be done without the secret). |
| 2 | Turnstile hostnames | **done, but check FOLIO-1** | Owner verified Oct 25. Sentry shows `600010` on `/signup` twice, 0 users. Cloudflare's 600xxx codes are widget-execution errors (often an extension, bot or blocked challenge, not hostname). Probably noise, but the owner should look at the Turnstile widget analytics and try sign-up from a clean browser and a phone before launch. |
| 3 | Photo upload works on folio.cam | **done** | Marked done Oct 25. Earlier `R2 PUT 411` seen once on Oct 19 and not since. Recheck a >20 MB upload once after any CSP change. |
| 4 | CSP checked and enforced | **open: reverted** | Checklist says DONE, but main's history shows enforcement (`57c75ec`, `c9b8a1d`) was reverted twice (`fb7d181`, `3208a1a`). Production currently sends `Content-Security-Policy` with only `frame-ancestors`/`object-src` and the full policy as `Report-Only`. Not a hard launch blocker (the app works, report-only is safe), but the checklist line is wrong. Owner/manager: find out why it was reverted (something broke?) and either fix and re-enforce or mark the item as "report-only for launch". |
| 5 | Legal review, `LEGAL_DRAFT=false` | **blocked on owner / item 5** | `/terms` still shows "Draft: this text is waiting for a legal review". `support@folio.cam` mailbox existence cannot be verified from here. |
| 6 | DMCA agent registered | **blocked on owner / item 6** | Costs money; owner decision. `/copyright` still has no agent details. |
| 7 | Photo domain on Cloudflare | **blocked on owner / item 7** | `R2_PUBLIC_URL` is still an `r2.dev` address (rate-limited, no caching). Photographers' sites would be slow or throttled under traffic. For a small private beta it works; for a public launch it is the weakest link. |
| A | Error monitoring | **done** | Sentry receiving events (FOLIO-1 proves the pipe works). |
| B | Email sending | **done (partly unverified)** | `RESEND_API_KEY`/`EMAIL_FROM` set. Email confirmation gates going live, so a broken sender means nobody can publish. Do a real sign-up with a fresh Gmail address on launch eve and check that the message arrives, not in spam. |
| C | Rate limits | **done** | Upstash vars set. |
| D | Database backups | **blocked on owner (cannot see)** | See "Backups" below. |
| E | Admin access works | **done** | `ADMIN_EMAILS` set; admin path returns the expected gate signed out. |
| F | Code health | **done** | tsc, lint, 424 tests, build all pass. |

**Free launch verdict:** technically ready now. Legally and operationally it is blocked on 5, 6 and 7, plus the backup check (D) and the CSP status (4). A **closed or invite-only beta** is reasonable today; a public launch should wait for 5 and 6 at minimum, because the sign-up page already collects Terms acceptance against a draft text.

## Gate list: Pro launch

Needs everything above plus 5, 9 and 10.

| # | Gate | Status | Evidence |
| --- | --- | --- | --- |
| P1 | Free launch complete | **blocked** | See above. |
| P2 | Legal text final (5) | **blocked on owner / item 5** | Must be reviewed before charging. |
| P3 | Payment provider chosen (9) | **blocked on owner / item 9** | No billing code exists: `User.plan` can be `"pro"` and limits are enforced (`lib/plans.ts`), but nothing sets it from a payment. No checkout, webhook or pricing page in `app/`. This is real build work after the decision. |
| P4 | "Made with Folio" footer decision (10) | **blocked on another agent's item 10** | Small code change once decided. |
| P5 | Vercel plan allows commercial use | **blocked on owner** | Hobby forbids commercial use. Upgrade to Vercel Pro (about $20/mo) before charging. Plan could not be read from here. |
| P6 | Pro features tested end to end | **partly done** | Tests cover Pro themes, limits and galleries (`tests/pro-themes.test.ts`, `galleries.test.ts`). Needs a manual run with a real Pro account (set `plan` through admin or the database) once billing exists. |
| P7 | Refund, cancellation and tax wording | **open** | Not in the Terms yet. Needs lawyer input and depends on the provider (merchant of record handles sales tax). |

**Pro launch verdict:** not ready. The main blocker is that billing does not exist yet. Free should launch first.

## Decision: `NEW_SITES_START_PUBLISHED` (currently `false`)

What it does: new accounts get a site that is a draft (not public) until the photographer publishes. `isLive` also requires a confirmed email, so even `true` would not expose unconfirmed sites.

| | Stay `false` (drafts first) | Switch to `true` |
| --- | --- | --- |
| Abuse and takedown load | Low. Nothing is public until a person chooses to publish, so spam and copyright abuse start later and are rarer. | Higher. Every sign-up is instantly a public page on `*.folio.cam`, and a bad actor gets a live URL on your domain within minutes. |
| Legal exposure while review/DMCA agent are pending (5, 6) | Smaller: less public hosted content before safe-harbour is in place. | Larger. |
| First impression | The photographer finishes the editor and presses Publish: an extra step, and some people never press it. The daily cron already sends a draft-site reminder. | "It's live already" is a nicer first minute. |
| Search/SEO | New sites don't get indexed by accident. | Half-built sites get indexed. |

**Recommendation: keep it `false` for the Free launch** and for at least the first month of public sign-ups. Revisit only after (a) items 5 and 6 are done, (b) the admin takedown flow has been exercised on real reports, and (c) you've seen how many people abandon at the Publish step (count drafts vs published in `/admin`). If many abandon, improve the Publish prompt in the editor or the reminder email before changing the default.

## Backups (Neon)

- **Cannot be seen from this audit:** no Neon connector is available, and the dashboard needs the owner's login.
- What to check (owner, 5 minutes): Neon console, project, Settings (or Backup and Restore). Note the plan and the restore window. As a rule of thumb (verify on Neon's pricing page, it changes): the Free plan keeps a short history (hours to a day), paid plans keep days to weeks. Confirm the window is long enough to notice and undo a mistake (at least 7 days is comfortable for launch).
- Do one **restore drill**: create a Neon branch from a point in time (restore to a new branch, never over production) and check the `users` table row count. Restoring to a branch costs little and proves backups work.
- Photos: R2 has no versioning by default. Originals in `folio-originals` are the only copy of customers' work. Consider enabling R2 object lifecycle/versioning or a periodic copy before the Pro launch (a paying customer losing originals is the worst case). The account export is the photographers' own backup route.
- Sessions use a signed cookie and no server state, so a database restore never logs anyone out.

## Launch day: steps

Before (the day before):
1. Owner: complete gates 5 and 6 (or consciously launch as "beta" with the Draft banner), confirm Neon restore window, click Run on the cron job and see a 200.
2. Do a full run on production with a fresh email: sign up, confirm email (check spam), upload photos, design, publish, view `name.folio.cam` on a phone, export the account, delete it. Then confirm the subdomain hold behaves as expected.
3. Note the current production deployment ID as the rollback target (list below).
4. Resolve or understand Sentry FOLIO-1.

Launch day:
1. Open Vercel project, Observability / Runtime Logs, and Sentry Issues side by side.
2. Check `/admin` Overview every hour or so: sign-ups, reports, accounts with unconfirmed email.
3. Watch for: Turnstile errors on sign-up, failed verification emails (Resend dashboard, bounces), R2 upload errors (411, CORS), `Connection terminated` (Neon pooled connection), rate-limit 429 spikes.
4. Keep a short list of "stop-sign-ups" options ready: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` rules stricter in Cloudflare, or deploy a build with sign-up closed.

First week:
- Daily: Sentry unresolved issues, Vercel runtime errors (`get_runtime_errors` 24h), `/admin` Reports (copyright notices have legal deadlines; answer within days, not weeks), Resend bounce/complaint rate, Upstash and R2 usage against free-tier limits, Neon storage and compute.
- Confirm the daily cron ran (Vercel Cron Jobs tab: 04:00 UTC, 200) and that the draft-reminder email did not spam.
- Watch for outgrowing free tiers: Vercel (bandwidth, function time), Neon (storage), Resend (emails per day), R2 `r2.dev` rate limits (gate 7).
- End of week: review drafts vs published count (feeds the `NEW_SITES_START_PUBLISHED` decision), fix the pg SSL-mode warning (add `sslmode=verify-full` to the connection string, an env change the owner makes), and tidy the checklist.

## Rollback plan (Vercel)

Pre-condition: every production deploy is kept; the newest rollback candidates are the last READY production deployments (at audit time `dpl_DkJHbq3fSGMuxhbCXJN1chGaEc4s` for `3208a1a`, and `dpl_7xF36ToZ2ZpvM1hxUwryJsAuUgZJ` for `c9b8a1d`; the latter is the reverted CSP version, so do not roll back to it).

1. Decide fast: errors on sign-up, publishing, uploads or public sites across many users is a rollback; one-off errors are not.
2. Vercel dashboard, project `folio`, Deployments, pick the last known-good READY production deployment, menu, **Instant Rollback** (or `vercel rollback <deployment-url>`). This re-points the domains in seconds; it does not rebuild. Note: rolling back also freezes auto-promotion of new pushes to main until you "re-enable auto-assign" or promote again, so new commits will not go live by accident.
3. Environment variables are not rolled back (they belong to the project, not the deploy). If the cause was a bad env var, fix the variable and redeploy instead.
4. **Database changes are not rolled back.** `lib/pg.ts` runs `ALTER TABLE` on cold start, and user data written during the bad release stays. Old code must keep working with newer data (new `User` fields are optional by convention). For data damage use Neon point-in-time restore into a **new branch**, inspect, then repoint `DATABASE_URL` only if truly needed.
5. After rollback: confirm `/`, `/login`, `/signup` and one published site load, post a note in Sentry on the issue, then fix forward on a branch and redeploy once green (CI: lint, typegen, tsc, tests, build, smoke).
6. Emergency stop for sign-ups without a code change: not available as a setting today. If needed, ask Claude to add a `SIGNUPS_CLOSED` environment switch before launch (a small change, recommended).

## Risks (ranked)

1. **Legal text and DMCA agent not done (5, 6).** Public hosting of user content without safe-harbour registration; Terms say "Draft".
2. **Backups unverified (D) and originals have a single copy** in R2.
3. **`r2.dev` photo address (7).** Rate-limited and uncached; may throttle photographers' public sites.
4. **CSP enforcement was reverted** and the checklist says it was done. Reason unknown; report-only is safe but the item is mislabelled.
5. **Turnstile `600010` on `/signup`** (2 events). Low volume, but sign-up is the front door. Test on a clean browser and phone.
6. **Email deliverability unproven** at scale; confirmation email is a hard gate for publishing.
7. **No billing code, and Hobby plan likely** (Pro launch only).
8. **No one-switch "close sign-ups" and the smoke script can't test HTTPS** (both small fixes).

## Owner decisions needed

- Keep `NEW_SITES_START_PUBLISHED = false` for launch? (recommended: yes)
- Launch Free as a closed/invite beta now, or wait for items 5, 6 (and ideally 7) before public sign-ups?
- Why was the CSP enforcement reverted, and should it be re-attempted before launch?
- Confirm the Neon plan and restore window; accept a restore drill.
- Approve a `SIGNUPS_CLOSED` switch and a smoke-test HTTPS fix (small code changes).
- For Pro: provider (item 9), footer (item 10), Vercel Pro upgrade (costs money).
