# Handoff

**Status: Phase 3 code work is DONE (owner-only items remain); extra Phase 5 items done. Branch on branch `phase-3-launch` (cut from `phase-2-security`, which is still NOT merged to main).**

**Goal:** Do Phase 3 (legal & launch, Free plan) from `docs/BACKLOG.md`, then keep going with the next backlog items. Owner is away: never block on them; skip items needing their input and move on. Owner gave full permission; still don't merge to main or touch production settings. Keep this file and the backlog ticks current.

## Done
- Free plan photo limit: `lib/plans.ts` (`photoLimit`, `photoLimitMessage`, 150 free / 1,500 pro), optional `User.plan`; wired into `app/actions/site.ts`, `app/api/photos/{start,finish}`. `MAX_PHOTOS` in `lib/uploads.ts` is now just the absolute ceiling (1,500). Tests updated + 2 new. tsc and 383 tests pass.

- Sign-up consent: required `terms` checkbox on both sign-up forms, `User.termsAcceptedAt`, tests updated (384 pass, lint/tsc/build OK).
- Draft legal pages /terms /privacy /copyright in `app/(legal)` (banner controlled by `LEGAL_DRAFT` in `lib/legal.ts`); footer links on landing. package.json renamed "folio".

- Split `design-editor.tsx` into `app/dashboard/design/{types,ui,pickers,themes,sections}`; split `editor.tsx` into `photo-uploader.tsx` + `photo-drawer.tsx`. Checks pass.

- Playwright browser test `tests/e2e/journey.spec.ts` (`npm run test:e2e`, config `playwright.config.ts`, dev server on port 3100) passes locally; added to CI after the smoke test (unverified on GitHub).

- Phase 5 quick wins done: images decoded once (`lib/images.ts`), private changes (messages, legal hold, sign-out-everywhere) no longer clear the public cache, account export streams (`zipChunks`). "Send only each page's photos" was already true.

- Phase 4 start: client galleries for Pro (see BACKLOG section 8 for files), `setPlan` admin action, `robots.txt` hides `/g/`. 395+ tests pass, build OK.
- `docs/BACKLOG.md` fully updated (status table at top, stale items ticked).

## In progress / next (code-only, no owner input)
4. Update CLAUDE.md/README for plans + consent + legal pages.
5. Next Phase 4 items without owner input: editable special themes (Exhibition/Index/Film Strip) for Pro, client gallery follow-ups. Payments need the owner.
Remaining and skipped (needs owner or risky unattended): DB schema at deploy time (needs a real Neon check), fonts only on Folio pages (root-layout refactor), client galleries/payments (Phase 4), Terms/Privacy lawyer text, policy text/lawyer, photo domain on Cloudflare, 3 example sites.

## Decisions / gotchas
- Some files are CRLF, some LF; edit with care (scripts must preserve endings).
- Phase 2 owner checks still pending (see `git show phase-2-security:HANDOFF.md`).

## Open questions
- Policy text for Terms/Privacy; second domain for photos.
