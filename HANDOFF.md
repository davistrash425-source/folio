# Handoff

**Status: Phase 1 (design polish) IN PROGRESS — branch `phase-1-round-1`, NOT committed/pushed. Rounds 1–2 done & tested; Round 3 done; Rounds 4–5 done too; waiting on a browser check and the owner's go-ahead to commit.**

**Goal:** Ship Phase 1 from `docs/BACKLOG.md` in five rounds — (1) landing/sign-up, (2) dashboard nav, (3) photos/albums, (4) design editor, (5) public sites/lightbox. Work on branch `phase-1-round-1`; commit only when the owner asks, ask before pushing.

## Done

**Round 1 — landing & sign-up (verified: tsc, lint, tests, build all green when finished):**
- Landing address box is a real input with live ✓/✗ (`app/ui/address-claim.tsx`, `app/ui/use-address-check.ts`, `app/api/address/route.ts`, `lib/address.ts`), carries `?subdomain=` into sign-up.
- Sign-up reworked (`app/ui/signup-form.tsx`, server `app/(auth)/signup/page.tsx`): live address check, keep password on failed submit, focus + red border on wrong field (`field` on `FormState` in `app/actions/auth.ts`), show-password toggle, "you can change it later" hint, aria-describedby, `noValidate` inline errors. Login got show-password + `noValidate` + Google.
- Continue with Google: `app/api/auth/google/{start,callback}/route.ts`, `lib/google.ts` (PKCE + full id_token verification via Google JWKS), `app/(auth)/signup/google/*`. New `User.googleId`; `createUser` takes optional `googleId`/`emailVerified`; passwordless accounts delete by typing their address. `verifyPassword` returns false for empty.
- Per-page titles (nested `layout.tsx` in each `(auth)` route). Landing hero "See an example" anchors `#themes`, pricing teaser, shorter hero, footer contact+report links, eager theme photos with placeholder bg.
- Tests: `tests/address-check.test.ts`, `tests/google-signup.test.ts`.

**Round 2 — dashboard nav (verified: tsc, lint, full test suite 291 passing; build NOT re-run):**
- New sites start as drafts: `NEW_SITES_START_PUBLISHED = false` in `lib/site.ts` (updated `tests/signup.test.ts`).
- `lib/steps.ts`: `completedSteps(user)` (5 booleans) + `entryPath(user)`. Side nav ticks finished steps and shows "N of 5 done" (`app/dashboard/nav.tsx`).
- `/dashboard` and `/dashboard/manage` are now real pages (`app/dashboard/page.tsx`, `app/dashboard/manage/page.tsx`) that redirect 0-photo users to upload; redirects removed from `next.config.ts`.
- Header (`app/dashboard/layout.tsx`): "Take offline" toggle gone (now "View site ↗" / "Go live →" links), "Log out" folded into an Account menu, slimmer. Site switcher closes on outside click.
- All 6 `confirm()` pop-ups replaced by `app/ui/confirm.tsx` `ConfirmButton` (panels, editor, albums, design-editor).
- Step strip wraps instead of scrolling sideways on phones.
- Tests: `tests/steps.test.ts`.

**Round 3 — photos & albums (done; tsc + lint + tests/bulk-photos pass; not yet seen in a browser):**
- Bulk actions in `app/actions/site.ts`: `updatePhotos`, `addPhotosToAlbum`, `deletePhotos`; `deletePhoto` returns `ActionState`. `createAlbum` accepts `photoIds` (own photos only, library order).
- `app/dashboard/editor.tsx`: Select mode + toolbar (add to album, "New album from these" dialog, edit details, delete), size slider, quiet "No description". Drawer split into `PhotoDrawer` (frame, focus trap, Esc) + keyed `PhotoDetails` (autosave 800 ms after typing and on next/prev/close, status line, neutral placeholders, delete errors shown). Open photo stays in a filtered list so autosave doesn't close it. Focus returns to the last-viewed tile.
- `app/dashboard/albums.tsx`: `CreateAlbumForm({photoIds})`, `NewAlbumButton` (dialog). Albums page has a real empty state.
- New shared: `app/ui/use-focus-trap.ts` (use `data-autofocus`, not `autoFocus`), `app/ui/dialog.tsx`.

## Rounds 4 and 5 (done by background agents, Oct 25)

- **Round 4:** `app/dashboard/design-editor.tsx` + `device-preview.tsx` — theme first, pinned preview with spinner, autosave (1 s) with "Draft saved · N unpublished changes", AI box hidden by `SHOW_AI_BOX = false`, special-theme explainer. `app/actions/design.ts` merges autosaves within 30 s into one undo step (`User.designHistoryAt`); `updateUser(id, fn, { publicChange: false })` skips the public cache refresh for draft saves. Tests: `tests/design-autosave.test.ts`.
- **Round 5:** lightbox rewrite (`?photo=<id>`, focus trap, preload, swipe, "Inquire"), `siteNotice` in `lib/public-site.ts` (missing / offline / no-page) rendered by `app/sites/[subdomain]/site-notice.tsx`, root `app/not-found.tsx` + `app/error.tsx`, `profile.showEmail` (hidden by default; existing accounts' public email disappears until they tick the box), `Inquiry.photoId`. Tests: `tests/public-site.test.ts`.
- **Checks passed:** tsc, lint, 321 tests, `npm run build` (needed `Suspense` around `requireUser()` in `app/dashboard/page.tsx` and `manage/page.tsx`).

## Admin expansion (done, committed after Phase 1)
- `/admin` now has Overview, Reports (`/admin/reports`), Accounts (search/filter/pages), All accounts (`/admin/accounts/all`, one plain table), Log (`/admin/log`), and richer site pages (notes, sign out everywhere, confirm/resend verification, delete account with typed address). Full admins = `ADMIN_EMAILS`; read-only staff = optional `ADMIN_VIEWER_EMAILS`. Viewing a site page is logged (`viewed`, once per hour per admin+site).
- "Log in as this user": full admins only, typed reason, 30 min, separate signed `impersonate` cookie, red banner with Stop, blocked for delete/address/sign-out/resend/export; logged as `impersonation-started/ended`. Details in CLAUDE.md. New account-changing actions must call `impersonationBlock()`.
- Checks passed: tsc, lint, 348 tests, build. Not yet seen in a browser.

## Still to do
- Look at everything in a browser (nothing visual verified yet), especially: photo drawer autosave, design editor bottom preview on a phone, lightbox swipe/back button, offline page.
- Left from Round 2: make "Preview website" a labelled draft/live button; same header on every page.
- Owner decides when to commit/push (branch `phase-1-round-1`; nothing committed).

## Gotchas for a fresh session
- Environment was fixed: ran `npm install` (missing `@sentry/nextjs`) and `rm -rf .next/dev` (stale `folio-plus` route types). If tsc complains about `.next/dev/types/validator.ts`, delete `.next/dev` and `npx next typegen`.
- Next 16: `cookies()`/`searchParams` in a server component must be inside `<Suspense>` or the build fails with `blocking-prerender-dynamic` (see `app/(auth)/signup/page.tsx`).
- `deletePhoto` signature changed from `void` to `Promise<ActionState>` — the drawer still calls it as `await deletePhoto(...)` and ignores the result; it should be updated to surface `result.error`.
- Deferred (owner-blocked): full per-theme demo sites (needs owner's example sites, backlog Q11), footer Terms/Privacy (Phase 3 legal) and Instagram (no account yet), the "reminder email if not published" half of the drafts item (needs Vercel Cron, Phase 2).
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup.ts --test tests/<file>.test.ts` runs one test file (~2s); `npm test` runs all (~60s). Each test file gets its own PGlite.

## Open questions
None blocking. Ask the owner before pushing; commit only when they ask.
