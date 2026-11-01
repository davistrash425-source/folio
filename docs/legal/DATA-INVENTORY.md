# Folio data inventory

Prepared Nov 1, 2026 as the basis for the Privacy Policy and Terms. **Not legal advice.** Every row was traced in the code. Where something couldn't be checked from here (vendor dashboards, plan levels), it says so.

**Which code this describes.** The owner's local copy: `main` at `215c600` (PR #30) plus uncommitted working-tree changes that look like PRs #31–#32 (admin override for held addresses). Production runs `ff7bf66` (PR #33, maintenance mode), which isn't in the local copy. PR #33's description says it only adds a 503 page and stops photo loading while `MAINTENANCE_MODE=1`, so it shouldn't change anything below. Check once the local copy is pulled.

**Where things physically run** (checked Nov 1 through the Vercel and Sentry connections, plus `docs/BACKLOG.md`):
- Vercel Functions run in **`fra1` (Frankfurt)** (production deployment `dpl_DEs9pHYAFk4gAZjPVdsaDTL8v6fX`).
- Neon Postgres is in **Frankfurt (`eu-central-1`)** (BACKLOG "Stack" table).
- Sentry org `davi-k7` is in Sentry's **US** region (`https://us.sentry.io`).
- Cloudflare R2 bucket location, Upstash region and Resend region: **not checked**. The owner should look them up in each dashboard.

So most account data sits in Germany even though Folio is US-run. That matters for transfer wording (see RESEARCH.md §C).

---

## 1. Table

Legend for "Leaves Folio to": V = Vercel (hosting, runs every request), N = Neon (database), R2 = Cloudflare R2, CF = Cloudflare CDN/Turnstile/purge API, Rs = Resend, U = Upstash, S = Sentry, G = Google, P = Polar, Mx = ImprovMX (forwards support@), Inbox = the owner's own mailbox that `REPORTS_EMAIL` and support@ deliver to.

### 1.1 Accounts and sign-in

| Data | Whose | Collected in | Stored in | Purpose | Who can access | Retention and deletion (code) | In export? | Leaves Folio to |
|---|---|---|---|---|---|---|---|---|
| Name, login email, site address (subdomain) | Photographer | `app/actions/auth.ts` `signup`, `completeGoogleSignup` | `users.email`, `users.subdomain`, `users.data.profile.name` (N) | Account, site address, emails | Owner; staff (admin + viewer) on `/admin` | Until account deletion: `deleteUsers` (`lib/db.ts`) deletes the row immediately. Then Neon point-in-time history (§2). Also copied into the admin log on admin deletion (row 1.6) | Yes (`account.json`) | V, N; email to Rs; email to P at checkout |
| Password hash (scrypt `v2:salt:hash`) | Photographer | `signup`, `resetPassword` (`app/actions/auth.ts`) | `users.data.passwordHash` | Login | Nobody can read the password; staff can see the record exists | Until deletion. Replaced on reset. Wiped if an unconfirmed account is claimed through Google (`app/api/auth/google/callback/route.ts`) | **No** (removed in `app/api/export/route.ts`) | V, N |
| Google ID (`sub`), Google email, Google name | Photographer | `lib/google.ts` `verifyIdToken`; scope `openid email profile` | `users.data.googleId`; identity briefly in the signed `google-signup` cookie (10 min) | "Continue with Google" | Owner; staff | Until deletion. Google's access/ID tokens are **not stored**: used once in `exchangeAndVerify` and dropped | Yes (`googleId`) | G (sign-in flow) |
| Terms acceptance time | Photographer | Sign-up checkbox (`app/ui/signup-form.tsx`, Google form) | `users.data.termsAcceptedAt` | Proof of agreement | Owner; staff | Until deletion. **Only the time is kept, not which version** (gap G-10) | Yes | V, N |
| Email confirmed flag | Photographer | `confirmEmail`; staff `verifyAccountEmail` | `users.data.emailVerified` | Only confirmed accounts go live; staff roles need it | Owner; staff | Until deletion | Yes | — |
| Session cookie `session` = `userId.expires.HMAC` | Photographer's browser | `lib/session.ts` `createSession` | Browser only; nothing on the server except `sessionsValidFrom` | Keep signed in | — | 30 days (`MAX_AGE`, `lib/session.ts`). "Sign out everywhere" and password reset set `sessionsValidFrom` | n/a | — |
| `sessionsValidFrom` | Photographer | `signOutEverywhereElse`, `resetPassword`, Google claim, admin `signOutAccountEverywhere` | `users.data` | Invalidate old cookies | Staff | Until deletion | Yes | — |
| Password reset / email confirmation links | Photographer | `lib/tokens.ts`; reset: `createToken(…, "reset", HOUR)` in `app/actions/auth.ts`; confirm: 48 h in `lib/verify-email.ts` | `tokens` table, **SHA-256 hash only** | One-time links | Nobody useful (hash only) | Reset **1 hour**, confirm **48 hours**. Deleted when used (`takeToken`), when a new one of the same kind is made (`addToken` also clears every expired token), and on account deletion. **No scheduled sweep**: an expired token can sit until the next `addToken` (gap G-23, minor) | No | Link itself travels by email (Rs) |
| Admin "manager" cookie | Admin's browser | `lib/session.ts` `setManager` | Browser | An admin switching to one of their extra sites | — | 30 days | n/a | — |
| Google OAuth state/PKCE cookie `google-oauth-state`; `google-signup` | Visitor's browser | `lib/google.ts` | Browser | Sign-in security | — | 10 minutes each, deleted when used | n/a | — |

### 1.2 Profile, photos and site content

| Data | Whose | Collected in | Stored in | Purpose | Who can access | Retention and deletion (code) | In export? | Leaves Folio to |
|---|---|---|---|---|---|---|---|---|
| Profile: bio, contact email (+ `showEmail`), phone, location, social links, copyright line | Photographer | `saveProfile` (`app/actions/site.ts`), `app/dashboard/profile-form.tsx` | `users.data.profile` | Shown on the public site; contact email hidden unless `showEmail` | Public (whatever the site shows); staff | Until deletion | Yes | V, N |
| **Original photo file** `<uuid>.orig.<ext>` | Photographer (and anyone pictured) | Direct upload: `app/api/photos/start` → browser PUT → `app/api/photos/finish`; fallback `uploadPhotos` action | **Private** R2 bucket (`R2_PRIVATE_BUCKET`), key `<userId>/<file>` | Owner's export; remaking web copies; restore after takedown | Never served: `isPrivateFile` blocks it (`lib/uploads.ts`, `app/api/uploads/[userId]/[file]`). Staff have no viewer for originals, but whoever holds the R2 keys could read them | Deleted with the photo (`deletePhoto`/`deletePhotos` → `deletePhotoFiles`) or account (`removeAccountFiles` → `storage.removeAll`, retried daily via `storage_cleanup`). **Kept on takedown** (`deleteWebCopies` only) with **no time limit** (gap G-14). Kept while on legal hold | **Yes** (only place it goes out) | R2 |
| Original's EXIF/GPS/camera data | Photographer / subject | Inside the original | Inside the private original | Not used | As above | As the original | Yes (inside the file) | R2 |
| **Web copies** `<uuid>-<640|1280|2048|own width>.webp` | Photographer / subject | `lib/images.ts` `processImage` | **Public** R2 bucket, served at `img.foliocdn.com` and `name.folio.cam/_photos/<userId>/…` (rewrite in `next.config.ts`) | Showing the site | **Anyone who has the exact address**, including after unpublish/suspension | Deleted with the photo, on takedown, on account deletion. Written with `Cache-Control: public, max-age=31536000, immutable` (`lib/uploads.ts` line ~220), so **browsers that loaded one may keep it up to a year**. Cloudflare's edge keeps it **up to 1 day** unless purged; purge runs only if `CLOUDFLARE_PURGE_TOKEN`/`ZONE_ID` are set (HANDOFF lists these as still "Owner to do"), and only for `img.foliocdn.com` URLs, not `name.folio.cam/_photos/…` (gap G-12) | No (export has originals) | R2, CF; V for the `/_photos` rewrite |
| Name + copyright notice written into web copies (EXIF Artist/Copyright, XMP dc:creator/dc:rights) | Photographer | `photoRights` (`lib/uploads.ts`) | Inside each web copy; `Photo.copyright` | Attribution, 17 U.S.C. §1202 | Public | As web copies | `copyright` field yes | as web copies |
| Photo record: caption, location text, alt text, size, dimensions, created time, `bytes` | Photographer | `updatePhoto(s)` (`app/actions/site.ts`) | `users.data.photos[]` | Site | Public (captions/location as shown); staff | Until photo/account deletion | Yes | — |
| `Photo.removed` (takedown time, report id, staff note) | Photographer | `takeDownPhotos` (`app/actions/admin.ts`) | `users.data.photos[].removed` | Takedown record | Staff | Until restore/account deletion | **Yes** (the staff note is included) | — |
| Pending uploads (file name, bytes, expiry) | Photographer | `app/api/photos/start/route.ts` | `users.data.pendingUploads` | Storage-limit accounting | Staff | Upload address lasts **10 minutes** (`UPLOAD_URL_SECONDS`). Entries pruned on the next start or on finish. Unfinished R2 objects removed by the daily job after **1 day** (`ORPHAN_AFTER_MS`, `lib/cleanup.ts`), except on legal hold | Yes | — |
| Files over 20 MB | Photographer | Compressed in the browser first (`lib/compress-image.ts`), so the "original" stored is the compressed file | — | Upload limit | — | — | — | — |
| Albums | Photographer | `createAlbum` etc. | `users.data.albums` | Site | Public; staff | Until deletion | Yes | — |
| Site design: `design` (published), `draftDesign`, `designHistory` (last 20) | Photographer | `app/actions/design.ts` | `users.data` | Site; undo | Public (published); staff | Until deletion. History capped at 20 | Yes | — |
| Published flag, AI-crawler choice (`allowAiTraining`), draft-reminder time | Photographer | `setPublished`, `saveAiTraining`, `sendDraftReminders` | `users.data` | Site behaviour; robots.txt | Staff | Until deletion | Yes | — |
| Google Drive picker access token | Photographer | `lib/google-drive.ts` `requestToken` (Google Identity Services, scope `drive.file`) | **Browser memory only** (`saved` variable), reused until ~5 min before Google's expiry (normally ~1 hour); gone on reload | Download the files the user picked | Never sent to Folio's server. Sent only to Google's Drive API | ≤ about 1 hour, never persisted | No | G |
| Picked Drive files | Photographer | Browser downloads from `www.googleapis.com/drive/v3/files/<id>?alt=media` | Then uploaded like any other photo | Upload | As photos | As photos | As photos | G → browser → R2 |

### 1.3 Visitors, clients and the public

| Data | Whose | Collected in | Stored in | Purpose | Who can access | Retention and deletion (code) | In export? | Leaves Folio to |
|---|---|---|---|---|---|---|---|---|
| Contact-form message: name, email, "date" field, message, photo asked about, time, read flag | Visitor | `sendInquiry` (`app/actions/site.ts`), `app/sites/[subdomain]/contact-form.tsx` | `users.data.inquiries[]` | Deliver to photographer | Photographer; staff (the admin page shows only the count; a staff member viewing the account as the owner sees the messages) | Until the photographer deletes it (`deleteInquiry`), the inbox passes **500** (`MAX_INQUIRIES`: oldest read message dropped first), or the account is deleted | **Yes** (photographer's export contains visitors' messages) | Emailed via Rs to the photographer's contact/login email with Reply-To = visitor |
| Contact form honeypot, photo id in `sessionStorage` | Visitor | `contact-form.tsx` | Visitor's browser tab (`sessionStorage`) | Remember which photo "Inquire" was pressed on | — | Until the tab closes | — | — |
| Client gallery: title, password hash (scrypt), photo list, created, expiry date | Photographer | `app/actions/galleries.ts` | `users.data.galleries[]` | Pro client galleries | Photographer; staff | Until gallery/account deletion. **Kept (hidden) after a downgrade** (`galleriesOpen`) | Yes, **without** password hashes | — |
| Client's favourites (hearts) | Gallery visitor (the client) | `toggleFavourite` | `galleries[].favouriteIds` (photo ids only, not who) | Show picks to the photographer | Photographer; staff | Until gallery deletion | Yes | — |
| Gallery access cookie `gallery_<id>` = `expires.HMAC` (tied to the password) | Gallery visitor | `grantGalleryAccess` (`lib/session.ts`) | Visitor's browser | Stay unlocked | — | **30 days** (`GALLERY_DAYS`); a password change voids it | n/a | — |
| Gallery files and zip | Photographer / subjects | `app/sites/[subdomain]/g/[gallery]/download/route.ts` | The **same public web copies** (largest size). Zip is built on the fly, not stored | Client delivery | Anyone with the password gets the page and zip; **anyone with an image address gets that image** | As web copies | — | R2, V |
| Client email address typed in "Email the link" | Client | `emailGalleryLink` | **Not stored by Folio**; sent through Rs (Reply-To = photographer's login email) | Send the link (never the password) | — | Resend's log retention only | No | Rs |
| Abuse report: site, reason, details, reporter email | Reporter | `reportSite` (`app/actions/report.ts`) | `reports` table | Moderation | Staff. **Not shown to the photographer** | **Kept indefinitely** (no deletion code; not removed with the account; follows an address change) (gap G-08) | No | Rs → Inbox if `REPORTS_EMAIL` set |
| Copyright notice: name, organisation, role, owner name, **mailing address, phone**, email, work, URLs, typed signature | Reporter | `reportCopyright` | `reports.notice` (jsonb) **and** `reports.details` (full text, address and phone included) | DMCA §512(c)(3) | Staff. Photographer gets it **minus address and phone** in the takedown email (`lib/admin-emails.ts`) | **Kept indefinitely** (gap G-08) | No | Rs → Inbox; parts → photographer by email |
| Visitor IP address | Visitor / anyone | `clientIp()` (`lib/rate-limit.ts`, from `x-vercel-forwarded-for`) | Upstash Redis keys `rl:<kind>:<ip>…` (sorted set of timestamps); in-memory fallback | Rate limits | — | Key expires after its window (`PEXPIRE`): IP-keyed limits **15 min to 1 hour**; the longest window in the app is 24 h (`address:<userId>`, keyed by account, not IP). In-memory copies live until the server instance ends | No | U |
| Login email typed at login | Visitor | `login` (`app/actions/auth.ts`) | Upstash key `rl:login:<ip>:<email>` | Brute-force limit | — | **15 minutes** | No | U |
| IP + Turnstile token | Visitor at sign-up or contact form | `verifyTurnstile` (`lib/turnstile.ts`) sends `remoteip`; widget `app/ui/turnstile.tsx` | Not stored by Folio | Bot check | — | Cloudflare's own (its addendum gives no period) | No | CF |
| IP, user agent, URL, timing of every request | Visitor / photographer | Vercel platform | Vercel runtime/request logs | Hosting, debugging | Owner via Vercel dashboard | Vercel Pro: **1 day** runtime logs (30 days with Observability Plus, not known to be on). `console.error` lines can include account ids (e.g. `lib/cleanup.ts`) | No | V |
| Web Analytics data points | Visitors to **folio.cam / www.folio.cam only** (`app/ui/folio-analytics.tsx` `beforeSend` drops other hosts) | `@vercel/analytics` | Vercel | Count visits to Folio's own pages | Owner | Vercel: no cookies; visitor hash discarded after **24 h**; stores URL, referrer, filtered query params, country/region/city, OS, browser, device type. **The root domain includes `/reset-password?token=…`, `/verify-email?token=…` and the dashboard**; `beforeSend` does not strip query strings (gap G-11) | No | V |
| Error reports | Anyone whose browser or request hits an error | `lib/sentry.ts`, `instrumentation.ts`, `instrumentation-client.ts`, `app/global-error.tsx`. Runs on **every page, photographers' sites included** | Sentry (US) | Fix bugs | Owner | Settings send: error, stack, URL **without query string**, `user-agent` and `referer` headers only; no cookies, bodies, user info or DB values (`dataCollection` block). No tracing (`tracesSampleRate: 0`), no Session Replay integration. **IP:** whether Sentry stores the connection IP depends on the project's "Prevent Storing of IP Addresses" setting, **not checked** (gap G-13). Retention: Sentry's plan default (Developer/free plan is 30 days; confirm plan) | No | S |

### 1.4 Billing (Folio Pro)

| Data | Whose | Collected in | Stored in | Purpose | Who can access | Retention and deletion (code) | In export? | Leaves Folio to |
|---|---|---|---|---|---|---|---|---|
| Account id + login email at checkout | Customer | `createCheckout` (`lib/billing.ts`): `external_customer_id`, `customer_email`, `metadata.userId` | Polar | Sell the subscription | Polar | Polar's own policy (Polar is a separate business under its Master Services Terms §15.5) | — | P |
| Card, billing address, tax data, invoices | Customer | Polar's hosted checkout and portal | **Polar only**; Folio never receives them | Payment, tax, refunds | Polar | Polar's own | — | P (and Stripe behind it) |
| `User.billing`: `subscriptionId`, `status`, `interval`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `lastEventId`, `updatedAt`, `activeSubscriptionIds` | Customer | `applyBillingEvent` (`lib/billing-webhook.ts`) from signed webhooks | `users.data.billing` | Grant/remove Pro | Owner; staff (admin page shows status) | Until account deletion | **Yes** | — |
| `plan`, `planSource` | Customer | Webhook; staff `setPlan` / `letPaymentsDecide` | `users.data` | Limits | Staff | Until deletion | Yes | — |
| Downgrade email | Customer | `applyBillingEvent` | Not stored | Tell them Pro ended | — | — | — | Rs |
| Customer-portal session | Customer | `createPortalUrl` | Polar | Cancel, change card, invoices | — | — | — | P |

Account deletion **revokes** every active subscription right away (`cancelSubscriptionFor` → `DELETE /subscriptions/<id>`), and if Polar fails, nothing is deleted. The code issues **no refund** for the unused part of a period. Downgrade deletes nothing: galleries hidden, Pro themes shown as Classic (`lib/public-site.ts`), photos over 150 kept but no new ones (`uploadBlock`).

### 1.5 Staff access

| Data | Whose | Collected in | Stored in | Purpose | Who can access | Retention and deletion (code) | In export? | Leaves Folio to |
|---|---|---|---|---|---|---|---|---|
| Staff can see every account | All photographers | `/admin` pages; `requireAdmin` (`lib/admin.ts`) | — | Support, moderation | **Full admins** (`ADMIN_EMAILS`) and **read-only viewers** (`ADMIN_VIEWER_EMAILS`), both with a confirmed email. Admin site page shows name, login email, join date, photos (with take-down controls), counts of messages, billing status, strikes, hold, notes | — | — | — |
| "Log in as this user" | Photographer | `startImpersonation` (`app/actions/admin.ts`), cookie `impersonate` (`lib/session.ts`) | Cookie in the admin's browser; log rows | Reproduce problems | Full admins only; typed reason (≥5 characters); **30 minutes** (`IMPERSONATION_MINUTES`); never staff accounts | While on, the admin sees the whole dashboard **including visitors' messages**, and can make most edits. Blocked: account deletion, address change, profile save, sign-out-everywhere, resend verification, export, single-photo delete, album delete, inquiry delete, gallery delete/email, publish toggle, billing. **Not blocked: bulk `deletePhotos`, `updateGallery` (password change), uploads, captions, design** (gap G-16) | — | — |
| `adminNotes` (id, time, author email, text ≤1000) | About the photographer | `addAdminNote` | `users.data.adminNotes` | Staff memory | Staff | Until account deletion | **No** (deliberately excluded) | — |
| `suspended` (time, reason) | Photographer | `suspendSite` | `users.data` | Hide site | Staff; photographer is emailed the reason | Until unsuspended/deleted | **Yes** | Rs |
| `legalHold` (time, note) | Photographer | `placeLegalHold` | `users.data` | Preserve evidence. Blocks account deletion (checked in the same SQL statement), photo deletion, orphan cleanup | Staff. **Photographer is never emailed**; they see a generic "can't be deleted right now, write to support" | Until released | **No** (excluded) | — |
| `strikes` (time, report id) | Photographer | `takeDownPhotos` with a copyright report | `users.data.strikes` | Repeat-infringer policy | Staff | Removed for a notice when its photos are restored after a counter-notice (`restorePhotos`); otherwise until deletion. **At 3 (`STRIKE_LIMIT`) the code only tells the admin to suspend; it does not close the account automatically** | Yes | — |
| Admin log `admin_actions`: time, admin email, account id, address, report id, action, detail (can include the takedown note, impersonation reason, **and on admin deletion the deleted account's email and photo count**) | Photographer; staff | `logAdminAction`, `logAdminView` ("viewed", max once an hour per admin+account) | `admin_actions` table | Accountability, DMCA records | Staff (`/admin/log`) | **Kept indefinitely; not deleted with the account** (gap G-08) | No | — |
| Emails from staff to the photographer (takedown, suspension) | Photographer | `lib/admin-emails.ts` | Not stored | Notice | — | Resend log retention; Reply-To `REPORTS_EMAIL` | — | Rs |

### 1.6 Deletion, holds and other records

| Data | Whose | Collected in | Stored in | Purpose | Who can access | Retention and deletion (code) | In export? | Leaves Folio to |
|---|---|---|---|---|---|---|---|---|
| Released address (subdomain) | Former photographer | `deleteUsers`, `changeSubdomain` | `released_subdomains` (subdomain, time, and for a move the account id) | Stop impersonation of a closed site | Staff | Address held **12 months** (`ADDRESS_HOLD_MONTHS`, `lib/site.ts`; check in `subdomainOnHold`). **Rows are never deleted** after the hold ends (gap G-22, minor). Full admins can override a hold (PRs #31/#32, logged `address-hold-overridden`) | No | — |
| Storage cleanup queue | Former photographer | `deleteUsers` | `storage_cleanup` (account id, time) | Retry file deletion | — | Removed once files are gone; daily retry (`retryStorageCleanups`, cron 04:00 UTC, `vercel.json`) | No | — |
| Support emails to support@folio.cam | Anyone | — | ImprovMX forwards to the owner's mailbox (BACKLOG item 5) | Support | Owner | Owner's mailbox; **no policy** (gap G-08) | No | Mx, Inbox |

## 2. What account deletion actually does, in order

`deleteAccount` (`app/actions/auth.ts`), and `deleteAccountAsAdmin` (`app/actions/admin.ts`):

1. Refuses while viewing as admin, or if the password/typed address is wrong (rate-limited 5 per 15 min).
2. Refuses if the account or any of an admin's extra sites is on legal hold.
3. **Revokes every active Polar subscription.** If Polar errors, stops with nothing deleted. No refund is issued by the code.
4. (Admin deletion only) writes `delete-account` to `admin_actions`, **with the account's email**.
5. One transaction (`deleteUsers`): deletes the `users` row (only if no hold; checked in the same statement), deletes its `tokens`, queues `storage_cleanup`, records the address in `released_subdomains`. Extra sites go with it.
6. Clears the public site cache (`siteChanged`).
7. `removeAccountFiles`: `storage.removeAll(userId)` deletes everything under the account in both R2 buckets. On failure the daily job retries.
8. Signs the browser out.

**Not deleted:** `reports` about the site (address, details, reporter email, full DMCA notices); `admin_actions` rows; the `released_subdomains` row; Polar's customer, order and tax records (Polar's policy); emails already sent through Resend (Resend log retention, 30 days per its pricing page; verify); copies in the owner's inbox; Sentry events (plan retention); Vercel logs (1 day); Neon point-in-time history (below); web copies cached in visitors' browsers (up to 1 year) or at Cloudflare's edge (up to 1 day unless purged).

**Database backups (Neon).** Neon keeps a rolling "history window" for instant restore, and each restore point contains deleted rows until it ages out. By plan: Free 6 h (≤1 GB); Launch default 1 day, max 7 days; Scale default 1 day, max 30 days ([Neon history window](https://neon.com/docs/postgres/backup-restore/history-window)). Any manual **snapshots** keep data until the snapshot is deleted. **The owner must confirm the plan, the window setting, and whether any snapshots exist** (decision D-1).

## 3. The export (`app/api/export/route.ts`)

`folio-<subdomain>.zip` containing:
- `account.json`: the whole `User` object **minus** `passwordHash`, `adminNotes`, `legalHold`, `managedBy`, and gallery `passwordHash`es. So it **includes**: profile, photos (with `removed` records and staff takedown notes), albums, designs + 20-draft history, **visitors' inquiries (their names, emails, messages)**, galleries + favourites, billing record, plan and `planSource`, `strikes`, `suspended` (with reason), `googleId`, `termsAcceptedAt`, `sessionsValidFrom`, `pendingUploads`, `draftReminderAt`, `emailVerified`, `allowAiTraining`.
- `photos/NNN-<id>.<ext>`: every **original** (taken-down photos too).
- `MISSING-FILES.txt` if any original couldn't be read.

Not in the export: web copies; reports/notices about the site; the admin log; Polar's records (available in Polar's portal); Resend/Sentry/Vercel data. Blocked while staff are viewing as the user.

## 4. Vendors

URLs marked ✓ were opened in this session; others are the vendors' usual legal pages and **were not opened**: check before relying on them.

| Vendor | What it receives | Region | Role (my reading, for the lawyer) | Privacy / DPA |
|---|---|---|---|---|
| Vercel (hosting, functions, CDN, logs, Web Analytics, cron) | Every request: IP, headers, URL, cookies, form bodies; runtime logs; analytics data points for folio.cam | Functions `fra1` Frankfurt ✓ (deployment record); edge global | Processor/service provider | https://vercel.com/legal/privacy-policy · https://vercel.com/legal/dpa · Analytics ✓ https://vercel.com/docs/analytics/privacy-policy |
| Neon (Postgres) | All account data, reports, admin log, tokens | Frankfurt `eu-central-1` (BACKLOG) | Processor | https://neon.com/privacy-policy · https://neon.com/dpa · History window ✓ https://neon.com/docs/postgres/backup-restore/history-window |
| Cloudflare R2 | Originals (private) and web copies (public) | Not checked (R2 location hint in dashboard) | Processor | https://www.cloudflare.com/privacypolicy/ · https://www.cloudflare.com/cloudflare-customer-dpa/ |
| Cloudflare CDN (`img.foliocdn.com`) and purge API | Visitors' requests for photos (IP etc.); purge calls with photo URLs | Global edge | Processor | as above |
| Cloudflare Turnstile | IP, TLS fingerprint, user agent, site key/origin | Global | Processor for bot checks; **controller** when improving Turnstile ✓ | ✓ https://www.cloudflare.com/turnstile-privacy-policy/ |
| Resend | Every email: recipient, subject, body (reset/confirm links, visitors' messages, takedown notices, gallery links, client emails) | Not checked | Processor | https://resend.com/legal/privacy-policy · https://resend.com/legal/dpa · retention: 30 days on Free/Pro per the pricing page (verify) |
| Upstash Redis | Rate-limit keys containing IPs, login emails, account ids | Not checked | Processor | https://upstash.com/trust/privacy.pdf · https://upstash.com/trust/dpa.pdf |
| Sentry | Error events: stack, URL without query, user agent, referer; IP depending on project setting | US ✓ (Sentry connection) | Processor | https://sentry.io/privacy/ · https://sentry.io/legal/dpa/ |
| Google (Sign-In; Drive Picker/API) | Sign-in: Google gives Folio `sub`, email, name. Drive: runs between the user's browser and Google | Google | Separate controller for its own services; Folio's use is governed by the API Services User Data Policy ✓ | ✓ https://developers.google.com/terms/api-services-user-data-policy · https://policies.google.com/privacy |
| Polar (merchant of record) | Account id + email at checkout; then Polar collects card/billing/tax data itself | US (Polar Software, Inc.) | **Independent business**, not Folio's processor (Polar MST §15.5 ✓) | ✓ https://polar.sh/legal/privacy · ✓ https://polar.sh/legal/master-services-terms · ✓ https://polar.sh/legal/checkout-buyer-terms · https://polar.sh/legal/sub-processors |
| ImprovMX | Emails sent to support@folio.cam (forwarding) | Not checked | Processor | https://improvmx.com/privacy (not opened) |
| Owner's mailbox (Gmail) | Support mail, report notifications (`REPORTS_EMAIL`), copies of DMCA notices | Google | Owner's own tool | — |
| GitHub, Vercel build | Code only; `data/db.json` and `data/pg` are git-ignored (CLAUDE.md) | — | — | — |

## 5. Places with no defined retention (owner decisions needed)

| # | Data | Today | Suggested (for the owner and lawyer to decide) |
|---|---|---|---|
| D-1 | Neon restore history and snapshots | Plan-dependent, unknown | Confirm plan; set window to 7 days; state "up to 7 days" |
| D-2 | `reports` (abuse reports, DMCA notices incl. address/phone) | Forever | Keep 3 years after the report is closed, then delete (DMCA disputes have a 3-year limitations period under 17 U.S.C. §507(b)) |
| D-3 | `admin_actions` log | Forever, survives deletion | Keep 3 years; on account deletion, replace the email in `detail` with the account id |
| D-4 | Originals of taken-down photos | Forever until restored/deleted | Delete 6–12 months after takedown if no counter-notice and no hold |
| D-5 | `released_subdomains` rows | Forever | Delete after `ADDRESS_HOLD_MONTHS` |
| D-6 | Expired `tokens` | Until the next `addToken` | Add to the daily job |
| D-7 | Inquiries | Until the photographer deletes, max 500 | Keep as is (photographer's choice); say so |
| D-8 | Owner's inbox (support, reports) | Forever | Pick a period (e.g. 3 years) |
| D-9 | Sentry event retention and IP setting | Plan default | Turn on "Prevent Storing of IP Addresses"; confirm 30/90 days |
| D-10 | Resend content retention | 30 days (verify) | Accept; state it |
| D-11 | Legal holds | Until released | No auto-expiry; review holds every 6 months |
| D-12 | Terms version accepted | Only a time | Store the `LEGAL_UPDATED` value accepted |
