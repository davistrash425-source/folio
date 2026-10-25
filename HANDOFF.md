# Handoff

**Status: Phase 2 (security) IN PROGRESS on branch `phase-2-security` (from main 57e43ee). Nothing committed yet.**

**Goal:** Ship Phase 2 from `docs/BACKLOG.md`: trusted client IP, upload-start limit + daily cleanup cron (also sends the draft reminder email), login limits per IP instead of per-account lockout, equal login timing, smaller action body limit + input validation, security headers, cheap handling of made-up subdomains, Turnstile on sign-up/contact (and login after failures), retrying storage cleanup after account deletion. Commit only when the owner asks; ask before pushing.

## Done (uncommitted on `phase-2-security`)
- Steps 1-8 are built: trusted client IP; login limits per (IP,email)/IP + equal timing; Turnstile on sign-up and contact form; upload-start limit (500/h per user); daily cron `app/api/cron/daily` (`lib/cleanup.ts`: retry deleted accounts' file removal via new `storage_cleanup` table, delete unfinished originals >1 day, one draft reminder email); action inputs validated (`updatePhoto` now returns `ActionState`); body limit 2 MB when `R2_ACCOUNT_ID` is set at build, else 25 MB; security headers (`lib/security-headers.ts`, full CSP is REPORT-ONLY); impossible subdomains skip the DB and "missing" is cached 10 min.
- Checks passed: tsc, lint, 381 tests, build.
- Docs updated: CLAUDE.md env table, docs/BACKLOG.md ticks.

## Still to do / owner actions
- Add `CRON_SECRET` in Vercel (any long random string) or the daily job never runs.
- Turnstile widget hostnames must include `folio.cam` and `*.folio.cam`; try sign-up and a contact form on a real site.
- Open folio.cam and a photographer site with the browser console open; look for "Content-Security-Policy-Report-Only" messages, fix, then rename the header to `Content-Security-Policy` in `lib/security-headers.ts`.
- Check that photo upload still works on the preview deployment (R2 CORS issue from Phase 1 still unverified).
- Not done: CAPTCHA after repeated failed logins; per-IP limit on unknown hosts (use a Vercel Firewall rule).
- Ask the owner before pushing; commit only when asked.

## Gotchas
- See `git show main:HANDOFF.md` for Phase 1 gotchas.
