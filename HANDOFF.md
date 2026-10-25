# Handoff

**Status: Phase 3 in progress on branch `phase-3-launch` (cut from `phase-2-security`, which is still NOT merged to main).**

**Goal:** Do Phase 3 (legal & launch, Free plan) from `docs/BACKLOG.md`, then keep going with the next backlog items. Owner is away: never block on them; skip items needing their input and move on. Owner gave full permission; still don't merge to main or touch production settings. Keep this file and the backlog ticks current.

## Done
- Free plan photo limit: `lib/plans.ts` (`photoLimit`, `photoLimitMessage`, 150 free / 1,500 pro), optional `User.plan`; wired into `app/actions/site.ts`, `app/api/photos/{start,finish}`. `MAX_PHOTOS` in `lib/uploads.ts` is now just the absolute ceiling (1,500). Tests updated + 2 new. tsc and 383 tests pass.

## In progress / next (code-only, no owner input)
1. Terms/Privacy consent at sign-up (checkbox + store `User.termsAcceptedAt`), also in Google sign-up.
2. Legal pages `/terms`, `/privacy`, `/copyright` (DMCA page from existing takedown flow) with clearly marked DRAFT placeholder text; footer links on landing page.
3. One site / four themes / special themes locked on Free (check what exists first).
4. Rename package.json "my-app" -> "folio"; update CLAUDE.md/README for plans.
5. Split `design-editor.tsx` / `editor.tsx`; browser tests.
Skip (needs owner): policy text/lawyer, photo domain on Cloudflare, 3 example sites.

## Decisions / gotchas
- Some files are CRLF, some LF; edit with care (scripts must preserve endings).
- Phase 2 owner checks still pending (see `git show phase-2-security:HANDOFF.md`).

## Open questions
- Policy text for Terms/Privacy; second domain for photos.
