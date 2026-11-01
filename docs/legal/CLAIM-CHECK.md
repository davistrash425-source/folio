# Claim check: every factual statement in the revised pages

Each factual sentence in `/terms`, `/privacy` and `/copyright` (Nov 1, 2026 drafts), with where it was checked. "Vendor" means the statement depends on a vendor's setting or published policy rather than Folio's code (see RESEARCH.md). "Promise" means it's a commitment the owner must keep by practice, not something code enforces. Line numbers are approximate (local copy, see DATA-INVENTORY.md header).

## Terms

| Claim | Checked in |
|---|---|
| Site goes live only after email is confirmed | `isLive` in `lib/site.ts` |
| Export and delete any time from settings | `app/api/export/route.ts`; `deleteAccount` in `app/actions/auth.ts`; `app/dashboard/manage/account/page.tsx` |
| Name and copyright notice written into web copies | `processImage` (`lib/images.ts`), `photoRights` (`lib/uploads.ts`) |
| Content handled only by hosting providers; not sold or used to advertise | No code shares photos elsewhere; vendors per DATA-INVENTORY §4. **Promise** |
| License ends on deletion; some copies linger | `deletePhotoFiles`, `removeAccountFiles`; cache headers `lib/uploads.ts`; Privacy "Deleting" |
| No AI training by Folio | No such code. **Promise** |
| Robots.txt asks AI crawlers (count from `AI_TRAINING_CRAWLERS`) unless allowed | `app/robots.ts`, `lib/site.ts`, `User.allowAiTraining` |
| Galleries: Pro only, up to `PRO_GALLERY_LIMIT` | `galleryLimit` (`lib/plans.ts`) |
| Gallery link random, password needed, search engines asked to skip | `newGallerySlug` (`lib/galleries.ts`), `unlockGallery` (`app/actions/galleries.ts`), `disallow: "/g/"` (`app/robots.ts`) |
| Gallery photos are the public web copies | `galleryPhotos`, `photoSource`; `lib/galleries.ts` header comment |
| Downloads are web copies up to the largest variant width | `downloadFile` (`lib/uploads.ts`), `VARIANT_WIDTHS` (`lib/images.ts`), download route |
| Free/Pro photo and storage limits and prices | `lib/plans.ts` |
| Polar is merchant of record; takes payment, tax, refunds, billing page; we never see cards | `lib/billing.ts` header; Polar MST 4.1/10.1 (vendor); no card fields in code |
| Renews until cancelled; Polar charges each period | Polar buyer terms (vendor); `applyBillingEvent` |
| Cancel via Account → Plan → Manage billing | `openBillingPortal` (`app/actions/billing.ts`), `buttons.tsx` |
| Keep Pro until period end, then Free | `grantsPro` treats canceled-but-active as `active` (`lib/billing.ts` comment); HANDOFF real test Oct 30 |
| Deleting the account ends Pro right away, no refund | `cancelSubscriptionFor` → `revokeSubscription` (DELETE) in `lib/billing.ts`; no refund call anywhere |
| Refund on our error / closing Folio | **Promise** (and Polar MST 6.4) |
| 30 days' email notice of price change | **Promise**; `CHANGE_NOTICE_DAYS` |
| On downgrade: nothing deleted; galleries hidden; Pro themes show Classic; over-limit photos kept, no new ones | `galleriesOpen` (`lib/plans.ts`), `lib/public-site.ts`, `uploadBlock` (`lib/plans.ts`), downgrade email (`lib/billing-webhook.ts`) |
| Strike per upheld notice; at `STRIKE_LIMIT` site taken offline | `takeDownPhotos` (`app/actions/admin.ts`) adds strikes; suspension is **manual** (`suspendSite`). **Promise** |
| Strike removed when restored after counter-notice | `restorePhotos` comment and code (`app/actions/admin.ts`) |
| Usually told why by email | `tellOwner` + `lib/admin-emails.ts` for takedown and suspension; admin deletion sends no email (`app/admin/sites/[subdomain]/page.tsx` "The photographer isn't emailed") — hence "usually" |
| Address held `ADDRESS_HOLD_MONTHS`; may be given back | `deleteUsers`, `subdomainOnHold` (`lib/db.ts`); admin override (PRs #31/#32) |
| Liability floor | `LIABILITY_FLOOR_USD` (`lib/legal.ts`) — draft figure |
| Operator, governing law, venue | `lib/legal.ts` |

## Privacy

| Claim | Checked in |
|---|---|
| Don't sell or share for advertising | No advertising code; analytics is Vercel only (`app/ui/folio-analytics.tsx`) |
| Password stored as hash; Google users have no password | `hashPassword` (`lib/session.ts`); Google `passwordHash: ""` (`completeGoogleSignup`, `lib/db.ts` comment) |
| Google gives ID, email, name | `verifyIdToken` (`lib/google.ts`), scope `openid email profile` |
| Last `DESIGN_HISTORY_DRAFTS` drafts kept | `HISTORY_LIMIT` (`app/actions/design.ts`); test in `tests/retention.test.ts` |
| Contact email hidden unless shown | `profile.showEmail` comment (`lib/db.ts`) |
| Original private, only in export; web copies stripped of location/camera, with name/notice | `isPrivateFile`, `app/api/uploads/...`, export route; `lib/images.ts` |
| Gallery data: name, photos, password hash, expiry, favourites | `ClientGallery` type (`lib/db.ts`) |
| Billing fields kept | `User.billing` type (`lib/db.ts`), `applyBillingEvent` |
| Records: terms time, email confirmed, plan, staff actions | `termsAcceptedAt`, `emailVerified`, `plan`; `admin_actions` |
| Contact message fields; saved and emailed | `sendInquiry` (`app/actions/site.ts`) |
| Gallery cookie; favourites visible to photographer | `grantGalleryAccess` (`lib/session.ts`); `toggleFavourite` |
| Reports need email; DMCA needs name/address/phone/signature; shared minus address and phone | `reportSite`, `reportCopyright` (`app/actions/report.ts`); `takedownEmail` (`lib/admin-emails.ts`) |
| IP used for rate limits and Turnstile; typed login email counted | `clientIp`, `rateLimit` keys (`app/actions/auth.ts` login), `verifyTurnstile` `remoteip` |
| Hosting logs | Vercel platform (vendor) |
| Error reports: what failed, URL without query, browser and previous page | `dataCollection` in `lib/sentry.ts` (`urlQueryParams: false`, headers allow `user-agent`, `referer`) |
| Visit counts only on folio.cam | `onlyFolioPages` (`app/ui/folio-analytics.tsx`) |
| Vendor list and what each gets | DATA-INVENTORY §4; `lib/email.ts`, `lib/rate-limit.ts`, `lib/uploads.ts`, `lib/cdn.ts`, `lib/turnstile.ts`, `lib/sentry.ts`, `lib/billing.ts`; ImprovMX per BACKLOG item 5 |
| Turnstile controller role | Turnstile addendum (vendor) |
| Polar gets account ID and email, collects payment itself, independent company | `createCheckout` (`lib/billing.ts`); Polar MST 15.5 (vendor) |
| No Google access token kept | `exchangeAndVerify` uses `id_token` only, nothing stored (`lib/google.ts`) |
| Drive: picked files only; browser downloads; server never connects; ~1 hour in browser | `DRIVE_SCOPE`, `downloadDriveFile`, `requestToken` `saved` (`lib/google-drive.ts`) |
| Cookies and durations | `lib/session.ts` (session 30 d, gallery 30 d, `manager`, `impersonate`), `lib/google.ts` (10 min); tests in `tests/retention.test.ts` |
| Contact form remembers the photo in the tab | `sessionStorage` in `app/sites/[subdomain]/contact-form.tsx` |
| Analytics: no cookies, fields, 24-hour hash | Vercel docs (vendor) |
| Staff see every account; impersonation `IMPERSONATION_MINUTES`, reason, logged; blocked actions | `lib/admin.ts`, `startImpersonation` (`app/actions/admin.ts`), `impersonationBlock` calls (auth: delete, sign-out, resend; site: profile, address, publish, single delete, album/inquiry delete; galleries: email/delete; export; billing) |
| Private notes not in export | export route deletes `adminNotes` |
| Staff actions and page views logged | `logAdminAction`, `logAdminView` (`lib/db.ts`) |
| Legal hold blocks deletion incl. by user; clean-up skips | `deleteUsers` SQL, `deleteAccount`, `deletePhoto(s)`, `removeOrphaned*` (`lib/cleanup.ts`) |
| Inbox max `MAX_INQUIRIES`, oldest read first | `keepNewestInquiries` (`app/actions/site.ts`); test |
| Taken-down: public copies deleted, original kept | `takeDownPhotos` → `deleteWebCopies` (`lib/uploads.ts`) |
| Reset 1 h, confirm 48 h, hash only, deleted when used/replaced | `app/actions/auth.ts`, `lib/verify-email.ts`, `lib/tokens.ts`, `addToken`/`takeToken` (`lib/db.ts`); test |
| Upload address `UPLOAD_URL_SECONDS`; unfinished uploads removed after `ORPHAN_AFTER_MS` | `lib/uploads.ts`, `lib/cleanup.ts`, cron |
| Rate-limit counts forgotten within 1 h (IP) / 24 h (all) | Upstash `PEXPIRE` (`lib/rate-limit.ts`); test scans every `rateLimit` call |
| Hosting logs 1 day; Resend ~30 days; Sentry ~30 days; DB restore 7 days | **Vendor**, unconfirmed (`lib/retention.ts` comments; GAP G-29) |
| Address hold `ADDRESS_HOLD_MONTHS` | `lib/site.ts`, `subdomainOnHold` |
| Reports, notices, staff log kept with no end date | No deletion code for `reports`/`admin_actions` (`lib/db.ts`) |
| Export contents and exclusions | `app/api/export/route.ts` |
| Deletion order: end Pro, remove from database, delete files, daily retry | `deleteAccount` (`app/actions/auth.ts`), `deleteUsers`, `removeAccountFiles`, `retryStorageCleanups` |
| Browser cache up to 365 days; CDN up to 1 day | `Cache-Control` in `lib/uploads.ts` (test); CDN per `lib/cdn.ts` comment (vendor) |
| Security: HTTPS, slow salted hashes, signed cookies, private originals, location removed, attempt limits, confirmed staff emails | HSTS (`lib/security-headers.ts`); scrypt `N=32768` (`lib/session.ts`); HMAC cookies; private bucket; `lib/images.ts`; `rateLimit`; `adminRole` needs `emailVerified` (`lib/auth.ts`) |
| Breach notice; 30-day response to requests; email change notice | **Promises** |
| Database and servers in Frankfurt | Vercel deployment `regions: ["fra1"]` (checked via Vercel); Neon `eu-central-1` (BACKLOG) |
| Sentry and Polar in the US | Sentry org region `us.sentry.io` (checked via Sentry); Polar Software, Inc. (vendor) |

## Copyright

| Claim | Checked in |
|---|---|
| Notice elements | `reportCopyright` validation, `CopyrightNotice` (`lib/reports.ts`); 17 U.S.C. §512(c)(3) |
| Owner gets copy without address and phone; name and email stay | `takedownEmail` (`lib/admin-emails.ts`) |
| Incomplete notice: we'll ask | **Promise** (§512(c)(3)(B)(ii)) |
| Counter-notice elements; forwarded with contact details; 10 / 10–14 business days | `lib/admin-emails.ts` wording; §512(g). Restoring is **manual** (`restorePhotos`). **Promise** |
| Strikes, offline at `STRIKE_LIMIT`, removed on restore | as in Terms |
| Designated agent details | `DMCA_AGENT` (`lib/legal.ts`); registration DMCA-1084175 |
