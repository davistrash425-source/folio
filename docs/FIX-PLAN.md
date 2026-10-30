# Fix plan — open issues, in order of importance

Source: `docs/CODE-REVIEW-2026-10-28.md` (open items). Each batch is a self-contained PR that lands independently. Ordered most-important first. Item IDs in parentheses point back to the review doc / `docs/FULL-CHECK-NOTES.md`.

Before a batch is "done" it must pass: `npx tsc --noEmit`, `npx eslint app lib tests proxy.ts`, `npm test`, and add or adjust a test in the right file (`tests/ownership.test.ts` for cross-account checks, `tests/signed-out.test.ts` for auth, `tests/` otherwise).

---

## Batch 1 — Crash-proofing + harden staff actions (A2-1, A1-2, A1-3)

Highest value for lowest risk. Three small, independent fixes.

### 1a. Postgres pool `error` listener (`lib/pg.ts:80`)
An idle connection error on a pool with no `error` listener crashes the process.
- After `new Pool(...)` add `pool.on("error", (err) => console.error("Postgres pool error", err))`.
- No schema/type changes.

### 1b. `readSignedCookie` missing `await connection()` (`lib/google.ts:66`)
Next 16 requires request-specific data (`cookies()`) to be read inside a `connection()` context in some async paths. Verify the exact API in `node_modules/next/dist/docs/` (see `AGENTS.md` — this Next differs from training data), then wrap accordingly.

### 1c. Missing `impersonationBlock()` on staff actions
`impersonationBlock()` must run in every action that changes the account itself (per `CLAUDE.md`). Add it to:
- `app/actions/site.ts`: `deletePhoto` (has legal-hold, no impersonation block), `deleteAlbum`, `deleteInquiry`, `saveProfile`, `setPublished`.
- `app/actions/galleries.ts`: `deleteGallery`, `emailGalleryLink` (also import `impersonationBlock` from `@/lib/auth`).

Pattern (from `changeAddress` in `site.ts`):
```ts
const blocked = await impersonationBlock();
if (blocked) return { error: blocked };
```

**Tests:** each action returns the block error while impersonating; the change is not written.

---

## Batch 2 — Takedown purges removed photos everywhere (A3-2, A3-8, A7-6, P-5)

Legal/privacy. Web copies are served with a long `immutable` cache and nothing purges them on takedown, so a taken-down photo stays reachable by its URL; legacy copies not in `photo.variants` are never deleted.

1. **Purge on removal.** When a photo is removed (admin takedown in `app/actions/admin.ts`, and the retry path that already deletes web copies), also purge the CDN/cache entry for each web copy so the immutable cache no longer serves it. Find where the immutable cache-control is set (`lib/uploads.ts` / `photoUrl` / `next.config.ts` rewrite) and add the purge call there.
2. **Legacy copy sweep.** Add a cleanup that deletes web copies not referenced by any `Photo.variants` entry for an account — either in the daily cron (`app/api/cron/daily`) or as a one-off script in `scripts/` run once. Decide which; the cron is safer long-term.
3. **Retry UX (A2-9-ish).** A takedown retry that only cleaned leftover copies should say so ("Cleaned up N leftover copies"), not "Nothing changed".

**Tests:** removing a photo deletes its web copies and purges the cache key; a retry after a storage error succeeds; the legacy sweep removes orphans and keeps referenced files.

---

## Batch 3 — Offline sites close galleries (A1-2/A1-3, "client galleries ignoring site offline")

A site taken offline (`published=false`) still serves gallery links. Fix everywhere a gallery is checked:

1. Replace the `!owner.suspended && owner.emailVerified && galleriesOpen(owner)` checks with `isLive(owner) && galleriesOpen(owner)` (import `isLive` from `@/lib/site`):
   - `app/actions/galleries.ts`: `unlockGallery`, `toggleFavourite`.
   - The gallery page renderer and the gallery zip download (find the pages under `app/sites/[subdomain]/g/`).
2. **`emailGalleryLink`** (`app/actions/galleries.ts:108`): refuse unless `isLive(user) && galleriesOpen(user)` (also covers the unverified/offline case). It also sends free-text mail from Folio's sender — the note field is fine, but gate the send behind the live/Pro check and the existing rate limit.

**Decision needed:** confirm that "offline" (unpublished) should also close client galleries — recommended yes, since the photographer pressed "Go offline".

**Tests:** gallery unlock/zip return the offline error when `published=false`; `emailGalleryLink` refuses for a non-Pro or unverified account.

---

## Batch 4 — ZIP64 export (P-1)

`lib/zip.ts` uses 32-bit sizes/offsets, so the export breaks past 4 GiB (Pro allows 50 GB). Keep the streaming, no-dependency design and add ZIP64:

1. Track when any size, offset, or the file count would overflow 32 bits (`>= 0xFFFFFFFF` / `>= 0xFFFF`).
2. For those entries, write the ZIP64 extra field (id `0x0001`) into the local header and central directory entry, with 8-byte sizes/offsets, and set the 32-bit fields to `0xFFFFFFFF`/`0xFFFF`.
3. Emit a ZIP64 end-of-central-directory record + locator before the regular EOCD, pointing at the real sizes.
4. If nothing overflowed, write exactly the current ZIP (so normal exports stay byte-identical and existing unzip tools are unaffected).

**Tests:** `createZip` with a synthetic >4 GiB entry (sparse content, don't allocate 4 GiB) produces a file a ZIP64-aware tool can read; small exports are unchanged.

---

## Batch 5 — Multiple subscriptions (A6-4)

A second active subscription overwrites the tracked one in `User.billing`, so deleting revokes only one and the other keeps charging.

1. Change `User.billing` to track more than one subscription (e.g. `billing.subscriptions` array, or keep the latest for display but store an `activeSubscriptionIds` list). Keep the field optional; upgrade old shapes on read like other fields (see `CLAUDE.md`).
2. `applyBillingEvent` (`lib/billing-webhook.ts`) updates the matching subscription by id rather than replacing a single one.
3. `cancelSubscriptionFor` (`lib/billing.ts`) and account deletion cancel **every** active subscription, not just the latest.

**Tests:** two active subscriptions are both recorded; ending one leaves the other active; account deletion ends both.

---

## Batch 6 — Anti-abuse: enumeration, timing, timeouts, scrypt, CSP (A6-… , A2-… )

### 6a. Account enumeration and reset timing
- Sign-up's "account already exists" and password-reset's timing leak whether an email exists. Make reset take the same path for known and unknown emails (run a dummy scrypt on a fixed string when the account is missing) and keep the message generic.
- A reset request currently replaces a pending token; keep the existing unexpired token so a second click doesn't invalidate the first email.

### 6b. Timeouts on every outbound `fetch`
Add an `AbortSignal.timeout(...)` to the `fetch` calls for email (Resend, `lib/email.ts`), Upstash (`lib/rate-limit.ts`), Turnstile (`lib/turnstile.ts`) and Google (`lib/google.ts`), so a hung upstream can't stall a request indefinitely.

### 6c. scrypt cost (`lib/session.ts`)
Raise the scrypt cost above the default, and re-hash existing passwords on their next successful login (store a cost/version marker so old hashes are upgraded lazily).

### 6d. CSP (`next.config.ts`)
Remove `'unsafe-inline'` from `script-src` and add `form-action 'self'`. Check whether Next's own inline scripts need a nonce/hash — read the Next 16 docs first; do not break hydration.

**Tests:** reset response is identical for known/unknown emails and does not invalidate a pending token; a hung upstream times out (fake `fetch` with `t.mock.method`); CSP headers in `next.config.ts` no longer carry `'unsafe-inline'`.

---

## Batch 7 — Race on two simultaneous `finish` calls (A3-…)

Two simultaneous `POST /api/photos/finish` can both write web copies (the photo record is inserted once).

1. Make `finish` idempotent per photo: inside the existing `updateUser` (which locks the row), re-check whether the photo id is already present and skip writing web copies if it is — or add a per-photo lock so only one call proceeds.
2. Keep the existing "suspended" and "already removed" checks.

**Tests:** two concurrent finish calls for the same upload write the variants once.

---

## Batch 8 — Admin logging + retry UX (A2-…)

1. **`addRightsToOlderPhotos`** (`app/actions/admin.ts`) must write an `admin_actions` row like every other admin action.
2. **Impersonation expiry** is not logged — record the end time when impersonation starts so the Log page shows it.
3. **Takedown retry** should close the report and email the photographer when it finishes cleaning up (currently it only deletes files and reports "Nothing changed").

**Tests:** the two actions write log rows; the retry closes the report and sends the photographer email (captured via `captureEmails`).

---

## Batch 9 — Per-photo "hide" flag (privacy decision, owner)

A photo added only to a client gallery still appears on the public "all photos" page. **Needs the owner's call** on whether to add a per-photo `hidden` flag. If yes:

1. Add optional `Photo.hidden?: boolean` (upgrade old shapes on read — see `CLAUDE.md`).
2. Exclude `hidden` photos from the public "all photos" page and gallery pages unless the visitor has gallery access, while keeping them in the dashboard.
3. Add a toggle in the photo drawer, and respect it in `photoSource`/`photoUrl` where relevant.

**Decision needed** before starting.

---

## Batch 10 — Accessibility & UI (WCAG + focus)

1. **Contrast** (`app/globals.css:14`): raise `--color-ink-faint` to ≥ 4.5:1 (WCAG 1.4.3) and fix the input borders (~1.4:1) on cards. Check `app/page.tsx:233` uses.
2. **Landmarks:** add a `<main>` landmark and a skip link to the dashboard layout.
3. **Focus visibility:** visible focus ring on sign-up fields, the address box, and the hidden photo file input.
4. **Focus loss:** the move up/down buttons shouldn't disable while focused (disable after blur, or move focus), and the photo drawer should not refocus its first control on Previous/Next.
5. **Announcements:** a live region for sign-up address availability; the Account menu closes on Escape.
6. **Editor "Saving…" stuck (A4-1):** `sameDesign` compares `JSON.stringify` output where key order differs. Compare structurally (deep-equal or canonical key order).

**Tests:** none strictly required beyond a manual pass, but add a test for the `sameDesign` comparison fix if it lives in a testable helper.

---

## Batch 11 — Smaller + docs

1. `og:image` shouldn't fall back to a photo that appears on no page.
2. Don't offer "Claim it" for held addresses.
3. Add a `ReportLink` to the gallery page (like the theme footers).
4. Add `.max` to the design arrays (`photoIds`, `albumIds`) in `lib/design.ts`.
5. Docs: name every `lib/` file in the README table (the review doc lists the gap).

---

## Suggested sequencing

Do **1 → 2 → 3** first (crash-proofing, takedown purge, offline galleries) — they're the highest-risk and mostly small. Then **4** (ZIP64, the one substantial piece), **5–6** (billing + anti-abuse), **7–8** (race + admin logging), and finally **9** (needs the owner) and **10–11** (UI polish).

The launch blockers (lawyer review → `LEGAL_DRAFT=false`, Vercel Pro, production Polar account + `POLAR_*`) are separate and tracked in `HANDOFF.md`.
