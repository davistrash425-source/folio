# Folio full project check — all agent findings (raw, pre-verification)

**Superseded Oct 28, 2026 by `docs/CODE-REVIEW-2026-10-28.md`** (verified list, with what was fixed and what is open). This file is kept only for the finding IDs. Companion: HANDOFF.md.
Report doc (being filled): https://claude.ai/artifact/LTmpe1539z4gJjQAUcwKJ5 (Claude Doc id 9d9a983d-e569-416b-89a2-ddfda710b7a6, body node ed926ab5-d4d7; pending block ids mqxg34c7971.32 .. .37 = sections 1-6)

IMPORTANT: local branch `polar-billing` is 15 commits BEHIND origin/main (production, 1fd2baa). Most findings still apply on main (checked); fixed on main: A4-2, A5-5 (galleries + Pro themes after downgrade), A6-11. A2-9 became LIVE on main.
Format per line: id severity verdict effort | file:line | scenario | fix | already tracked.  "DUP" = same issue as another id.
Status: waves 1+2 done except Q (quality gates). Wave 3 (adversarial verification) NOT started. Wave 4 synthesis + doc fill NOT started.

---

AREA 1 auth/admin/impersonation (6 findings)
A1-1 medium CONFIRMED S | app/api/auth/google/callback/route.ts:21-29 | Google login links into existing UNVERIFIED account (squatter pre-signed up with victim email+own password), no passwordHash clear, no sessionsValidFrom -> squatter keeps access; also emailVerified not set true on Google login | fix: if !emailVerified set verified, clear passwordHash, set sessionsValidFrom | tracked: partly (BACKLOG:589 link automatically)
A1-2 low CONFIRMED S-M | app/actions/site.ts:101 deletePhoto,:235 deletePhotos,:265 saveProfile contactEmail,:429 deleteAlbum,:509 deleteInquiry; app/actions/galleries.ts:108 emailGalleryLink,:134 deleteGallery | impersonating admin can do irreversible deletes / redirect contact email / send emails, not blocked and not logged | fix: impersonationBlock or log with impersonatedBy | no
A1-3 medium CONFIRMED S | site.ts:429 deleteAlbum, :509 deleteInquiry, galleries.ts:134 deleteGallery | legal hold doesn't block these deletions | fix: legalHold guard in updateUser fn | partly (legal hold notice ticked, photos only)
A1-4 low CONFIRMED S | lib/session.ts:37,:54 | scrypt default N=16384 below OWASP N=2^17 | fix: raise params, versioned hash | no
A1-5 low PLAUSIBLE S | app/actions/auth.ts:175-188 | reset-request timing reveals account existence (Resend call awaited) | fix: after() / fixed delay | no
A1-6 low CONFIRMED S | lib/session.ts:130; app/actions/admin.ts:469 | expired impersonation never logged as ended | fix: show as expired in Log | no
Fine: all actions auth-checked; 17 admin mutating actions requireFullAdmin; impersonationBlock on resend/signout/delete/changeAddress/billing/export; cookie flags httpOnly/secure/lax(strict impersonate) host-only; HMAC timingSafeEqual; reset tokens sha256 1h single-use; Google OAuth state+PKCE+id_token checks.
Not checked: dashboard page reads; billing-webhook logic; rate-limit clientIp; admin extra-site sign-out semantics.

---

AREA 2 data layer (12). Repro tmp/area2/orphan.test.ts
A2-1 medium CONFIRMED-code S | lib/pg.ts:80 Pool, :87-98 transaction client | no 'error' listener -> Neon idle disconnect = uncaught exception kills instance | fix: pool.on('error'), client.on('error'), release(err) | no  (relates I-4)
A2-2 = A3-4 DUP medium CONFIRMED(repro) | lib/cleanup.ts:54; finish/route.ts:41; cleanup.ts:28 | late PUT after delete -> original kept forever | partly
A2-3 low CONFIRMED(repro) S | lib/db.ts:275,:281 | updateUser async fn change lost silently (latent) | fix: throw on thenable | no
A2-4 = A7-4 DUP medium(race) | db.ts:289-309; auth.ts:257-265; admin.ts:420-434 | legal hold not atomic with delete; deleteUser itself never checks
A2-5 = A1-3 DUP
A2-6 = A6-3 DUP
A2-7 = I-1 DUP (preview shares prod DB; schema DDL runs from previews lib/pg.ts:121)
A2-8 low CONFIRMED M | lib/pg.ts:23-76,:121 | DDL on every cold start locks | TRACKED
A2-9 = A5-5 remainder: admin.ts:225 setPlan publicChange:false -> now that main applies forPlan, admin downgrade won't refresh cached site -> verify on main (becomes real)
A2-10 = A1-5 DUP (reset timing; A2 says CONFIRMED-code)
A2-11 = A4-6 DUP (design.ts:596-604 silent legacy fallback)
A2-12 low CONFIRMED S | scripts/backfill-photos.ts:11-45; scripts/import-json.ts:29 | obsolete backfill writes db.json & renames files; import-json doesn't lowercase data.email | fix: delete/fix scripts | no
Fine: updateUser for update + rollback; unique constraints decide races; lowercase; tokens; deleteUser transaction + hold of subdomain; siteChanged everywhere; prod throws w/o DATABASE_URL; R2 removeAll paginates.
MAIN RECHECK: all line numbers valid on main; nothing fixed. A2-9 now LIVE on main: low-medium CONFIRMED S | app/actions/admin.ts:225 setPlan publicChange:false + main lib/public-site.ts:13-19 forPlan, :85 cacheLife 3600/86400 | admin plan change -> live site shows old plan's theme up to ~1h+ | fix: drop publicChange:false | no

---

AREA 3 photos/storage (8). Repros: tmp/area3/ (refinish, exif, short, bomb, tall)
A3-1 high CONFIRMED(repro) S | app/api/photos/finish/route.ts:48,:63; lib/uploads.ts:328-358 | photographer POSTs finish {file:"<id>.orig.jpg"} of taken-down photo -> web copies regenerated at old public URLs, removed still set; finish also ignores suspended | fix: refuse if file belongs to existing photo (esp removed), check before processing; check suspended | no
A3-2 medium CONFIRMED-code M | admin.ts:88 deleteWebCopies; uploads.ts:198 immutable 1y | takedown no CDN purge (DUP A7-6) -- main now serves via /_photos rewrite on Vercel: verify cache layers | no
A3-3 low CONFIRMED(repro) S | app/api/uploads/[userId]/[file]/route.ts:9-13; uploads.ts:38 | Windows 8.3 short name ce9b02~1.jpg serves original (dev/self-host only) | fix: whitelist variant pattern / reject ~ | no
A3-4 low-med CONFIRMED-code S | lib/cleanup.ts:55 | late presigned PUT after account delete leaves original forever | fix: delete orphans of missing accounts | partly (stress test)
A3-5 low CONFIRMED-code S-M | uploads.ts:355; finish route:63; site.ts:110-116; cleanup.ts | orphaned public webp never cleaned | fix: cron lists public keys too | no
A3-6 medium CONFIRMED(measured) S | lib/images.ts:28-53 limitInputPixels default | 762KB PNG 260000x1000 -> 1.1GB RSS; parallel -> OOM | fix: limitInputPixels ~100MP, edge cap, sequential animated | TRACKED (decode once; limitInputPixels left)
A3-7 low CONFIRMED(repro) S | lib/images.ts:60-70 | tall panoramas >16383px at variant width fail with misleading error | fix: fit inside height 16383 | no
A3-8 = A7-7 DUP (legacy no-variants takedown)
Fine: presign signs type+length 600s, server key; finish only own keys; limits rechecked in lock; EXIF/GPS stripped (tested JPEG/PNG/WebP); uploads route blocks .orig any case, traversal; removed filtered; restore remakes copies; delete retries; disk/R2 parity; orphan originals >1d removed.
Not checked: prod R2/CF cache; animated memory; HEIC/AVIF; export streaming; R2 CORS.

---

AREA 4 editor/design/themes (7). Repro: tmp/area4/order.ts
A4-1 medium CONFIRMED(repro) S | lib/design.ts:664 sameDesign JSON.stringify; app/dashboard/design-editor.tsx:54-55,75,86,165 | key order differs after zod parse -> after adding a section/page editor shows "Saving..." forever, beforeunload prompt always, first Undo no-op | fix: order-insensitive compare | no
A4-2 medium CONFIRMED S | lib/public-site.ts:10-16 (withoutProSettings only in app/actions/design.ts:42,69) | downgraded user keeps Pro theme live | TRACKED (HANDOFF next step 3 / BACKLOG:189) DUP w/ A6-11
A4-3 low CONFIRMED S | app/dashboard/manage/design/page.tsx:27-30; design-editor.tsx:78-88 | downgraded user's editor shows Pro draft, server silently strips | fix: pass withoutProSettings(draft) | partly
A4-4 medium CONFIRMED S | lib/design.ts:9,71-80,147-155; app/actions/design.ts:9,49; next.config.ts:17 | no design size cap; 20 history copies -> 40MB+ user row (500MB local) read on every request | fix: cap serialized size 256KB, .max on arrays/ids | partly (stress test; split giant row)
A4-5 low CONFIRMED S | proxy.ts:22 matcher prefix (?!api|...); lib/design.ts:58; lib/site.ts:101 | slugs like "apiary" bypass proxy -> 404 | fix: anchor matcher api/ | no
A4-6 low PLAUSIBLE M | lib/design.ts:577-585 | readDesign falls back to legacy layout silently on parse fail -> future schema tightening wipes sites | fix: log/Sentry + lenient parse | no
A4-7 low CONFIRMED S | app/sites/[subdomain]/metadata.ts:24-26 | og:image uses hidden hero cover | fix: && s.visible | no
Fine: no dangerouslySetInnerHTML; no URL fields; hex colors strict; social links validated; foreign/removed photo ids ignored; slug checks; history cap 20; publish revalidates + Pro check; theme switching keeps content; ReportLink in all 6 themes; Pro picker locked + server enforced.
Not checked: runtime theme rendering; overlapping autosave/publish; photo uploader UI.

---

AREA 5 public sites/routing/cache (7)  [NOTE: reviewed stale polar-billing; origin/main snapshot at tmp/main]
A5-1 medium CONFIRMED(live curl: davidfreeman.folio.cam/apiary -> app 404) S | proxy.ts:22 matcher unanchored (?!api|...) (main adds _photos, same issue) | slugs starting "api" unreachable | fix: anchor api/|api$ | no  (DUP A4-5)
A5-2 medium CONFIRMED (stale? main serves photos via /_photos on site host) S | app/robots.ts:16; lib/site.ts:47 | AI crawler block doesn't cover image host img.foliocdn.com (robots has no rules) | fix: CF block AI bots / X-Robots-Tag | no  -> VERIFY ON MAIN (site robots may now cover /_photos? or direct img host still reachable)
A5-3 low CONFIRMED(live) M | app/sites/[subdomain]/page.tsx:15-26, [slug]/page.tsx, g/[gallery]/page.tsx:20-31 | missing/suspended sites & bad gallery return 200 (notFound inside Suspense) | fix: notFound in generateMetadata / proxy check | no (DUP I-8)
A5-4 low CONFIRMED(live) S | proxy.ts:11-18 | www.folio.cam/sites/davidfreeman renders live site on app host, broken nav links | fix: 404/redirect /sites/* on root host | no
A5-5 medium | galleries + Pro theme after downgrade -> FIXED ON MAIN (galleriesOpen, forPlan). Remaining part: admin.ts:225 setPlan publicChange:false -> plan change doesn't clear public cache, now that live look depends on plan -> low CONFIRMED? VERIFY
A5-6 low CONFIRMED S | app/sites/[subdomain]/site-notice.tsx:41-48 | held (released) address shows "Claim it" | fix: check subdomainOnHold | no
A5-7 low CONFIRMED(live) S | app/sitemap.ts:12; app/robots.ts:30 | app sitemap/robots use folio.cam which 308s to www | fix: www host or flip redirect | no (DUP I-9)
Fine: isLive applied everywhere; cache invalidation on all write paths incl changeSubdomain old+new; host handling; site-preview requireUser; gallery cookie bound to passwordHash.

---

AREA 6 billing/email/limits/cron (11). Repro: tmp/area6/repro.test.ts (run with --import ./tests/setup.ts)
A6-1 high CONFIRMED(repro) S-M | lib/billing-webhook.ts:150, :145 | late/redelivered event with null modified_at skips stale check -> Pro restored after revoke, permanent | fix: store recent event ids/billing_events table; missing modified_at = older | no
A6-2 high CONFIRMED(repro) M | billing-webhook.ts:150,:166 | late event of old sub A overrides newer sub B -> Pro forever; cancel would revoke dead A | fix: per-subscription map, ignore events of revoked subs | no
A6-3 high CONFIRMED M | lib/billing.ts:67-74; app/actions/auth.ts:262; admin.ts:432 | delete proceeds if Polar revoke fails/env unset -> deleted user keeps being charged; later webhooks 200 unknown account silently | fix: block delete or retry queue via cron; revoke all customer subs; alert on unknown-account | no
A6-4 medium PLAUSIBLE S | app/actions/billing.ts:33 | double checkout before webhook -> two subscriptions | fix: Polar org setting single sub per customer | no
A6-5 low CONFIRMED(repro) S | billing-webhook.ts:150 | string compare of timestamps: fractional seconds marks newer event stale | fix: Date.parse | no
A6-6 medium CONFIRMED S | admin.ts:224; billing-webhook.ts:164 | setPlan(free) still marks manual -> paying user stays Free; manual-Pro offered checkout | fix: clear planSource on free; hide checkout | no
A6-7 medium PLAUSIBLE S | lib/billing.ts:36-48 | Polar customer survives delete; re-signup same email -> checkout fails or webhook misrouted | fix: delete Polar customer on delete; sandbox test | no
A6-8 medium PLAUSIBLE S | rate-limit.ts:71, turnstile.ts:132, email.ts:23, billing.ts:24 | no fetch timeouts -> hung Upstash/Cloudflare hangs login/signup | fix: AbortSignal.timeout | partly (BACKLOG 223/399)
A6-9 low CONFIRMED S | lib/rate-limit.ts:76 | refused attempts still ZADDed -> unbounded key growth | fix: ZADD only under limit | partly (BACKLOG:625 lockout)
A6-10 low CONFIRMED S | lib/cleanup.ts:45-59 | cron deletes orphan originals of legal-hold accounts | fix: skip legalHold | no
A6-11 medium CONFIRMED | lib/plans.ts galleryLimit; billing-webhook.ts:181 | downgrade keeps galleries + Pro themes live | TRACKED (BACKLOG:189)
Fine: webhook signature (raw body, multi v1, timingSafeEqual, 5 min window, whsec decode); concurrent dup deliveries serialized by row lock; account lookup server-set; checkout guarded; Pro statuses; cron secret timingSafe, 404 unset, reminders capped/idempotent; prod email throws; clientIp prefers x-vercel-forwarded-for; Turnstile fail-open only on CF outage.
Not checked: real Polar payloads/settings; all sendEmail callers; listOriginals scale.

---

AREA 7 legal/reports (14)
A7-1 high CONFIRMED S | app/api/export/route.ts:13-15 (lib/db.ts:149) | export includes legalHold {at,note} -> photographer learns of hold + staff note | fix: delete account.legalHold (and internal removed.note, strike ids) | no
A7-2 medium CONFIRMED S | app/actions/site.ts:114,:251 errors say "legal hold"; app/admin/sites/[subdomain]/page.tsx:39 Notify default ticked on held accounts; draft-reminder cron + billing emails ignore legalHold | fix: neutral wording, default notify off when held, skip held in accountsToRemindAboutDraft | partly (owner decision: may a hold be revealed?)
A7-3 = A1-3 (legal hold vs deleteInquiry/deleteGallery/deleteAlbum) DUP
A7-4 low PLAUSIBLE S | app/actions/auth.ts:257-266; admin.ts:419-434 | legalHold checked outside lock before deleteUser -> race | fix: delete ... where legalHold is null | no
A7-5 medium CONFIRMED M | lib/db.ts:461 addReport, :524 reportsForSite, :365 changeSubdomain; admin.ts:74 | reports keyed by subdomain -> new owner of released address inherits old reports, can get strike/email of old notice | fix: store user_id on reports | no
A7-6 medium PLAUSIBLE M | lib/uploads.ts:387 deleteWebCopies, :198 immutable 1y | takedown doesn't purge Cloudflare edge cache (1 day) | fix: purge-by-URL or shorter edge TTL | no
A7-7 low PLAUSIBLE S | lib/uploads.ts:385-391,:266 | legacy photos without variants: takedown deletes nothing, file stays public | fix: delete/move public file | no
A7-8 low CONFIRMED M | admin.ts:104-107; lib/admin.ts:30 | strike limit no auto action; re-signup with same email resets strikes | fix: auto-suspend/flag; hashed blocklist | no
A7-9 low CONFIRMED S | admin.ts:137-142 | disputed restore of 1 of 3 photos removes the whole strike | fix: remove only when no photo still removed for that report | no
A7-10 low CONFIRMED M | lib/admin-emails.ts:48-60; admin.ts:111 | counter-notices not tracked, 10-14 day restore window not tracked | fix: record date, show restore due | no
A7-11 low CONFIRMED S | lib/admin-emails.ts:33 | legacy copyright reports w/o structured notice forward full details (may contain address/phone) | fix: omit details | no
A7-12 low PLAUSIBLE S | app/actions/report.ts:17,:44,:103 | no Turnstile on report forms | fix: verifyTurnstile | no
A7-13 low CONFIRMED S | app/sites/[subdomain]/g/[gallery]/page.tsx | no ReportLink on client galleries | fix: add | no
A7-14 low CONFIRMED M | lib/db.ts:107,:243 | termsAcceptedAt has no version; no re-accept after lawyer text | fix: termsVersion | related owner item 5
Fine: DMCA fields required server-side; address/phone stripped; abuse reports anonymous; strikes 1 per notice; removed photos filtered public/gallery/zip; hold blocks photo+account deletes; terms checkbox enforced; ReportLink in 6 themes; export excludes passwordHash/adminNotes.
Not checked: legal wording; clientIp trust; Cloudflare cache rule; admin report UI for viewers; billing emails on held accounts.

---

REVIEW 8 security (9), lines vs MAIN snapshot
S-1 high CONFIRMED-code S | lib/auth.ts:17-21 adminRole (used :59-115) | staff role by email string w/o emailVerified -> anyone signing up with a listed staff email that has no account yet gets /admin (latent; opens whenever staff email added) | fix: require emailVerified + test | no
S-2 = A1-1 DUP medium (Google pre-account hijack)
S-3 = A3-2/A7-6/P-6 DUP (cache purge; main /_photos rewrite next.config.ts:23-26 may add Vercel cache layer)
S-4 = A3-6 DUP TRACKED (limitInputPixels)
S-5 = A1-2 DUP (+ setPublished site.ts:257, updateGallery galleries.ts:55)
S-6 low CONFIRMED S | app/actions/galleries.ts:108-131 | emailGalleryLink: unverified sender, any recipient, free text -> phishing from Folio domain; no galleriesOpen check | fix: emailVerified, galleriesOpen, global cap | no
S-7 low CONFIRMED S | app/actions/site.ts:408-418 setAlbumPhotos | no zod validation/length cap | no
S-8 = I-13 (+ no form-action) lib/security-headers.ts:31-44 low
S-9 low PLAUSIBLE S | app/sites/[subdomain]/metadata.ts:28; classic.tsx:210 fallback site.photos[0] | gallery-only photo can become public cover/og:image | partly (BACKLOG:185)
Fixed on main: galleriesOpen on all gallery entry points; forPlan.
TEST GAPS: gallery actions (createGallery, updateGallery, setGalleryPhotos, emailGalleryLink, deleteGallery, unlockGallery, toggleFavourite) not in ownership/signed-out (galleries.test.ts:94 partial); no signed-out test for updateGallery/emailGalleryLink/deleteGallery; no cross-account for emailGalleryLink/deleteGallery; signed-out only (no ownership): saveAiTraining, changeAddress, uploadPhotos, createSite, switchSite (foreign siteId untested); route handlers in neither file (export, photos start/finish, uploads, gallery download, verify-email, google callback, billing webhook) - have own tests; no test that finish with another user's filename fails; no tests for S-1, S-2.
Fine: ownership everywhere; SQL parameterised; no innerHTML; no open redirects; no SSRF; cookies; tokens; webhook; cron; uploads; CSRF via Next origin; no secrets client-side; prod headers; /_photos rewrite fixed host, not open proxy, encoded .. 400; pricing static; export strips.
Not checked: whether Vercel external rewrite forwards session cookie to img.foliocdn.com; Vercel edge caching of /_photos; R2 CORS/policies; Host spoof into Polar success_url (billing.ts:12).

---

REVIEW 10 perf/reliability (17). Bench tmp/perf/ (1500 photos+500 inquiries = 870KB JSON, ~100KB compressed; designHistory ~30KB)
P-1 high CONFIRMED M | lib/zip.ts:28-55 (no ZIP64); app/api/export/route.ts (no maxDuration) | export >4GB throws mid-stream -> corrupt zip; long exports hit duration | fix: ZIP64 or background export to R2 + email | partly (stress test)
P-2 medium CONFIRMED S | lib/auth.ts:41-79 no React cache(); dashboard/layout.tsx (4), manage/layout.tsx (2) | ~7 full-row reads per dashboard render; ~8MB per autosave | fix: cache() | partly
P-3 medium CONFIRMED S/L | lib/db.ts:199-206,275-288,186-190 | every write rewrites ~870KB; public reads fetch inquiries/history | fix: trimmed public select; split tables | TRACKED (split) / trimmed select no
P-4 = A3-5 DUP medium (orphan public web copies) site.ts:100-116; cleanup.ts:44-61; uploads.ts:378-386
P-5 high CONFIRMED S | app/actions/admin.ts:66-100 takeDownPhotos | photos marked removed, then deleteWebCopies throws (R2 error) -> retry says "Nothing changed", copies stay public, no log/email | fix: retry includes already-removed; log first | no
P-6 = A3-2/A7-6 DUP (CDN purge)
P-7 medium CONFIRMED S | app/api/photos/start/route.ts:6,27; lib/photo-upload.ts:120-133 | 500 starts/hour blocks Pro 800-photo import | fix: count unfinished / remaining slots | no
P-8 = A6-8 DUP (timeouts) + R2 send lib/uploads.ts:166
P-9 = A2-1 DUP (+ no connectionTimeoutMillis, attachDatabasePool) lib/pg.ts:81-84
P-10 medium PLAUSIBLE S/M | lib/public-site.ts:78-99; db.ts:266-268 | default use-cache handler per-instance -> revalidateTag on one instance doesn't clear others -> stale site up to 1h | fix: test in prod; 'use cache: remote' | no
P-11 medium PLAUSIBLE S | lib/images.ts:26-71; finish route:14 | concurrent finishes on one Fluid instance -> OOM | fix: limit concurrency 2, sharp.concurrency(1) | partly (relates A3-6)
P-12 low CONFIRMED S | auth.ts:263-266; admin.ts:432-435; uploads.ts:228-242 | account delete deletes 6000 objects 10 at a time in request | fix: DeleteObjects batch / after() | partly
P-13 low PLAUSIBLE M | cron/daily route (no maxDuration); cleanup.ts:44-61,64-88 | cron lists whole bucket, scales badly | partly
P-14 low CONFIRMED S | app/actions/auth.ts:179 requestPasswordReset, :217 resendVerification | Resend down -> crash page | fix: try/catch | partly
P-15 = A6-3 DUP
P-16 low CONFIRMED S | lib/db.ts:420-430,606-690; admin.ts:255-295 | admin overview scans all accounts; rights backfill rescans | no
P-17 = A2-8 DUP TRACKED
Fine: no async updateUser fns, no work under lock; revalidateTag(tag,{expire:0}) valid; streams bounded; maxDuration 60 finish; admin lists paginated; Redis error fallback; R2 retries.
MAIN RECHECK: all P-1..P-17 still present on main (lines: P-1 lib/zip.ts:47,58; P-2 lib/auth.ts:41,73; P-5 admin.ts:67; P-8 uploads.ts:150; P-9 pg.ts:80).
N-1 (new on main) medium PLAUSIBLE S | next.config.ts:23-26 rewrite; lib/uploads.ts:258-260 photoUrl | all photo bytes go through Vercel edge -> count against Hobby Fast Data Transfer (100GB); over quota pauses whole project. Orchestrator curl 2026-10-26: x-vercel-cache MISS then HIT, cf-cache-status HIT -> Vercel DOES cache (agent's "uncached" claim DISPROVED); bandwidth part stands; adds a 2nd cache layer that takedowns don't purge (worsens P-6). fix: watch usage; serve img.foliocdn.com directly with /_photos only as fallback; purge both caches on takedown | no
N-2 = A2-9 DUP (setPlan publicChange:false live on main)
Note: app/actions/design.ts:48-52 saveDraftDesign stores forPlan-stripped design into designHistory for Free accounts -> undo loses Pro choices after downgrade (correctness, unverified)

---

REVIEW 11 a11y (18). scripts tmp/a11y/c.js d.js. Tracked partly: BACKLOG:232/:417 keyboard+SR lightbox/editor untested
X-1 high CONFIRMED S | app/globals.css:14 --color-ink-faint #958f84 (54 uses: signup hints, device tabs, Show/Hide, editor) | 2.80:1 on paper, 3.03 card | 1.4.3 | fix darken ~#6f6a61 | no
X-2 high CONFIRMED S | lib/design.ts:282-378; themes/monograph.tsx:16-17; exhibition.tsx:20 | muted default fails in 8/17 looks (sorbet 2.91..concrete 4.38), monograph cream 3.35 | nav/captions/footer | fix darken defaults; editor contrast warning | no
X-3 medium CONFIRMED S | classic.tsx:401,410; contact-form.tsx:97; contactsheet.tsx:45,105; index accent | accent 3.74-4.35 | no
X-4 medium CONFIRMED S | app/sites/[subdomain]/contact-form.tsx:101 text-red-500 | 2.56-3.81 | no
X-5 medium CONFIRMED S | app/ui/signup-form.tsx:72,:97; signup/google/form.tsx:11,61; app/ui/address-claim.tsx:18-29; themes/sideways-scroller.tsx:52-55; dashboard/photo-uploader.tsx:185-215 | no visible focus | 2.4.7 | focus-within | no
X-6 high CONFIRMED S | dashboard/editor.tsx:332-333; photo-drawer.tsx:19-44 | key on drawer remounts -> Next focuses Previous; SR re-announces | 2.4.3/2.1.1 | key PhotoDetails | no
X-7 medium CONFIRMED S-M | editor.tsx:321-322; albums.tsx:124-125; design/sections.tsx:115-116; design-editor.tsx:316-317 | reorder button disabled at ends drops focus, no live announce | partly
X-8 medium PLAUSIBLE S | editor.tsx:267-285,:320 | touch can't reorder (HTML5 drag, buttons opacity-0) | 2.5.1 | partly
X-9 medium CONFIRMED S | app/ui/signup-form.tsx:141-149 (+google form) | address availability not announced | 4.1.3 | no
X-10 high(gallery)/medium CONFIRMED S | lib/uploads.ts:419; lightbox.tsx:256; g/[gallery]/photo-grid.tsx:37-42 | empty alt; gallery links have no name (prod: 21 alt="") | 1.1.1/2.4.4 | fallback label "Photo n of m"; prompt alt | no
X-11 low CONFIRMED S | photo-grid.tsx:49-59 | identical heart labels | no
X-12 medium CONFIRMED S | lightbox.tsx:122-130,:226-230 | photo change not announced | partly
X-13 medium CONFIRMED S | dashboard/layout.tsx, (auth)/layout.tsx, (legal)/layout.tsx, themes/exhibition.tsx:60-100 | no main landmark / skip link | 2.4.1 | no
X-14 low CONFIRMED S | contact-form.tsx:50; ui/form.tsx:24 | input borders 1.46-2.0:1 | 1.4.11 | no
X-15 low CONFIRMED S | dashboard/layout.tsx:88-104 | account menu no Escape/outside close | no
X-16 low PLAUSIBLE S | app/ui/form.tsx:15-19 | hint inside label pollutes accessible name | no
X-17 low PLAUSIBLE S | dashboard/design/ui.tsx:85-96 | icon buttons <24px (2.2 advisory) | no
X-18 low CONFIRMED S | contact-form.tsx:42 | smooth scroll ignores reduced motion (AAA) | no
Fine: lang, viewport, landmarks on landing, lightbox dialog/trap/Esc, labelled inputs, aria-live save status, reduced-motion landing.
Not checked: real SR/keyboard, zoom/reflow, admin, billing page, custom colours, signed-in prod.
MAIN DELTAS: none fixed on main. X-10 now lib/uploads.ts:422.
X-19 medium CONFIRMED S | app/pricing/page.tsx:98; app/page.tsx:82,:233 | ink-faint on new pricing/landing (extends X-1)
X-20 low PLAUSIBLE S | app/pricing/page.tsx:93-94 | comparison table overflow wrapper not focusable for keyboard scroll | 2.1.1/1.4.10

---

REVIEW 12 prod/infra (16). Production = origin/main 1fd2baa (local polar-billing is 15 behind). CSP ENFORCED on prod.
I-1 high CONFIRMED M | Vercel env: DATABASE_URL, SESSION_SECRET, R2_*, UPSTASH_*, ADMIN_EMAILS shared Production+Preview | previews hit prod DB/buckets; preview-minted cookie valid on prod; protection-bypass secret embedded in Polar sandbox webhook URL | fix: Neon branch, separate buckets+SESSION_SECRET, delete bypass secret | partly (staging item)
I-2 medium CONFIRMED S | Vercel Hobby | commercial use forbidden; logs kept 1h, no drain | fix: Pro + log drain | partly (Vercel Pro before money)
I-3 low CONFIRMED S | DATABASE_URL sslmode | 347 warning events/7d bury real errors | fix: sslmode=verify-full (owner) | no
I-4 low CONFIRMED S | lib/pg.ts / /verify-email | "Connection terminated unexpectedly" x2 on 10-21 | fix: pooled URL, idleTimeout, retry | no
I-5 low-med CONFIRMED S | app/(auth)/signup/google/page.tsx -> lib/google.ts ~78 Date.now() | prerender unstable value error at runtime 10-26 | fix: await connection() | no
I-6 low CONFIRMED S | app/api/auth/google/start/route.ts:6-12 | try/catch swallows Next prerender bailout, logs false "not configured" at build | fix: unstable_rethrow / connection() outside try | no
I-7 medium PLAUSIBLE S | instrumentation.ts | server errors not reaching Sentry (only 1 client issue; I-5 error missing) | fix: test error on preview, check register nodejs | partly
I-8 = A5-3 soft 404 DUP
I-9 = A5-7 DUP
I-10 medium CONFIRMED S | DNS _dmarc.folio.cam missing | spam/spoofing | fix: add DMARC p=none (owner) | no
I-11 info CONFIRMED | POLAR_* Preview only; sandbox token expires 2026-11-25 | tracked
I-12 low PLAUSIBLE S | R2 r2.dev URL enabled | tracked (item 7)
I-13 low-med CONFIRMED L | lib/security-headers.ts script-src 'unsafe-inline' | weak XSS defense | nonce CSP | no
I-14 low CONFIRMED S | apex HSTS no includeSubDomains/preload | no
I-15 low CONFIRMED S | docs: GOOGLE_CLIENT_ID/SECRET not in env tables; README table missing rows; lib/security-headers.ts:6 says report-only | no
I-16 medium PLAUSIBLE M | Neon backups/PITR untested | fix: confirm PITR, nightly dump, restore drill | no (CLAUDE.md step 3 only)
Health: prod deploy READY main@1fd2baa Next 16.4.2; last 20 deploys READY; Sentry 1 issue FOLIO-1 TurnstileError 600010 /signup; domains+certs OK (*.folio.cam to 2027-01-16, img.foliocdn.com to 2027-01-23); cron 404 w/o secret; headers good. README checklist: all infra done; open: LEGAL_DRAFT, Vercel Pro, prod Polar, staging, backups.
Not checked: logs >1h, Neon/Cloudflare/Resend/Upstash/Polar/Google consoles, env values, Vercel cron list, WAF.

---

REVIEW 13 docs/backlog (15 + drift). Compared Claude Doc rev 620 vs local + origin/main BACKLOG.md
D-1 low CONFIRMED | CLAUDE.md:29, README.md:41 vs .github/workflows/ci.yml:6-7 | CI list omits Playwright e2e; README says main+PRs but CI runs on every push
D-2 medium CONFIRMED | CLAUDE.md env table :86-101, README :72-86 vs lib/google.ts:35-42 | GOOGLE_CLIENT_ID/SECRET undocumented (DUP I-15)
D-3 medium CONFIRMED | README.md:72-86 | env table missing ADMIN_VIEWER_EMAILS, Turnstile, CRON_SECRET, SENTRY, GOOGLE
D-4 low CONFIRMED | CLAUDE.md:64 vs lib/db.ts:285 | "any account change refreshes" but publicChange:false skips
D-5 low CONFIRMED | CLAUDE.md:75-76, README:128,130 | startPhotoUpload/finishPhotoUpload are routes /api/photos/start|finish
D-6 low CONFIRMED | CLAUDE.md:77 | PhotoUploader is app/dashboard/photo-uploader.tsx:39
D-7 low CONFIRMED | CLAUDE.md:57,:66 | themes/ is app/sites/[subdomain]/themes/
D-8 low CONFIRMED | README.md:159 | "cleanup job can come later" - cron exists
D-9 low CONFIRMED | README.md:34-39 | scripts table missing test:e2e, homepage-photos, seed-examples
D-10 low CONFIRMED | CLAUDE.md:57 | storage limit (uploadBlock/storageLimit 5GB/50GB), galleryLimit, galleries undocumented
D-11 low | CLAUDE.md launch plan stale locally (fixed on main); main still lists Sentry as todo
D-12 low CONFIRMED | playwright.config.ts:6 says production build, :16 runs dev
D-13 low CONFIRMED | docs/BACKLOG.md:32 + HANDOFF cite docs/LAWYER-BRIEF.md (missing; real file LEGAL-REVIEW-BRIEF.md only on owner-all); Claude Doc item 11 cites LAUNCH-READINESS.md (only owner-all)
D-14 low CONFIRMED | BACKLOG.md:634 says galleries download/expiry/favourites/email not done (they are); :156 error.tsx/not-found exist; :22/:17 waiting list stale; :636 Stripe/Paddle (local)
D-15 low CONFIRMED | HANDOFF previous-work stale (UNCOMMITTED, CSP report-only, owner list)
Numbers verified ok: 150/1500, STRIKE_LIMIT 3, ADDRESS_HOLD_MONTHS 12, history 20 (+30s grouping), presign 10m, 640/1280/2048, 20MB, LEGAL_DRAFT true, NEW_SITES_START_PUBLISHED false, cron 04:00.
DRIFT (doc vs origin/main md):
- Phase 1 design polish (~57 items) + per-area sections (~57): [x] in md, [ ] in Doc -> 114 items unticked in Doc (Doc wrong)
- Owner 6 DMCA, 8 example photos, Phase 3 example sites, Landing example sites, Phase 4 payments: local stale only; main = Doc
- Owner 5 lawyer: wording differs; Doc newer (LEGAL-REVIEW-BRIEF on owner-all); md file ref broken
- Owner 9/10/1: wording only
- Owner 11 launch: Doc-only note cites LAUNCH-READINESS.md, now stale
- Phase 2 Turnstile covers *.folio.cam & test upload: md [ ] (:162,:164 also main), Doc [x] -> md wrong
- Drafts/reminder: md two [x] items :125-126; Doc one combined [ ]
- Sign-up Terms/Google: md [x] :290; Doc [ ] "consider Google"
- Status table Phase 2/3 rows + "Waiting on owner": md stale; Doc has "mountain example photos location" item only
- Decisions / Agent context §3-§8 rendered as unticked checklists in Doc (format drift)
- Agent context CI row: Doc lacks Playwright; infra table: Doc lacks CRON_SECRET; neither has ADMIN_VIEWER_EMAILS/POLAR_*
- Agent context §8 Legal and launch bullet Doc-only; file map Doc stale (no photo-uploader etc)
- Galleries "not done" note stale in both; snapshot dates Oct 25 in both
Open-and-still-open spot checks: fonts on all pages, schema at deploy, theme preview demo link, split tables, staging, stress tests.
MAIN RECHECK: D-1..D-15 confirmed on main (CLAUDE.md lines shift +2: env table :88-103, :66 publicChange, :77-79). D-11 narrowed: only "Sentry" still listed as todo at CLAUDE.md:114. D-15 applies to MAIN HANDOFF.md too (:29 CSP report-only, :41-42 owner list, :52-53 DMCA vs :24 DONE).
D-3b low (new on main) | scripts/seed-examples.ts:141,145 EXAMPLES_OWNER_EMAIL, EXAMPLES_PHOTOS_DIR undocumented
Drift table = the "origin/main" rows above (main BACKLOG identical to git show origin/main).
