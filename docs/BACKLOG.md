# Folio — Improvement Backlog

Updated Oct 25, 2026 (after Phase 3) · Davi · Live, editable version (may be newer): https://claude.ai/artifact/2GPiZULFPDtucJhJ5WCXXF

**For coding agents:** read the Agent context section at the end of this file first, then `CLAUDE.md` and `AGENTS.md`.

Every suggestion from the code review, the landing-page critique and the dashboard walkthrough, grouped by the part of Folio it changes. Tick items off as you ship them; delete anything you disagree with.

**Start here (biggest wins):** orphaned R2 uploads, image decoding memory, public cache busting on draft edits, security headers, a working address box on the landing page, a branded 404, "Take offline" out of the header, a pinned design preview, bulk photo editing, autosave, step progress ticks.

## Status right now

| Phase | State |
| --- | --- |
| 0 Setup | Done |
| 1 Design polish | Done and live on `main`, except two small items (demo sites per theme, Instagram link in footer) |
| 2 Security | Merged into `main`; waiting on the owner checks below |
| 3 Legal & launch (Free) | Code done and merged. Left: lawyer-reviewed Terms/Privacy, photo domain, example sites, launch |
| 4 Folio Pro | Paused between items. Started: 1,500-photo limit, 20-gallery limit, password-protected client galleries, staff can switch an account to Pro. Editable special themes are done. Left: more themes, payments, 50 GB limit, lawyer review, launch |
| 5 Speed & scale | Four items done (image decode, private changes keep the cache, streaming export, per-page photos). Left: split tables, schema at deploy, fonts, staging and stress tests |

**Waiting on the owner:** `CRON_SECRET` in Vercel; Turnstile hostnames; browser-console CSP check; test photo upload on folio.cam; legal text and review; DMCA agent registration with the Copyright Office; photo domain; example site photos; payment provider choice.

## Everything checklist, by phase

Every item in this doc, in the order you chose: design → security → legal → speed. Tick items here; the sections further down keep the longer explanations.

### Phase 0 — Setup (you)

- [x] Paste the pooled Neon address into Vercel DATABASE_URL (Production + Preview) and redeploy
- [x] Set Vercel function region to Frankfurt (fra1)
- [x] Create a free Upstash Redis database; add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel
- [x] Create a free Sentry account + Next.js project; send me the DSN
- [x] Create a Cloudflare Turnstile widget for folio.cam; send me the site key, put the secret in Vercel
- [x] Create a Google OAuth client for "Continue with Google"; add client ID + secret to Vercel
- [x] Move `data/dev-test-account.txt` out of OneDrive
- [x] Approve a Pro price: chosen $12/mo or $120/yr launch price (1,500 photos, 20 client galleries, 50 GB)

### Phase 1 — Design polish

**Landing page**

- [x] Make the "yourname.folio.cam" box a real input with a live availability check that carries into sign-up
- [x] Fix theme previews showing empty boxes while scrolling (placeholders, load before view)
- [ ] Make each theme preview open a full demo site
- [x] Replace the duplicate hero "Log in" with "See an example"
- [x] Add a pricing / FAQ teaser ("Free. Pro coming soon.")
- [ ] Fill the footer: Terms, Privacy, contact (done), Instagram (needs owner)
- [x] Shorten the hero on phones so the contact sheet shows on the first screen

**Sign-up & log in**

- [x] Tie field hints to inputs with aria-describedby (labels are already linked; checked in code)
- [x] Live site-address check (✓ / ✗) while typing
- [x] Keep the password after a failed submit; focus the wrong field
- [x] Folio-styled inline errors instead of the browser bubble
- [x] Red border on the field in error
- [x] Show-password toggle + "you can change it later" hint under the address
- [x] Add "Continue with Google"
- [x] Own tab title per page ("Create your site · Folio")

**Error & empty pages**

- [x] Branded 404 for folio.cam linking home and sign-up
- [x] "Claim this address →" on "This site doesn't exist yet"
- [x] "Temporarily offline" page for offline sites, in the photographer's theme
- [x] Clear notice when a site is hidden because the email isn't verified

**Dashboard frame & navigation**

- [x] Move "Take offline" out of the header; put "View site ↗" / "Publish" there
- [x] Slim the pinned header (about 180 px today)
- [x] Put "Log out" in an account menu
- [x] Keep the header the same on every page
- [x] Stop the step strip scrolling sideways; collapse it on narrow widths
- [x] ✓ on finished steps + "2 of 5 done"
- [x] Send new users to Upload (step 1)
- [x] Make "Preview website" a button labelled draft or live
- [x] Site switcher closes on outside click and works with arrow keys
- [x] Unmissable "verify your email" banner
- [x] Replace browser `confirm()` pop-ups with Folio dialogs or undo toasts
- [ ] Dashboard works well on laptop, tablet and phone (built responsive; still needs a hands-on check on real devices)

**Photos & albums**

- [x] Denser photo grid (4–6 per row) with a size slider
- [x] Quiet marker instead of red "No description" on every photo
- [x] Multi-select: caption, location, album, delete many at once
- [x] Autosave in the photo drawer
- [x] Neutral placeholders ("Add a caption…")
- [x] Photo drawer: trap focus and return it on close (labels and dialog role already in place)
- [x] Albums empty state explaining why, create form in a dialog
- [x] "New album from selection"
- [x] Tell users when a delete didn't happen (legal hold)

**Web design editor**

- [x] Live preview visible while editing at every width
- [x] Theme first, before Pages and Sections
- [x] Previous render or labelled spinner while the preview loads
- [x] Hide the "Describe a change … coming soon" box (keep it for Frank later)
- [x] Autosave drafts; one Publish button + "Draft saved" status
- [x] "3 unpublished changes" status
- [x] Already done in code (named buttons, `aria-pressed`)
- [x] Explain on theme cards that special themes set their own layout (editable on Pro)

**Go live, Account & Messages**

- [x] New sites start as drafts
- [x] Reminder email if a site is still a draft after a few days (Vercel Cron)
- [x] Optional quality checks on Go live: captions, About text, contact details
- [x] "Take offline" shown once, on Go live only
- [x] Move name, bio and contact details into Web design (About page)
- [x] Contact email hidden by default, with a prominent switch to make it public
- [x] Validate social links (Instagram handle, not any URL)
- [x] "Change address" as a secondary button with an old → new confirm
- [x] Name the "other site" in the delete-account warning
- [x] Better Messages empty state

**Public sites & lightbox**

- [x] Trap focus in the lightbox
- [x] A URL and history entry per photo (`?photo=3`), Back closes the viewer
- [x] Preload next/previous; fade in from the small version
- [x] Swipe follows the finger
- [x] Controls on dark backing circles
- [x] "Inquire about this photo" button that pre-fills the contact form

### Phase 2 — Security & abuse

- [x] Turn on Upstash rate limits; read the client IP from Vercel's trusted header
- [x] Limit upload starts per user and delete orphaned uploads on a schedule
- [x] Replace the per-account login lockout with per-IP limits + slowdown (no CAPTCHA after failures yet)
- [x] Equalize login timing for unknown emails
- [x] Shrink server-action body limits; validate inputs in `updatePhoto` / `reorderPhotos`
- [x] Security headers: HSTS, `frame-ancestors` enforced; full CSP is report-only until checked in a browser
- [x] Cheap "not found" caching for random subdomains (per-IP limit would be a Vercel firewall rule)
- [x] Turnstile on the contact form and sign-up
- [x] Keep the login email off public site data
- [x] Sentry and the crash page are live; still add `error.tsx` and a root `not-found.tsx`
- [x] Log and retry storage cleanup when an account is deleted

**Phase 2 follow-ups (you)**

- [ ] Add `CRON_SECRET` in Vercel so the daily cleanup job runs
- [ ] Make sure the Turnstile widget covers `folio.cam` and `*.folio.cam`; test sign-up and a contact form
- [ ] Check the browser console on folio.cam for report-only CSP messages, then enforce the full policy
- [ ] Test photo upload on folio.cam (Phase 2 and 3 are merged)
- [ ] Optional: CAPTCHA after repeated failed logins; Vercel Firewall rule for floods of unknown subdomains

### Phase 3 — Legal & launch (Free plan)

- [x] Terms and Privacy pages (DRAFT text in app/(legal); owner still wants a generator/lawyer pass, then set LEGAL_DRAFT=false in lib/legal.ts)
- [x] Copyright / DMCA page from the existing takedown flow (/copyright)
- [x] Terms & Privacy consent at sign-up (checkbox, User.termsAcceptedAt)
- [ ] Photo domain: second domain on Cloudflare connected to R2; update `R2_PUBLIC_URL`
- [ ] Build 3 polished example sites + "Made with Folio" section
- [x] Free plan limit: 150 photos (lib/plans.ts); one site (extra sites are admin-only) and the four themes with uneditable special themes already match Free
- [x] Browser tests for sign-up → upload → design → publish (Playwright, `npm run test:e2e`, tests/e2e)
- [x] Split `design-editor.tsx` (done) and `editor.tsx` (done: photo-uploader.tsx, photo-drawer.tsx) into smaller components
- [x] Update HANDOFF.md and CLAUDE.md; rename `package.json` to "folio" (there is no Folio.md)
- [ ] **Launch the Free plan**

### Phase 4 — Folio Pro

- [ ] Pro limits in code: 1,500 photos and 20 client galleries are done (`lib/plans.ts`); the 50 GB storage limit is not ($12/mo, $120/yr launch price)
- [x] Editable special themes (Exhibition, Index, Film Strip) for Pro: three extra settings each in `themeSettings.<theme>.pro` (mat/print size/label typeface; row size/title case/year column; frame size/border/sprockets); the server resets them for Free accounts, the editor shows them locked
- [ ] More special themes for Pro
- [x] Password-protected client galleries (Pro; dashboard "Client galleries", public link `name.folio.cam/g/<random>`, password cookie tied to the password, attempt limits, hidden from search; a link is private but the image files behind it are the same public web copies)
- [x] Staff can move an account to Pro or Free by hand (admin site page, logged) until payments exist
- [ ] Client gallery follow-ups: download-all zip, expiry dates, client favourites, email the link to the client, a "Made with Folio" footer on galleries
- [ ] Payments + full pricing page
- [ ] Lawyer review of Terms, Privacy and Copyright before charging
- [ ] **Launch Pro**

### Phase 5 — Speed & scale (once real users arrive)

- [ ] Split photos and inquiries into their own tables (short maintenance window)
- [x] Send only the photos each public page shows (already true: only each page's own photos reach the browser, through its Lightbox props)
- [x] Stop private changes clearing the public cache (drafts, messages, legal holds, sign-out-everywhere)
- [ ] Run database setup at deploy time, not on cold starts
- [x] Decode each image once (done); lower `limitInputPixels` (left as is: needs a real-world photo-size decision)
- [x] Stream the account export (lib/zip.ts zipChunks, one photo in memory at a time)
- [ ] Load Folio's own fonts only on Folio's pages
- [ ] Set up a staging copy (Vercel preview + Neon branch + separate R2 buckets)

**Stress tests (on staging)**

- [ ] 500 visitors on one site for 5 minutes: p95 under 1 s, no 5xx
- [ ] Same on a 2,000-photo site: page size, time to first photo
- [ ] 10,000 random-subdomain requests: database load, memory
- [ ] Load while the owner autosaves every second
- [ ] 50 parallel requests right after a deploy
- [ ] 50 parallel uploads by one user
- [ ] Two tabs uploading to one account
- [ ] 15,000 × 15,000 PNG and a huge animated GIF
- [ ] Fake images (renamed .exe, broken JPEG, HEIC)
- [ ] 1,000 upload starts without finishing
- [ ] Delete the account mid-upload
- [ ] R2 returning 503
- [ ] 1,000 sign-ups from one and from rotating IPs
- [ ] 6 wrong passwords on a real account
- [ ] 200 contact messages to one site from many IPs
- [ ] Reset/verify links used twice, expired, opened by link scanners
- [ ] "Sign out everywhere" on another browser
- [ ] Rate limiting with Upstash down
- [ ] Export a 2,000-photo account
- [ ] 500 inquiries + full undo history: login and dashboard speed
- [ ] 100 albums and a very large design
- [ ] Resend down
- [ ] Neon connection limit hit
- [ ] R2 slow (2 s+ per request)
- [ ] Each theme on slow 3G (Lighthouse): LCP under 2.5 s
- [ ] iPhone SE width, landscape, 200% zoom
- [ ] Keyboard-only and screen reader in lightbox and editor
- [ ] Safari, Firefox, Chrome on Android

### Phase 6 — Later

- [x] Full admin options: roles, audit log, site switcher (done in `/admin`)
- [ ] Frank (AI assistant) and the "Describe a change" box

## Security & abuse

- [x] **Clean up orphaned direct uploads.** `/api/photos/start` hands out R2 upload URLs with no per-user limit, and an original that never reaches `/finish` is never deleted. A free account can fill the bucket. Rate-limit `start` and add a scheduled job that removes originals no photo record points to.
- [x] **Stop login lockout of other people.** Five wrong passwords against any email blocks that account for 15 minutes. Prefer per-IP limits plus a CAPTCHA or slowdown after failures instead of a hard per-account lock.
- [x] **Make rate limits real in production.** Without the Upstash env vars, limits are counted per serverless instance, which is close to no limit. Confirm Upstash is set on Vercel, and read the client IP from Vercel's trusted header instead of the first `x-forwarded-for` value.
- [x] **Equalize login timing.** When the email doesn't exist, the scrypt check is skipped, so the reply is faster and reveals which emails have accounts. Run a dummy hash on the not-found path.
- [x] **Shrink the server-action body limit.** `bodySizeLimit: "25mb"` applies to login and the contact form too. Keep large bodies only on upload routes, and validate inputs in `updatePhoto` and `reorderPhotos` (types, array lengths) so bad input is rejected cleanly instead of throwing a 500.
- [x] **Add security headers.** No CSP, HSTS or `frame-ancestors`, so the dashboard (including delete account) can be framed by another site. Set them in `next.config.ts` headers.
- [x] **Guard against random-subdomain floods.** With wildcard DNS, every made-up `xyz.folio.cam` costs a database lookup and a cache entry. Cache "not found" cheaply and rate-limit unknown hosts.
- [x] **Stronger contact-form spam protection.** A hidden honeypot field and a per-IP limit won't stop distributed spam. Add Turnstile or similar.
- [x] **Keep the login email off public sites by default.** `contactEmail` starts as the sign-up email and is sent in the site data. Ask for a public contact email, or hide it until set.

## Performance & scaling

- [ ] **Split the giant user row.** Each account is one JSON row holding photos, albums, up to 500 inquiries, the design and its undo history. Every login, dashboard click and public cache miss loads and rewrites all of it, password hash included. Move photos and inquiries into their own tables.
- [x] **Send only the photos a page shows.** `SiteData.photos` carries every photo (up to 2,000, with srcSets) on every public page, even About. Filter to what the page renders.
- [x] **Don't clear the public cache for private changes.** `updateUser` always calls `siteChanged()`, so draft autosaves, marking a message read, or a visitor sending an inquiry all throw away the visitor cache. Only revalidate when published data changes.
- [ ] **Move schema setup out of cold starts.** The `ALTER TABLE ... IF NOT EXISTS` lines take an exclusive lock even when nothing changes. A burst of cold starts makes queries wait. Run migrations once at deploy time.
- [x] **Use Neon's pooled connection string.** Each serverless instance opens up to 5 connections; a traffic spike can hit the database limit.
- [x] **Decode each image once.** `processImage` decodes the original once per size, in parallel. A 15,000 × 15,000 PNG is about 900 MB per decode. Decode once, use `.clone()` for sizes, and lower `limitInputPixels`.
- [x] **Stream the account export.** `/api/export` loads every original (up to 2,000 × 20 MB) into memory before zipping. Stream the zip, or build it in the background and email a link.
- [ ] **Stop loading Folio's fonts on photographers' sites.** Plex, Newsreader and Geist are set in the root layout, so every portfolio downloads them on top of its theme fonts. Move them to the app's own layout.

## Reliability & code health

- [x] **Add `error.tsx` and a root `not-found.tsx`.** A crash or unknown URL shows the default black Next.js screen.
- [x] **Install error monitoring.** Sentry is connected to your account but not to the app, so production errors are invisible.
- [x] **Add browser tests.** Unit tests cover the server only. A Playwright run of signup → upload → design → publish would catch broken flows.
- [x] **Split the editor files.** `design-editor.tsx` is 47 KB and `editor.tsx` is 26 KB; break them into smaller components.
- [x] **Clean up storage on account deletion failures.** Accounts are deleted from the database before their files; if storage removal fails, files are orphaned. Log and retry.

## Landing page

- [x] Make the "yourname.folio.cam" box at the bottom a real input that checks availability as you type and carries the name into sign-up. Right now it looks typeable but isn't.
- [x] Stop theme previews showing empty boxes while scrolling (blank Exhibition print, empty Film Strip, a blank screen on phones). Use placeholders and load them before they scroll into view.
- [ ] Make each theme preview clickable, opening a full demo site in that theme.
- [ ] Add real example sites ("Made with Folio").
- [x] Replace the duplicate hero "Log in" button with "See an example".
- [x] Add pricing / FAQ, even just "Free. Pro coming soon."
- [ ] Fill the footer: Terms, Privacy, contact (done), Instagram (needs owner).
- [x] Shorten the hero on phones so the contact sheet shows on the first screen.

## Sign-up & log in

- [x] **Link labels to inputs.** Correction: the fields are already labelled (Field wraps them in a label); only hints still need linking. Optional: `htmlFor`/`id` pairs.
- [x] Check the site address live as people type (✓ / ✗), instead of finding out it's reserved or taken after submitting.
- [x] Keep the password filled in after a failed submit, and focus the field that's wrong.
- [x] Replace the browser's orange validation bubble with Folio-styled inline errors.
- [x] Give the field in error a red border, not just small red text under it.
- [x] Add a show-password toggle and a reassuring hint under the address ("you can change it later").
- [x] Add Terms/Privacy consent (Phase 3). "Continue with Google" is done.
- [x] Give each page its own tab title ("Create your site · Folio").

## Error & empty pages

- [x] Replace the default black 404 with a branded page linking home and to sign-up.
- [x] On "This site doesn't exist yet", add "Want this address? Claim it →".
- [x] Show "This portfolio is temporarily offline" for offline sites, instead of the same page as a site that never existed.
- [x] Tell photographers clearly when their site is hidden because their email isn't verified.

## Dashboard frame & navigation

- [x] Move "Take offline" out of the header (it's on every page); put "View site ↗" or "Publish" there instead.
- [x] Slim the pinned header: logo bar, site row, a lone "Log out" row and the step strip take about 180 px.
- [x] Put "Log out" in an account menu instead of its own line.
- [x] Keep the header the same on every page (the site switcher disappears on Account).
- [x] Stop the step strip scrolling sideways with a visible scrollbar at narrower widths; collapse to numbers or a select.
- [x] Show ✓ on finished steps and "2 of 5 done".
- [x] Send new users to Upload (step 1), not the empty All photos page.
- [x] Turn the "Preview website" tab into a button, and label whether it shows the draft or the live site.
- [x] Make the site switcher close on outside click and work with arrow keys.
- [x] Show an unmissable "verify your email" banner until verified.
- [x] Replace browser `confirm()` pop-ups with Folio dialogs, or undo toasts ("Photo deleted · Undo").

## Photos & albums

- [x] Use a denser photo grid (4–6 per row) with a size slider; two huge columns makes reordering 21 photos painful.
- [x] Replace the red "No description" under every photo with a quiet marker; keep the filter as the nudge.
- [x] Add multi-select: caption, set location, or add to an album for many photos at once.
- [x] Autosave in the photo drawer when moving to the next photo.
- [x] Use neutral placeholders ("Add a caption…") instead of fake-looking ones like "Couple on the beach at sunset".
- [x] Trap focus in the photo drawer and return it on close (it already has a dialog role and linked labels).
- [x] Show an Albums empty state explaining why to make one, with the create form in a dialog.
- [x] Add "New album from selection" in the photo grid.
- [x] Tell users when a delete didn't happen (for example, during a legal hold).

## Web design editor

- [x] Keep the live preview visible while editing at every width; below about 1,000 px it sits at the bottom of a 3,000 px scroll.
- [x] Put Theme first, before Pages and Sections.
- [x] Show the previous render or a labeled spinner instead of a blank/black preview while it loads.
- [x] Remove the disabled "Describe a change … coming soon" box until it works.
- [x] Autosave drafts; reduce Undo / Discard / Save draft / Publish to a "Draft saved" status and one Publish button.
- [x] Show "3 unpublished changes" instead of a bare "Live on your site".
- [x] **Already done in code: named theme buttons** and selected options marked (`aria-pressed`).
- [x] Explain on each theme card, before it's picked, that Exhibition, Index and Film Strip set their own layout and colors.

## Go live, Account & Messages

**Go live**

- [x] Add optional quality checks: captions, About text, contact details (all 21 photos are uncaptioned but the checklist is all ✓).
- [x] Show "Take offline" once on this page only.

**Account**

- [x] Move name, bio and contact details next to the About page in Web design, away from "Delete account".
- [x] Validate social fields: take an Instagram handle (`@davif`) and build the link; reject non-Instagram URLs (currently `https://davif.photos` is accepted).
- [x] Make "Change address" a secondary button with a confirm dialog showing old → new address.
- [x] Name the "other site" in the delete-account warning.

**Messages**

- [x] Better empty state: link to the contact form on the live site and show what an inquiry looks like.

## Public sites & lightbox

- [x] **Trap focus in the lightbox.** Tab currently moves to the hidden gallery behind the dialog.
- [x] **Give each photo a URL and history entry** (`?photo=3`), so photos can be shared and the phone Back button closes the viewer instead of leaving the site.
- [x] Preload the next and previous photos, and fade in from the small version instead of a black screen.
- [x] Make swipe follow the finger with motion, not an instant jump.
- [x] Put the ‹ › × controls on dark backing circles so they show on bright photos.
- [x] Add an "Inquire about this photo" / Contact button in the lightbox.

## Legal, business & housekeeping

- [x] Terms, Privacy and Copyright pages exist as drafts (`app/(legal)`); still need a policy generator or lawyer pass, then `LEGAL_DRAFT=false`.
- [x] Free vs Pro limits decided and in code: Free 150 photos, Pro 1,500 photos and 20 galleries (`lib/plans.ts`).
- [x] Rename `package.json` from `"my-app"` (now `folio`).
- [x] `HANDOFF.md` and `CLAUDE.md` updated. `Folio.md` does not exist in the repo, so nothing to do.
- [x] Move `data/dev-test-account.txt` (plain-text test password) out of the OneDrive-synced folder.

## Stress-test checklist

**Public sites under load**

- [ ] 500 simultaneous visitors on one site for 5 minutes (k6 or Artillery): p95 under 1 s, no 5xx.
- [ ] Same test on a site with 2,000 photos: page size and time to first photo.
- [ ] 10,000 requests to random subdomains: database load and memory.
- [ ] Load while the owner autosaves the design every second: does the cache keep clearing?
- [ ] 50 parallel requests right after a deploy: lock waits and connection-limit errors.

**Uploads**

- [ ] 50 photos in parallel by one user: all arrive, count correct.
- [ ] Two tabs uploading to the same account.
- [ ] A 15,000 × 15,000 PNG and an animated GIF with hundreds of frames: no crash.
- [ ] Fake images (renamed .exe, broken JPEG, HEIC): clean rejection, file deleted.
- [ ] 1,000 `/start` calls without `/finish`: limited and cleaned up?
- [ ] Delete the account mid-upload: no orphaned files.
- [ ] R2 returning 503: browser retries, clear message.

**Accounts & abuse**

- [ ] 1,000 sign-ups from one IP and from rotating IPs.
- [ ] 6 wrong passwords on a real user's email: lockout length.
- [ ] 200 contact-form messages to one site from many IPs: inbox flooding, 500-message cap.
- [ ] Reset and verify links: used twice, expired, opened by email link scanners.
- [ ] "Sign out everywhere" ends sessions on another browser.
- [ ] Rate limiting with Upstash off or down.

**Big accounts**

- [ ] Export a 2,000-photo account: memory, time, zip opens.
- [ ] 500 inquiries plus full undo history: row size, login and dashboard speed.
- [ ] 100 albums and a very large design: editor stays responsive.

**Outside services failing**

- [ ] Resend down: sign-up works, inquiries still saved.
- [ ] Neon connection limit hit: clean failure, no hung requests.
- [ ] R2 slow (2 s+ per request): uploads and sites still behave.

**Frontend**

- [ ] Each theme on slow 3G with CPU throttling (Lighthouse): LCP under 2.5 s, no layout shift.
- [ ] iPhone SE width, landscape, 200% zoom.
- [ ] Keyboard-only and screen reader in the lightbox and design editor.
- [ ] Safari, Firefox, Chrome on Android.

## Questions to answer before implementing

| # | Area | Question | What it decides | Your answer |
| --- | --- | --- | --- | --- |
| 1 | Plans | What does Free include vs Pro: photo limit, sites, storage, themes, custom domain? | `MAX_PHOTOS`, upload limits, pricing page, how strict the abuse fixes need to be | The free plan includes mostly what is already coded now (one website, four themes, limited editing on "special" themes). Max photo upload should be 150 photos. For Pro, the user should be able to make one personal website, but is able to make separate client galleries that are password protected. The max photos are lifted to {TBD} (give suggestions based on price). For their personal website, they will receive many more "special" theme options with many more editing options. |
| 2 | Plans | Is Folio+ / Frank fully dropped, or parked for later? | Whether to delete the "Describe a change" box and update Folio.md and HANDOFF.md | Frank is not dropped, just pushed to later |
| 3 | Priorities | Which matters most for the next release: security, speed, or design polish? | Order of work across sections | 1. design polish 2. security 3. legal 4. speed |
| 4 | Launch | How many real users do you have now, and how many do you expect in 6 months? | Whether splitting the user row and the stress tests are urgent or can wait | I have no real users right now |
| 5 | Infrastructure | Are Upstash, Neon's pooled URL and R2 all set up in Vercel production? | Whether rate limits and connection fixes are config changes or code changes | Upstash no, Neon check, R2 yes but needs a domain. |
| 6 | Infrastructure | Are you willing to pay for extra services (Sentry, Turnstile, a background job runner)? | Error monitoring, spam protection, export and cleanup jobs | Let's discuss price first, but if it is reasonable and truly valuable then yes |
| 7 | Data | Is it OK to migrate the database (photos and inquiries into their own tables) with a short maintenance window? | How the user-row split is rolled out | yes |
| 8 | Legal | Who writes the Terms, Privacy and Copyright Policy, and which countries' users are you targeting (EU/GDPR, Israel, US)? | Legal pages, consent at sign-up, data deletion wording | Targeting the US and Israel, mostly the US. Not sure who would write that stuff |
| 9 | Sign-up | Do you want "Continue with Google" (or other social sign-in)? | Auth work and the sign-up page layout | yes |
| 10 | Sign-up | Should new sites start live (after email verification) or start as drafts? | `NEW_SITES_START_PUBLISHED`, Go live flow, the verify-email banner | Start as draft: the site stays private until the photographer presses "Go live" on step 5. |
| 11 | Landing page | Can you get 3+ real photographer sites to show as examples, and do you have permission to feature them? | "Made with Folio" section and clickable theme demos | I don't yet but I can make them. Wait on this |
| 12 | Brand | Should error pages, 404 and "site offline" pages match Folio's look, or the photographer's theme? | Design of those pages | the photographer's theme |
| 13 | Dashboard | Which widths must the dashboard support well: phone, tablet, laptop only? | How the header, step strip and design preview are reworked | laptop, phone, tablet |
| 14 | Dashboard | Autosave everything, or keep explicit Save buttons? | Photo drawer, design editor buttons, undo behavior | autosave |
| 15 | Design editor | Should Exhibition, Index and Film Strip stay non-editable? | Theme picker wording and how many controls each theme shows | Uneditable for free users, editable for Pro |
| 16 | Account | Should name, bio and contact details move into the Web design editor (About page)? | Account page restructure | yes |
| 17 | Privacy | Should the contact email be hidden from public sites by default? | Site data and Account fields | Yes by default, but make it prominent for the user to enable it to be public |
| 18 | Public sites | Do you want an "Inquire about this photo" button in the lightbox, and should it pre-fill the contact form? | Lightbox and contact form changes | yes |
| 19 | Admin | Will other people ever help you run Folio (admins, support)? | Admin tools, audit log, multi-site switcher priority | I don't know yet, but add all the options anyway |
| 20 | Testing | Where should stress tests run: a separate staging environment, or production at quiet hours? | Stress-test setup and safety | I don't know enough about this yet, you decide |

## Decisions & recommendations

Your answers set the order: **design polish → security → legal → speed**. With no real users yet, the database split and stress tests move to the end, and a short maintenance window costs nothing.

**What your answers change in the backlog**

- Free plan: one site, four themes, 150 photos. Special themes stay locked on Free.
- Pro: one personal site with editable special themes and more of them, plus password-protected client galleries.
- New sites start as drafts; send a reminder email if they haven't gone live after a few days.
- Add "Continue with Google" to sign-up.
- 404 and "site offline" pages on photographers' addresses use the photographer's theme; Folio's own pages use Folio's look.
- Dashboard must work well on laptop, tablet and phone.
- Autosave everywhere (photo drawer and design editor).
- Contact email hidden by default, with a clear switch to make it public.
- Add "Inquire about this photo" in the lightbox, pre-filling the contact form.
- Build full admin options (roles, audit log, site switcher) even before you have helpers.
- Frank stays in the plan for later; keep the "Describe a change" box hidden, not deleted.
- Example sites: on hold until you build them.

**Pro pricing (you asked for suggestions)**

Competitors: Format Pro is $24/month with 1,500 images and 50 client galleries ([Format](https://help.format.com/hc/en-us/articles/40988178214035-Format-Portfolio-plans-and-add-ons)); Pixieset Pro is $24–30/month ([PricingSaaS](https://pricingsaas.com/companies/pixieset)).

| Option | Price | Personal site | Client galleries | Why |
| --- | --- | --- | --- | --- |
| A — undercut | $12/mo or $120/yr | 1,500 photos | 20 galleries, 50 GB total | Half Format's price; easy first sale |
| B — match | $20/mo or $192/yr | 3,000 photos | Unlimited galleries, 200 GB total | Room for working pros; still below Format Pro |

My pick: **A** to start, since you have no users yet and need people to try it. Raise it once client galleries and Google sign-in are solid.

**Paid services (you said discuss price first)**

| Service | Free tier | Paid | Needed now? |
| --- | --- | --- | --- |
| Upstash (rate limits) | 500K commands/mo, 250 MB ([Upstash](https://upstash.com/pricing/redis)) | $0.20 per 100K commands | Yes; free tier is plenty |
| Sentry (error alerts) | 5,000 errors/mo, 1 user ([Costbench](https://costbench.com/software/developer-tools/sentry/free-plan/)) | Team $26/mo | Yes; free tier |
| Cloudflare Turnstile (spam) | Free, unlimited challenges, 10 hostnames per widget ([Cloudflare](https://developers.cloudflare.com/turnstile/plans/)) | — | Yes; check it covers every *.folio.cam site |
| Background jobs (cleanup, export) | Vercel Cron on your current plan | — | Yes; no new service needed |

All four can start at $0.

**Legal pages (you weren't sure who writes them)**

For US-first with Israel: start from a reputable policy generator for Terms and Privacy, write the Copyright/DMCA page from your existing takedown flow, and have a lawyer review all three before you charge money for Pro. I'm not a lawyer, so treat any draft I write as a starting point.

**Stress tests (you said I decide)**

Run them on a separate staging copy: a Vercel preview deployment with its own Neon database branch and its own R2 buckets. Production stays untouched, and test data never mixes with real accounts.

**Still open:** an R2 photo domain (a second domain on Cloudflare, e.g. img.foliocdn.com). Neon pooling, Frankfurt region, Upstash, Sentry, Turnstile keys and Google sign-in keys are all set in Vercel.

---

# Agent context

Everything a coding agent needs to implement this backlog without re-deriving it. Read this, then the repo's `CLAUDE.md` and `AGENTS.md`, before writing code. Snapshot as of Oct 25, 2026. Phases 1 to 3 and the start of Phase 4 are all merged into `main` (Oct 25, 2026).

## 1. Project snapshot

| Item | Value |
| --- | --- |
| Product | Folio: photographers sign up, upload photos, design a site in an editor, publish at `name.folio.cam` |
| Owner | Davi (solo, non-expert; explain git/infra in plain words) |
| Repo | `github.com/davistrash425-source/folio` (public). Owner's local copy: `C:\Users\david\OneDrive\Desktop\Davi's Projects\folio` (Windows, CRLF) |
| Stack | Next.js 16.4.2 (App Router, Turbopack, `cacheComponents`, partial prerendering), React 19.3, TypeScript, Tailwind 4, zod 4, sharp, `pg` + PGlite, `@sentry/nextjs` 11.8.0 |
| Hosting | Vercel project `folio`, functions in Frankfurt `fra1`, wildcard `*.folio.cam` |
| Database | Neon Postgres, Frankfurt (`eu-central-1`), pooled URL. Local dev/tests use PGlite |
| Photos | Cloudflare R2: `folio-originals` (private), `folio-photos` (public, served from r2.dev for now) |
| Email | Resend (`EMAIL_FROM`, `RESEND_API_KEY`) |
| Errors | Sentry org `davi-k7`, project `folio`, DSN in `NEXT_PUBLIC_SENTRY_DSN` |
| CI | `.github/workflows/ci.yml`: lint → typegen → tsc → `npm test` → build → smoke test → Playwright browser test (`npm run test:e2e`) |
| Users | None real yet. Pre-launch |
| Branches | `main` = production (auto-deploys). A local-only `folio-plus` branch holds parked Folio+ work (client inquiries tables, replies via Resend inbound); do not merge it |

## 2. Infrastructure state (verified in Vercel)

| Env var | State | Used by code yet? |
| --- | --- | --- |
| `DATABASE_URL` | Set, pooled (`-pooler` host) | Yes |
| `SESSION_SECRET` | Set | Yes |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `folio.cam` | Yes |
| `R2_*` (6 vars) | Set; `R2_PUBLIC_URL` is an r2.dev address (rate-limited, dev-only) | Yes |
| `RESEND_API_KEY`, `EMAIL_FROM` | Set | Yes |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Set | Yes (`lib/rate-limit.ts`) |
| `REPORTS_EMAIL`, `ADMIN_EMAILS` | Set | Yes |
| `NEXT_PUBLIC_SENTRY_DSN` | Set | Yes (`lib/sentry.ts`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Set | Yes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Set. Google app in Testing mode; redirect URIs `https://folio.cam/api/auth/google/callback` and `http://localhost:3000/api/auth/google/callback` | Yes (Continue with Google) |
| `CRON_SECRET` | **Not set yet** (owner) | Yes: daily cleanup job |

Open infra item: photo domain. folio.cam DNS must stay on Vercel (wildcard certs), so R2 needs a second domain on Cloudflare (e.g. `img.foliocdn.com`), then update `R2_PUBLIC_URL`.

## 3. Owner decisions (binding)

- Priority order: design polish → security → legal → speed.
- Free plan: one site, four themes, **150 photos**; special themes (Exhibition, Index, Film Strip) locked/uneditable.
- Pro: **$12/month or $120/year** launch price (early users keep it). One personal site, editable special themes plus more themes, password-protected client galleries; **1,500 photos, 20 client galleries, 50 GB**.
- New sites start as **drafts**; reminder email if not published after a few days.
- Add **Continue with Google**.
- 404 / offline pages on photographer addresses use the **photographer's theme**; Folio's own pages use Folio's look.
- Dashboard must work on laptop, tablet and phone.
- **Autosave** everywhere (photo drawer, design editor).
- Contact email **hidden by default**, with a prominent switch to make it public.
- **Inquire about this photo** button in the lightbox, pre-filling the contact form.
- Build full admin options (roles, audit log, site switcher) even before there are helpers.
- Frank / AI "Describe a change" is parked, not dropped: hide the box, keep the code.
- Example sites: on hold until the owner builds them.
- Targets US first, then Israel. Legal pages: policy generator + lawyer review before charging.
- Stress tests run on a staging copy (Vercel preview + Neon branch + separate R2 buckets), never production.
- Paid services start on free tiers (Upstash, Sentry, Turnstile, Vercel Cron).

## 4. Rules for agents working on Folio

- **This is Next.js 16.** Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Known differences: `proxy.ts` replaces middleware; `global-error.tsx` receives `{ error, retry }` (not `reset`); `instrumentation-client.ts` runs in the browser; `"use cache"` + `cacheTag`/`cacheLife`; `cacheComponents: true`; route types via `npx next typegen` (`PageProps`, `RouteContext`).
- All account reads/writes go through `lib/db.ts`. Mutations only via `updateUser(id, fn)`. New `User` fields must be optional (old rows lack them).
- Every server action calls `currentUser()`/`requireUser()` (`lib/auth.ts`); never trust the client. Validate action inputs (types, lengths) — several actions currently don't.
- Keep service interfaces stable: `storage` / `photoUrl` (`lib/uploads.ts`), `sendEmail` (`lib/email.ts`), `rateLimit` (`lib/rate-limit.ts`).
- A `"use server"` file may only export async functions; shared constants live in `lib/`.
- Server actions return `{ error?, ok? }`; navigation uses `redirect()`.
- Tests run in plain Node (`node --test`), not Jest. `tests/setup.ts` stubs `next/*`; fixtures in `tests/helpers.ts`. Name tests as plain-English behaviour. Add ownership tests (`tests/ownership.test.ts`, `tests/signed-out.test.ts`) for every new action.
- Before reporting done: `npm run lint`, `npx next typegen`, `npx tsc --noEmit`, `npm test`, `npm run build` all pass. In sandboxes without internet, the Turbopack build fails on Google Fonts; `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=<file> npx next build --webpack` works as a local check, and CI does the real build. CI's build step can fail once on a network hiccup; re-run before debugging.
- **Git:** commit only when asked; ask before pushing. Work on a branch per round; Vercel makes a preview URL per branch; the owner merges on GitHub. Don't push from a separate copy while the owner's folder has uncommitted copies of the same files (their `git pull` will then fail).
- Communicate in plain language, short status: what's done, what's left, what decision is needed.

## 5. Corrections to the backlog (verified in code)

The UX review used a browser accessibility tree that under-reported names. In code:

- Sign-up/log-in fields **are** labelled: `Field` in `app/ui/form.tsx` wraps inputs in `<label>`. Optional polish only: tie hints to inputs with `aria-describedby`.
- Theme buttons **have** visible names and `aria-pressed` (`design-editor.tsx` ~L893 `ThemePicker`, ~L1045 `ThemeCard`, `Choice` ~L865).
- The photo drawer **has** `role="dialog" aria-modal` and labels (`editor.tsx` ~L482). Still missing: focus trap and focus return.

## 6. Phase 1 implementation notes (by round)

Ship as five rounds, one branch and preview link each.

### Round 1 — Landing page & sign-up

- Landing page: `app/page.tsx` (200 lines). The fake address box is ~L160–170 (`<span>yourname</span>` + `.caret`). Make it a real `<form action="/signup" method="get">` with `name="subdomain"`, plus a live check.
- Address availability: add a GET route (e.g. `app/api/address/route.ts`) using `validateSubdomain` + `RESERVED_SUBDOMAINS` (`lib/site.ts`), `findUserBySubdomain` and `subdomainOnHold` (`lib/db.ts`); rate-limit by IP. Reuse on sign-up and Account → change address.
- Theme previews: `ThemeCard` in `app/page.tsx`, photos via `homePhoto()` / `ContactSheet` in `app/ui/frames.tsx`. Add placeholders (dominant colour / blur) and eager-load near the viewport. Demo sites per theme: owner approval pending to reuse `public/home/*.webp`.
- Footer at `app/page.tsx` ~L178: add Terms, Privacy, contact (`support@folio.cam`, confirm it forwards), Instagram (pending).
- Sign-up: `app/(auth)/signup/page.tsx`. Prefill `subdomain` from `searchParams`. Keep the password after a failed submit with a controlled client-side input (never return the password from the action). Replace native validation bubbles with inline errors (`noValidate` + own checks), red border on the failing field, show-password toggle, hint "you can change it later".
- Page titles: client pages can't export `metadata`; add `<title>` in the component or a small server `layout.tsx` per route.
- **Continue with Google:** routes `app/api/auth/google/start/route.ts` (state + PKCE cookie, redirect to Google) and `.../callback/route.ts` (exchange code, verify ID token audience/issuer/expiry, require `email_verified`). New optional `User.googleId`. Existing email → link automatically (owner agreed in principle; confirm). New Google users still need a site address → send to a short "pick your address" step before `createUser`. `passwordHash` may be empty for Google-only users: `verifyPassword` must return false for empty, and `deleteAccount` must confirm by typing the site address instead (same path as admin extra sites). Use `createSession`; never put the ID token in a cookie.

### Round 2 — Dashboard frame & navigation

- Files: `app/dashboard/layout.tsx`, `app/dashboard/nav.tsx` (`StickyBar` L12, `SiteSwitcher` L37 uses `<details>`, `DashboardTabs`, `STEPS` L111, `SideNav` L124), `app/dashboard/manage/layout.tsx`, `app/dashboard/panels.tsx` (publish toggle L17–22).
- `/dashboard` and `/dashboard/manage` redirect to `/photos` in `next.config.ts` `redirects()` L16. Replace with a page that sends users with 0 photos to `/dashboard/manage/upload`.
- Step progress: compute done-ness server-side (photos > 0, any description, albums > 0, design published, live) and pass to `SideNav`.
- Browser `confirm()` calls to replace: `editor.tsx` L558, `panels.tsx` L17 and L107, `albums.tsx` L153, `design-editor.tsx` L143 and L197.
- Verify-email banner: `User.emailVerified`; resend via `resendVerification` (`app/actions/auth.ts`).
- Drafts: set `NEW_SITES_START_PUBLISHED = false` (`lib/site.ts` L82). Existing accounts unaffected (`published` missing = published). Reminder email needs a Vercel Cron route (Phase 2 cron infra).

### Round 3 — Photos & albums

- `app/dashboard/editor.tsx` (649 lines): grid, upload, drawer (~L482–560; placeholders L511/L519; save ~L459–475).
- `app/dashboard/albums.tsx`, `app/dashboard/manage/albums/*`.
- Actions in `app/actions/site.ts`: `reorderPhotos` L103, `updatePhoto` L117, `setAlbumPhotos`, `createAlbum`. Add bulk actions (`updatePhotos(ids, patch)`, `addPhotosToAlbum`, `deletePhotos`) with zod validation, ownership tests, and one `updateUser` call per action. Respect `legalHold` and report when nothing was deleted.
- Autosave drawer: debounce + save on next/prev/close.

### Round 4 — Web design editor

- `app/dashboard/design-editor.tsx` (1,204 lines; split it). Groups: Pages L161, Theme L245, Captions L357, live preview L420, AI box L1189–1204 (hide).
- `app/actions/design.ts`: `saveDraftDesign` pushes the previous draft onto `designHistory` on every save (`HISTORY_LIMIT = 20`). With autosave, coalesce (e.g. one history entry per 30 s or per discrete action) or undo becomes useless.
- Every draft save calls `updateUser` → `siteChanged()` → clears the public cache. Fix with the Phase 5 cache item, or pass a flag so draft-only changes skip `siteChanged`.
- Special themes: locked on Free and editable on Pro (Phase 4); for now explain on the theme card before selection.

### Round 5 — Public sites & lightbox

- `app/sites/[subdomain]/lightbox.tsx` (122 lines): add focus trap, `?photo=n` with `history.pushState`/`popstate`, preload neighbours, swipe with transform, contrasting controls, "Inquire" button linking to the contact form with the photo id.
- Contact form: `contact-form.tsx` + `sendInquiry` (`app/actions/site.ts` L307). Add optional `photoId` field.
- Offline vs missing: `lib/public-site.ts` L23 returns `null` for both. Return a status (`missing` | `offline` | `ok`) so `app/sites/[subdomain]/not-found.tsx` and a new offline view can differ; render offline inside the photographer's theme.
- Root `app/not-found.tsx` and `app/error.tsx` for folio.cam (Folio's look). `app/global-error.tsx` already exists.
- Contact email hidden by default: `createUser` copies the login email into `profile.contactEmail` (`lib/db.ts` L176). Add optional `profile.showEmail` (default false) and filter it out of `SiteData` unless enabled.

## 7. Phase 2 notes (security)

- Client IP: `clientIp()` (`lib/rate-limit.ts` L61) trusts the first `x-forwarded-for`. On Vercel prefer `x-real-ip` / `x-vercel-forwarded-for`.
- Login: `app/actions/auth.ts` L83–99. Per-email lockout at L89 (5 per 15 min) lets anyone lock a victim out; switch to per-IP + per-(IP,email) and add Turnstile after failures. Run a dummy `scrypt` when the user doesn't exist.
- Orphaned uploads: `app/api/photos/start/route.ts` has no per-user rate limit. Add one, and a Vercel Cron route (protected by `CRON_SECRET`) that lists the private bucket per user and deletes `*.orig.*` keys older than 1 day with no matching `Photo.file`.
- Headers: add `headers()` in `next.config.ts` (CSP incl. R2 public URL, Sentry ingest, Turnstile, Google; HSTS; `frame-ancestors 'none'` for the dashboard, `'self'` for the site preview iframe).
- Body limit: `next.config.ts` L11 `bodySizeLimit: "25mb"` applies to every action; only the non-R2 `uploadPhotos` fallback needs it.
- Turnstile: widget with `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; verify server-side at `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `TURNSTILE_SECRET_KEY`. Check the widget's hostname list covers `*.folio.cam`.

## 8. Phase 3–5 notes

- Plans: DONE. `User.plan` (`"free" | "pro"`, missing = free) and `photoLimit` / `galleryLimit` are in `lib/plans.ts`; accounts over their limit keep their photos but can't add more. Staff set the plan by hand (`setPlan` in `app/actions/admin.ts`) until payments exist.
- Client galleries: `User.galleries` (`ClientGallery` in `lib/db.ts`), helpers in `lib/galleries.ts`, actions in `app/actions/galleries.ts`, dashboard in `app/dashboard/manage/galleries` + `app/dashboard/galleries.tsx`, public page `app/sites/[subdomain]/g/[gallery]`, password cookie in `lib/session.ts`. Not done: download-all, expiry dates, per-photo favourites, email the link to the client.
- Next Phase 4 work, scoped (editable special themes are done): (2) gallery follow-ups (download-all via `zipChunks`, expiry, favourites, email the link); (3) 50 GB limit: store `Photo.bytes` on upload, add `storageUsed` to `lib/plans.ts`, check it beside `photoLimit`; (4) more special themes.
- Payments: Stripe has historically not onboarded Israeli businesses (Globes, 2021 — verify). Alternatives: Paddle or Lemon Squeezy as merchant of record (they handle US sales tax). Vercel Hobby forbids commercial use: upgrade to Pro (~$20/mo) before charging.
- Performance: image decoding, private-change cache clearing and the streamed export are done. Still open: `lib/pg.ts` runs `ALTER TABLE` on every cold start (needs a deploy-time migration; check against Neon first) and the root `app/layout.tsx` loads Folio's fonts on photographers' sites (needs separate root layouts).
- DB split: move photos and inquiries to their own tables (the parked `folio-plus` branch already moved inquiries — reuse that migration if it fits).

## 9. File map

| Area | Files |
| --- | --- |
| Routing | `proxy.ts`, `lib/site.ts` (`siteSubdomain`, `isLive`, reserved names) |
| Data | `lib/db.ts` (User/Photo/Album types, `updateUser`), `lib/pg.ts` (schema, connection) |
| Auth | `lib/session.ts`, `lib/auth.ts`, `lib/tokens.ts`, `app/actions/auth.ts`, `app/(auth)/*` |
| Uploads | `lib/uploads.ts`, `lib/images.ts`, `lib/photo-upload.ts`, `lib/compress-image.ts`, `app/api/photos/*` |
| Dashboard | `app/dashboard/*` (`editor.tsx`, `photo-uploader.tsx`, `photo-drawer.tsx`, `design-editor.tsx` + `design/*`, `albums.tsx`, `galleries.tsx`, `nav.tsx`, `panels.tsx`, `manage/*`) |
| Design model | `lib/design.ts` (zod `SiteDesign`), `lib/templates.ts`, `lib/themes.ts` |
| Public sites | `lib/public-site.ts`, `lib/site-data.ts`, `app/sites/[subdomain]/*` (themes, lightbox, contact form, metadata) |
| Admin & reports | `lib/admin.ts`, `lib/admin-emails.ts`, `lib/reports.ts`, `app/actions/admin.ts`, `app/actions/report.ts`, `app/admin/*` |
| Plans & legal | `lib/plans.ts`, `lib/galleries.ts`, `lib/legal.ts`, `app/(legal)/*` |
| Services | `lib/email.ts`, `lib/rate-limit.ts`, `lib/sentry.ts`, `instrumentation*.ts` |
| Landing | `app/page.tsx`, `app/ui/frames.tsx`, `app/ui/home-photos.json`, `public/home/` |
| Tests | `tests/*.test.ts`, `tests/helpers.ts`, `tests/setup.ts`, `tests/stubs/` |
