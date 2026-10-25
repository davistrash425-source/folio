# Handoff

**Status: everything built so far is merged into `main` and pushed (Oct 25, 2026). Working tree clean. Paused by the owner between Phase 4 items.**

**Goal:** Ship the phases in `docs/BACKLOG.md` (design polish -> security -> legal -> speed), now working through Phase 4 (Folio Pro). Owner may be away: skip items that need them and move on; they gave full permission for code work. Don't change production settings (Vercel env, DNS) and don't spend money.

## Done (all on `main`)
- Phase 1 design polish; Phase 2 security (trusted IP, login limits, Turnstile, daily cron, headers, full CSP still report-only); Phase 3 (150-photo Free limit in `lib/plans.ts`, sign-up consent checkbox + `User.termsAcceptedAt`, DRAFT Terms/Privacy/Copyright pages in `app/(legal)` controlled by `LEGAL_DRAFT` in `lib/legal.ts`, Playwright test `npm run test:e2e`, big editor files split into `app/dashboard/design/*`, `photo-uploader.tsx`, `photo-drawer.tsx`).
- Phase 4 so far: Pro limits (1,500 photos, 20 galleries) in `lib/plans.ts`; password-protected client galleries (`User.galleries`, `lib/galleries.ts`, `app/actions/galleries.ts`, dashboard `app/dashboard/manage/galleries` + `galleries.tsx`, public `app/sites/[subdomain]/g/[gallery]`, cookie in `lib/session.ts`); staff can switch an account to Pro/Free (`setPlan` in `app/actions/admin.ts`, button on the admin site page).
- Phase 5 so far: images decoded once (`lib/images.ts`), private changes don't clear the public cache (`{ publicChange: false }`), account export streams (`zipChunks` in `lib/zip.ts`).
- Checks at last run: tsc, lint, build, 396 unit tests pass. Playwright test passes locally; its CI step is unverified.

## Next (no owner input needed), in this order
1. **Editable special themes for Pro.** Today Exhibition/Index/Film Strip each have 2 settings, offered to everyone (`themeSettings` in `lib/design.ts`, schema ~L170, defaults `defaultThemeSettings`, editor UI `ThemeSettings` in `app/dashboard/design/themes.tsx`, theme code in `app/sites/[subdomain]/themes/*.tsx`). Plan: add richer optional settings (e.g. Exhibition spacing/frame/label font; Index font + row size; Film Strip frame size/border), keep the current basic ones free, gate the new ones with `plan === "pro"` (server side in `saveDraftDesign`/`publishDesign` in `app/actions/design.ts`: reset Pro-only fields to defaults for Free accounts; editor shows them locked with a "Folio Pro" note). Keep new schema fields optional/defaulted so old designs still parse (`readDesign` upgrades).
2. Client gallery follow-ups: download-all zip (reuse `zipChunks`), expiry date, client favourites, email the link to the client.
3. 50 GB storage limit: photos don't store byte sizes yet. Add optional `Photo.bytes` (original + variants) recorded in `finishDirectUpload`/`savePhoto` in `lib/uploads.ts`, a `storageUsed(user)` helper in `lib/plans.ts`, and check it where `photoLimit` is checked. Older photos count as unknown/0 until a backfill script.
4. "More special themes for Pro" (new theme components).

## Needs the owner (do not attempt)
`CRON_SECRET` in Vercel (daily cleanup job doesn't run until set); Turnstile hostnames; browser-console CSP check then enforce the policy (rename report-only header in `lib/security-headers.ts`, update `tests/security-headers.test.ts`); test photo upload on folio.cam (R2 CORS unverified); Terms/Privacy text + lawyer review then `LEGAL_DRAFT=false`; DMCA agent registration; photo domain on Cloudflare + `R2_PUBLIC_URL`; example-site photos; payment provider (Stripe may not take Israeli businesses; Paddle/Lemon Squeezy; Vercel free tier forbids commercial use); launch decisions.

## Decisions / gotchas
- **The backlog lives in two places and both must be edited together:** `docs/BACKLOG.md` and the Claude Doc "Folio — Improvement Backlog" (https://claude.ai/artifact/2GPiZULFPDtucJhJ5WCXXF, doc id `0a3f4b76-c114-422c-a3f5-1f7c452c175a`, tabs: backlog + "Agent context"). Use the Claude Docs connector (`read` outline, then `update`/replace lists by block id with `ifHash`/`ifRev`). The doc's Phase 1 lists and old planning sections were not re-checked against the file.
- Windows: some files are CRLF, some LF. Preserve line endings in scripted edits. In the Bash tool, long heredocs containing certain quotes can fail to parse; write files with the Write tool instead.
- Gallery links are private but the image files are the same public web copies as the portfolio (state this honestly in any UI copy).
- Skipped on purpose (risky unattended): schema setup at deploy time (needs a check against real Neon), Folio fonts only on Folio pages (needs separate root layouts), splitting photos/inquiries into tables (needs a maintenance window).
- Commit/push rules: owner gave full permission this session; normally commit only when asked and ask before pushing.
