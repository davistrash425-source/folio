# Handoff

**Status: Phase 2 (security) BUILT, committed (9067595) and pushed on branch `phase-2-security`; NOT merged into main. Waiting on the owner's checks below.**

**Goal:** Ship Phase 2 from `docs/BACKLOG.md`: trusted client IP, upload-start limit + daily cleanup cron (also sends the draft reminder email), login limits per IP instead of per-account lockout, equal login timing, smaller action body limit + input validation, security headers, cheap handling of made-up subdomains, Turnstile on sign-up/contact (and login after failures), retrying storage cleanup after account deletion. Commit only when the owner asks; ask before pushing.

## Done (on `phase-2-security`, pushed)
- Steps 1-8 are built: trusted client IP; login limits per (IP,email)/IP + equal timing; Turnstile on sign-up and contact form; upload-start limit (500/h per user); daily cron `app/api/cron/daily` (`lib/cleanup.ts`: retry deleted accounts' file removal via new `storage_cleanup` table, delete unfinished originals >1 day, one draft reminder email); action inputs validated (`updatePhoto` now returns `ActionState`); body limit 2 MB when `R2_ACCOUNT_ID` is set at build, else 25 MB; security headers (`lib/security-headers.ts`, full CSP is REPORT-ONLY); impossible subdomains skip the DB and "missing" is cached 10 min.
- Checks passed: tsc, lint, 381 tests, build.
- Docs updated: CLAUDE.md env table, docs/BACKLOG.md ticks.

## Owner actions before merging (in this order)
1. Add `CRON_SECRET` in Vercel (any long random string), or the daily job never runs.
2. Check the Turnstile widget's hostnames include `folio.cam` and `*.folio.cam` (it will fail on the vercel.app preview unless that address is added too).
3. Open the Vercel preview (or folio.cam after merge) with the browser console open; try sign-up and a contact form; look for "Content-Security-Policy-Report-Only" messages.
4. Merge the PR (https://github.com/davistrash425-source/folio/pull/new/phase-2-security), then test photo upload on folio.cam (R2 CORS failure from Phase 1 still unverified).

## Next for the agent
- If the console shows no CSP problems: rename `Content-Security-Policy-Report-Only` to enforce the full policy in `lib/security-headers.ts` (update `tests/security-headers.test.ts`).
- Optional leftovers: CAPTCHA after repeated failed logins; per-IP limit on unknown hosts (Vercel Firewall rule, not code).
- Then Phase 3 (legal & launch): Terms/Privacy pages, DMCA page, consent at sign-up, photo domain on Cloudflare, 150-photo Free limit. Needs owner input (policy generator, lawyer, second domain).
- Ask the owner before pushing; commit only when asked.

## Gotchas
- See `git show main:HANDOFF.md` for Phase 1 gotchas.
