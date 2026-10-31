# Bug check, Oct 30, 2026

Five read-only reviewers (auth/admin, billing/services, data/photos, public sites, dashboard UI) were told to skip what `docs/CODE-REVIEW-2026-10-28.md` already listed as open. Every finding was re-read in the code before it was kept. The owner then asked for everything to be fixed with the recommended choices. All of it is on branch `bug-check-fixes`, together with the Oct 29 `docs/FIX-PLAN.md` work, which had been left uncommitted in `.claude/worktrees/fix-plan`.

Checks on the branch: tsc, eslint and `npm run build` pass, and all 513 tests pass. Before this pass, `main` (`04da56f`) had 479 tests, all passing.

## Fixed
**Dashboard**
- The design editor lost a change made after Undo: `lastSent` was never cleared by Undo, Discard or Publish, so making the same change again was skipped as "already sent". `run()` in `app/dashboard/design-editor.tsx` now clears it. Edits typed while Publish or Undo is running now stay on screen and save.
- A failed form save wiped what was typed, because React resets a form after every action. Forms now wrap their action in `keepFields` (`app/ui/keep-fields.ts`) and use `state.fields` as their defaults. This covers profile, address, albums, galleries, the gallery email, the contact form and the report form. The Terms box on both sign-up forms is controlled.
- Changing the photo filter kept the selection, so a bulk Delete could hit hidden photos. The selection is now cleared. Bulk-action messages show outside the bar, which closes when the action works.
- The album arrows moved a hidden, taken-down photo. They now swap by id (`albums.tsx`).
- A cancelled drag (Escape) saved the new order anyway; it now puts the order back. Files dropped during an upload are queued as the next batch instead of being ignored. The fallback upload shows the real error (for example "suspended") instead of "couldn't be read as an image".
- A caption save that failed after the drawer closed was lost silently. It now shows a message in the library, and leaving the page while a save is pending asks first.
- Profile and contact fields have the same `maxLength` as the server, so text is no longer cut off silently. Checkout button prices come from `lib/plans.ts`.
- Accessibility: move buttons at the end of a list stay focusable (`aria-disabled`). The photo drawer is no longer remounted on Previous and Next, so focus stays put. The Account menu closes on Escape, using the same `useMenu` as the site switcher.

**Accounts and email**
- Email link scanners could use up the one-time confirmation link. `/verify-email` is now a page with a Confirm button (`confirmEmail`), and opening the link changes nothing.
- Password reset: a mail outage gave real addresses an error page but unknown ones "we've sent it". The error is now caught and logged, and both get the same answer.
- Google sign-in signed into an existing account without comparing its saved `googleId`, which matters if a work address is reassigned. A different Google account is now refused. An odd certs response no longer crashes the callback.
- An admin's account and its extra sites are deleted in one transaction (`deleteUsers` in `lib/db.ts`), so a legal hold placed meanwhile on any of them stops all.
- Logging out while viewing an account as its owner now logs `impersonation-ended`.

**Photos and data**
- Deleting a photo now also removes it from client galleries and their favourites (`forgetPhotos` in `app/actions/site.ts`).
- `IMAGE_TYPES` has no prototype, so a type like `constructor` is refused.
- The account export no longer includes client gallery password hashes.
- Upload starts reserve their bytes (`User.pendingUploads`, released on finish or after 10 minutes), so many uploads at once can't overfill storage.
- A server-side sharp failure (memory, open files) keeps the upload and is answered 503, so the browser retries. Only bad files are deleted. `removeOrphanedWebCopies` (from the fix plan) now also clears partly written web copies.
- `setAlbumPhotos` validates its input. A full inbox (500 messages) drops the oldest read message first, so spam can't push out unread ones.
- `readDesign` logs when a stored design fits no version, instead of silently showing the default layout.

**Billing and services**
- Webhook events with no `modified_at` use `created_at`, an undated event no longer wipes the newest date seen, and dates are compared as times rather than text.
- Deleting an account doesn't ask Polar to end a subscription the last webhook said had already ended. `letPaymentsDecide` reads the list of active subscriptions (`billingGrantsPro`).
- Two overlapping cron runs can't send two draft reminders. Setting only one Turnstile key now logs a warning.

**From `docs/FIX-PLAN.md` (Oct 29, merged in this pass)**: Postgres pool `error` listener; `impersonationBlock()` on the remaining actions; takedowns purge Cloudflare's cache (`lib/cdn.ts`) and a daily sweep removes orphaned web copies; offline sites close their client galleries, and `emailGalleryLink` needs a live Pro site; ZIP64 export; several active subscriptions per account; password reset keeps a pending link and takes the same time for unknown addresses; timeouts on outbound calls; scrypt cost raised (old hashes upgrade on login); CSP `form-action 'self'`; one finish per upload at a time; admin log entries for rights backfill and impersonation expiry; takedown retries close the report; contrast (`--color-ink-faint`, `--color-rule`), skip link and `<main>`, visible focus on sign-up and the file input; `sameDesign` ignores key order; `og:image` only uses photos on the site; "Claim it" hidden for held addresses; Report link on gallery pages; `.max` on design id lists.

## Decisions taken (owner said "go with your recommendations")
- **Suspension and photo files:** left as is. Suspending hides pages and galleries; a web copy stays reachable by its exact address until it is taken down, which deletes it and purges the cache. Cutting files on suspension would mean rewriting every photo address.
- **Takedown email includes the sender's email:** kept. The photographer needs a way to answer or file a counter-notice, and the mailing address and phone are still left out. CLAUDE.md now says "mailing address". The email wording in `lib/admin-emails.ts` is unchanged (legal wording).
- **Google-only accounts delete by typing the site address:** kept, as designed. It needs a signed-in session and is rate limited.
- **Inbox cap:** kept at 500, but read messages go first (above).
- **Offline sites close galleries** (from the fix plan): yes.

## Still open
- Owner: set `CLOUDFLARE_PURGE_TOKEN` and `CLOUDFLARE_PURGE_ZONE_ID` in Vercel, or the takedown purge does nothing.
- Owner: per-photo "hide from the site" flag for photos uploaded only for a client gallery (FIX-PLAN Batch 9, never built).
- `'unsafe-inline'` in `script-src`: a nonce needs fully dynamic rendering, which partial prerendering rules out.
- A taken-down photo from before web copies existed keeps its only (public) file, since it is also the original. scripts/backfill-photos.ts converts such photos; check production has none left.
- Vercel's own cache for `/_photos/…` on each site's host isn't purged; it follows the upstream headers.
- Low, not done: per-gallery unlock cap across IPs (it would let anyone lock clients out); `unlockGallery` redirects to `/g/<slug>`, which assumes the site's own host.

## Findings that did not hold
- "EXIF Copyright isn't converted to ASCII" (`lib/images.ts`): `tests/rights.test.ts` shows "©" is written as "(C)".
- `findGallery` matching the gallery id as well as the slug: the dashboard needs it, and the password cookie is still required.
