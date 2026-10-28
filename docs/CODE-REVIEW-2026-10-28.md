# Code review, Oct 28, 2026

Read-only review of `main` (6ffd352) by six reviewers, one per area (auth and security, data and billing, photos, public sites and design, dashboard and accessibility, docs against code), followed by fixes for the confirmed bugs. This replaces the unverified `docs/FULL-CHECK-NOTES.md` as the list to work from; that file still has the raw findings with IDs (A1-1, P-5, X-6 and so on), and the IDs below point back to it.

Method note: the reviewers were small models. Every finding listed under "Fixed" was re-read in the code by the lead before and after the fix. Findings under "Open" are confirmed by a reviewer reading the code, not reproduced by running it, unless it says so.

## Checks on `main` before the fixes
`npx tsc --noEmit` clean, `npx eslint app lib tests proxy.ts` clean, 458 of 458 tests pass. `npm run build`, `npm run test:e2e` and the smoke test were not run here (CI runs them).

## Fixed in this pass
| Area | Bug | Fix |
| --- | --- | --- |
| Auth (S-1) | Staff role was decided by login email alone, so an `ADMIN_EMAILS` address with no account (say, after the admin deleted theirs) could be claimed by anyone who signed up with it | `adminRole` returns null unless `emailVerified === true` (`lib/auth.ts`) |
| Auth (A1-1) | Google sign-in linked to an existing password account without clearing the password, so someone who pre-registered a victim's address kept access | Linking marks the email verified, signs other sessions out, and drops the password of an unconfirmed account |
| Routing (A5-1) | `/apiary` and any path starting with `api` skipped the subdomain rewrite and 404ed | Matcher excludes whole path segments only (`proxy.ts`) |
| Billing (A6-3) | Deleting an account (user or admin) went ahead when Polar failed to end the subscription, so it kept charging | `cancelSubscriptionFor` throws; both deletes stop with a message and delete nothing. Polar 404 counts as already ended |
| Billing (A6-1/2) | A late event for an older subscription could restore Pro | The stale check no longer requires the same subscription id |
| Admin (A2-9) | `setPlan` skipped the public cache refresh although the public site reads `plan` | Option removed; test checks the site tag is revalidated |
| Admin (P-5) | A takedown that hit a storage error could not be retried (the photos were already marked removed, so the retry did nothing) | Retry also deletes the web copies of photos already removed; storage errors are logged and reported |
| Admin (A2-4/A7-4) | Account deletion checked the legal hold outside the delete | The `delete` statement itself refuses held accounts |
| Photos (A3-1) | Calling finish again re-published a taken-down photo, and it ran for suspended accounts | Suspended check, and the existing-photo check now runs before any web copy is written |
| Export (A7-1) | The account export included the staff-only `legalHold` note and `managedBy` | Both removed |
| Export | Unreadable photos were silently left out of the zip | They are listed in `MISSING-FILES.txt` inside the zip |
| Cleanup (A6-10) | The orphan sweep ignored legal hold | Held accounts are skipped |

## Open, most important first
**Security and data**
- ZIP export breaks above 4 GiB (`lib/zip.ts` uses 32-bit sizes; Pro allows 50 GB). Needs ZIP64. (P-1)
- Web copies are cached for a year as immutable and nothing purges them when a photo is taken down, so a copy can stay reachable by its address; legacy web copies that are not in `photo.variants` are never deleted. (A3-2, A3-8, A7-6)
- `lib/pg.ts` has no `error` listener on the pool, so an idle connection error can crash the process. (A2-1)
- Staff-only actions still missing `impersonationBlock()` or the legal-hold check: `deletePhoto`, `deleteAlbum`, `deleteInquiry`, `saveProfile`, `setPublished` in `app/actions/site.ts`, and `deleteGallery`, `emailGalleryLink` in `app/actions/galleries.ts`. (A1-2, A1-3)
- Client gallery pages and the zip download check `suspended` and `emailVerified` but not `published`, so taking the site offline leaves gallery links working. Needs a decision, then `isLive`. `emailGalleryLink` can send mail with free text from Folio's sender without checking the account is verified or still on Pro.
- A second active subscription overwrites the tracked one in `User.billing`; deleting then revokes only one. (A6-4)
- Account enumeration and abuse: sign-up says "account already exists", password-reset response time differs for existing accounts, a reset request replaces a pending token and is limited per IP only. Email, Upstash and Turnstile `fetch` calls have no timeout.
- `script-src` keeps `'unsafe-inline'` and there is no `form-action`. `readSignedCookie` in `lib/google.ts` lacks `await connection()`.
- Passwords use default scrypt settings. Impersonation expiry is not logged. `addRightsToOlderPhotos` (admin) is not written to the admin log.
- A takedown retry still says "Nothing changed" when it only cleaned leftover copies, and does not close the report or email the photographer.
- Two simultaneous finish calls can both write web copies (the record is added once).
- Privacy question for the owner: a photo uploaded only for a client gallery still appears on the public "all photos" page. A per-photo hide flag would fix it.

**Accessibility and UI**
- `--color-ink-faint` (`app/globals.css:14`) is about 2.8:1 on the paper background; fails WCAG 1.4.3. Also used in `app/page.tsx:233`. Input borders on cards are about 1.4:1.
- The dashboard has no `<main>` landmark or skip link.
- Keyboard focus is invisible on the sign-up fields, the address box and the photo file input (focus style on a wrapper, input hidden).
- Move up/down buttons become disabled while focused, dropping focus; the photo drawer remounts on Previous/Next and focuses its first control.
- Sign-up address availability is not announced (no live region). The Account menu does not close on Escape.
- The design editor can stay on "Saving..." after adding a section, because `sameDesign` compares `JSON.stringify` output and key order differs. (A4-1)
- A Resend failure when resending the confirmation email goes to the error boundary instead of an inline message.

**Smaller**
- `og:image` can fall back to a photo that appears on no page. "Claim it" is offered for held addresses. The gallery page has no Report link. Design arrays (`photoIds`, `albumIds`) have no `.max`.
- Docs: fixed in this pass. Remaining doc gap: not every `lib/` file is named in the docs (see the table in README.md for the main ones).

## Findings from the earlier check that did not hold
A4-3 (Pro draft shown to Free accounts) is refuted: `draftDesign` already applies the plan. I-14 (no `includeSubDomains`) is refuted. A6-9 (unbounded rate-limit keys) is only partly true. A4-2, A5-5 and A6-11 were already fixed on `main`.
