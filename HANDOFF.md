# Handoff

**Status: working through Phase 4 on branch `phase-4-pro`; each finished step is merged to `main` and pushed.**

**Goal:** Ship the phases in `docs/BACKLOG.md` (design polish -> security -> legal -> speed), now working through Phase 4 (Folio Pro). Owner may be away: skip items that need them and move on; they gave full permission for code work. Don't change production settings (Vercel env, DNS) and don't spend money.

## Done (all on `main`)
- Phase 1 design polish; Phase 2 security (trusted IP, login limits, Turnstile, daily cron, headers, full CSP still report-only); Phase 3 (150-photo Free limit in `lib/plans.ts`, sign-up consent checkbox + `User.termsAcceptedAt`, DRAFT Terms/Privacy/Copyright pages in `app/(legal)` controlled by `LEGAL_DRAFT` in `lib/legal.ts`, Playwright test `npm run test:e2e`, big editor files split into `app/dashboard/design/*`, `photo-uploader.tsx`, `photo-drawer.tsx`).
- Phase 4 so far: Pro limits (1,500 photos, 20 galleries) in `lib/plans.ts`; password-protected client galleries (`User.galleries`, `lib/galleries.ts`, `app/actions/galleries.ts`, dashboard `app/dashboard/manage/galleries` + `galleries.tsx`, public `app/sites/[subdomain]/g/[gallery]`, cookie in `lib/session.ts`); staff can switch an account to Pro/Free (`setPlan` in `app/actions/admin.ts`, button on the admin site page).
- Editable special themes for Pro (branch `phase-4-pro`): `themeSettings.<theme>.pro` in `lib/design.ts` (defaulted, so old designs parse), `withoutProSettings` applied in `saveDraftDesign`/`publishDesign` for Free accounts, locked controls in `app/dashboard/design/themes.tsx` (`isPro` prop), rendering in the three theme files, tests in `tests/pro-themes.test.ts`.
- Client gallery follow-ups: `expiresAt`/`favouriteIds` on `ClientGallery`; `emailGalleryLink`, `toggleFavourite`, expiry in `updateGallery`/`unlockGallery` (`app/actions/galleries.ts`); zip route `app/sites/[subdomain]/g/[gallery]/download/route.ts` (uses `zipResponse` in `lib/zip.ts`, `downloadFile` in `lib/uploads.ts`); client grid `photo-grid.tsx`; dashboard forms in `app/dashboard/galleries.tsx`; tests `tests/gallery-extras.test.ts`. The "Made with Folio" footer on galleries is left open (needs an owner decision).
- Phase 5 so far: images decoded once (`lib/images.ts`), private changes don't clear the public cache (`{ publicChange: false }`), account export streams (`zipChunks` in `lib/zip.ts`).
- Checks at last run: tsc, lint, build, 411 unit tests pass. Playwright test passes locally; its CI step is unverified.

## Next (no owner input needed), in this order
1. 50 GB storage limit: photos don't store byte sizes yet. Add optional `Photo.bytes` (original + variants) recorded in `finishDirectUpload`/`savePhoto` in `lib/uploads.ts`, a `storageUsed(user)` helper in `lib/plans.ts`, and check it where `photoLimit` is checked. Older photos count as unknown/0 until a backfill script.
2. "More special themes for Pro" (new theme components).

## Needs the owner (do not attempt)
`CRON_SECRET` in Vercel (daily cleanup job doesn't run until set); Turnstile hostnames; browser-console CSP check then enforce the policy (rename report-only header in `lib/security-headers.ts`, update `tests/security-headers.test.ts`); test photo upload on folio.cam (R2 CORS unverified); Terms/Privacy text + lawyer review then `LEGAL_DRAFT=false`; DMCA agent registration; photo domain on Cloudflare + `R2_PUBLIC_URL`; example-site photos; payment provider (Stripe may not take Israeli businesses; Paddle/Lemon Squeezy; Vercel free tier forbids commercial use); launch decisions.

## Decisions / gotchas
- **The backlog lives in two places and both must be edited together:** `docs/BACKLOG.md` and the Claude Doc "Folio — Improvement Backlog" (https://claude.ai/artifact/2GPiZULFPDtucJhJ5WCXXF, doc id `0a3f4b76-c114-422c-a3f5-1f7c452c175a`, tabs: backlog + "Agent context"). Use the Claude Docs connector (`read` outline, then `update`/replace lists by block id with `ifHash`/`ifRev`). The doc's Phase 1 lists and old planning sections were not re-checked against the file.
- Windows: some files are CRLF, some LF. Preserve line endings in scripted edits. In the Bash tool, long heredocs containing certain quotes can fail to parse; write files with the Write tool instead.
- Gallery links are private but the image files are the same public web copies as the portfolio (state this honestly in any UI copy).
- Skipped on purpose (risky unattended): schema setup at deploy time (needs a check against real Neon), Folio fonts only on Folio pages (needs separate root layouts), splitting photos/inquiries into tables (needs a maintenance window).
- Commit/push rules: owner gave full permission this session; normally commit only when asked and ask before pushing.
