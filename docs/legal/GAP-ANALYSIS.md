# Gap analysis: Folio's legal pages vs. the code and the law

Prepared Nov 1, 2026. Compares the pages as they were on Oct 26 (`LEGAL_UPDATED = "26 October 2026"`) with DATA-INVENTORY.md and RESEARCH.md. **Not legal advice.**

Ranking: **High** = a false statement about what Folio does, or a legal duty that's live now (billing is live). **Medium** = a missing disclosure a regulator or a user's lawyer would point to. **Low** = tidy-up.

"Pages" = fixed in the revised `/terms`, `/privacy` or `/copyright`. "Code" = a code task (not done here; listed in §2). "Owner" / "Lawyer" = a decision (LAWYER-QUESTIONS.md).

## 1. Gaps

| # | Risk | Gap | Why it matters | Fix |
|---|---|---|---|---|
| G-01 | High | **No paid-plan terms**, while Pro has been on sale since Oct 30 | Auto-renewal laws (CA §17602, FL §501.165 for yearly) and ROSCA require clear renewal/cancellation terms before charging; Polar MST 9.5 requires refund eligibility to be disclosed | Pages: "Plans and payment" (Polar as merchant of record, renewal, cancellation, refunds, price changes, downgrade) |
| G-02 | High | Old Terms said deleting an account removes "your site and photos". Not fully true: browser caches (1 year), CDN (1 day), database history (plan window), reports, admin log, Polar and Resend records remain | FTC §5: privacy/deletion promises must match practice | Pages: Terms points to Privacy "Deleting" section, which lists what remains |
| G-03 | High | **"Go Pro" buttons and `/pricing` say nothing about auto-renewal or cancellation**; Folio stores no proof of renewal consent | CA §17602(a)(1),(a)(4),(a)(6): disclosure in visual proximity, separate express consent, 3-year consent records. Polar's checkout shows some of this, but whether that covers Folio is a lawyer question | Code: short renewal line under the buttons and on `/pricing` (e.g. "Renews every month until you cancel. Cancel any time in Account → Plan."); Lawyer: does Polar's checkout satisfy the ARL for Folio? |
| G-04 | High | **No renewal reminder for yearly plans** | CA §17602(b)(2) (15–45 days before renewal for terms of 1 year+) and FL §501.165(2)(b) (30–60 days) | Owner: check whether Polar sends one; if not, Code: reminder email from the daily job using `billing.currentPeriodEnd` |
| G-05 | High | Old Terms: "After 3 upheld notices we close the account". **Code only tells staff to suspend; nothing closes automatically** | §512(i) needs a policy that's reasonably implemented and matches what users are told | Pages: "At 3 strikes we take the site offline and may close the account"; Owner: actually do it each time (or Code: auto-suspend at `STRIKE_LIMIT`) |
| G-06 | High | `/copyright` said Folio "may restore" after a counter-notice; didn't give 10–14 business days or the counter-notice elements | §512(g)(2)(C) requires restoring within 10–14 business days to keep the good-faith takedown protection; §512(g)(3) elements | Pages: rewritten counter-notice section (matches `lib/admin-emails.ts`) |
| G-07 | High | **No 18+ requirement** | Owner's choice; COPPA risk if under-13s sign up and staff learn of it | Pages: Terms "Who can use Folio"; Code (proposal, §3): add "I'm 18 or older" to the sign-up checkbox |
| G-08 | Medium | **No retention period** for reports (incl. DMCA notices with address and phone), the admin log (which keeps a deleted account's email), the support inbox, taken-down originals, `released_subdomains` | Data minimisation (Israel PPL, GDPR if it applies, FL §501.171 disposal duty); and old Privacy said nothing | Pages: states the honest current position ("no set end date yet"); Owner: choose periods (inventory D-2–D-8); Code: deletion job |
| G-09 | Medium | Vendor list missed **Polar, ImprovMX, Vercel Analytics, Google Drive**; and said vendors process data "only to provide their service to Folio" | False for Cloudflare Turnstile (controller for improving Turnstile) and Polar (independent business) | Pages: full list; Turnstile and Polar described accurately |
| G-10 | Medium | Only the **time** of Terms acceptance is stored, not which version | Proving which terms a user agreed to (B.6) | Code: store `LEGAL_UPDATED` with `termsAcceptedAt` |
| G-11 | Medium | **Vercel Analytics on the root domain can receive `/reset-password?token=…` and `/verify-email?token=…` URLs** (and dashboard paths); `beforeSend` filters only by host | Sending one-time tokens to a third party; Vercel's docs recommend stripping sensitive URL parts | Code: in `app/ui/folio-analytics.tsx` drop the query string (or skip `/reset-password`, `/verify-email`, `/dashboard`, `/admin`) |
| G-12 | Medium | **Takedown cache purge may not be running** (HANDOFF: `CLOUDFLARE_PURGE_TOKEN`/`ZONE_ID` still "Owner to do") and covers only `img.foliocdn.com`, not `name.folio.cam/_photos/…` (the Vercel rewrite path visitors actually use); **web copies are `immutable` for 1 year in browsers** | Takedowns of infringing or abusive photos may keep showing; the Privacy Policy must not overclaim | Owner: set the purge variables; Code: check whether Vercel caches the `/_photos` rewrite (and purge it if so); consider `max-age` shorter than a year. Pages: honest periods stated |
| G-13 | Medium | Sentry: whether IPs are stored depends on the **"Prevent Storing of IP Addresses"** project setting (not checked); runs on photographers' sites too | Policy accuracy; data minimisation | Owner: turn the setting on; confirm retention; Pages: describes what's sent without claiming IP isn't stored |
| G-14 | Medium | **Taken-down originals are kept indefinitely** | Keeping infringing copies forever; storage cost | Owner: choose (D-4); Pages: honest |
| G-15 | Medium | **No Google Limited Use statement** and no Drive wording | Google API Services User Data Policy transparency; HANDOFF lists it as owner to-do | Pages: Google section with the standard statement |
| G-16 | Medium | **Staff access, impersonation, admin notes undisclosed.** Also: while impersonating, bulk `deletePhotos` and `updateGallery` (password change) aren't blocked, though single delete is | Disclosure (FTC §5); the code gap lets staff delete photos or change a client's gallery password while "just looking" | Pages: Staff access section; Code: add `impersonationBlock()` to `deletePhotos` and `updateGallery` (and consider uploads) |
| G-17 | Medium | **Client-gallery file exposure** undisclosed to photographers | Photographers may rely on "password-protected" for confidential shoots | Pages: Terms "Client galleries" says images are addressable |
| G-18 | Medium | **No model-release / minors promise** | Right of publicity (Fla. Stat. §540.08 etc.); peers require it | Pages: "What you promise" |
| G-19 | Medium | **No liability cap or indemnity**; exclusions only for indirect damages | Exposure with no ceiling | Pages: cap (greater of $50 or 12 months' fees, with carve-outs) and indemnity; Lawyer: amount, consumer enforceability |
| G-20 | Medium | **No breach or state-law sections** | FL §501.171 (30-day notice; email + password counts); other states | Pages: breach and "Your rights"; Owner: write a 1-page breach plan |
| G-21 | Medium | **Changes clause** ("will tell account holders about important changes") had no timing; Douglas v. Talk America | Enforceability of changed terms | Pages: 30 days' email notice, not retroactive; Code: a way to email all account holders (none exists today) |
| G-22 | Low | `released_subdomains` rows never deleted | Minimisation | Code: delete rows older than `ADDRESS_HOLD_MONTHS` in the daily job |
| G-23 | Low | Expired `tokens` deleted only when a new one is made | Minimisation | Code: add to the daily job |
| G-24 | Low | Contact form has **no privacy notice**; visitors don't see where their message goes | Israel §11 notice duty; general transparency | Code: one line under the form: "Your message goes to the photographer and is kept in their Folio inbox. Privacy" |
| G-25 | Low | Refund on **account deletion**: deletion revokes Pro immediately with no refund | Polar MST 6.4 (product unavailable ⇒ keep access or pro-rata refund) may apply if Folio ends access; probably not when the user deletes | Pages: Terms says so plainly and advises cancelling first; Lawyer: confirm |
| G-26 | Low | **No CSAM reporting process** | 18 U.S.C. §2258A obliges providers to report apparent child sexual abuse material to NCMEC once they know of it (cited from general knowledge, not fetched) | Owner: register with NCMEC's CyberTipline and write a 5-line procedure; Pages: "We report it where the law requires" |
| G-27 | Low | Old Privacy said visitors' IPs are used "briefly"; Turnstile and Vercel logs also get them | Accuracy | Pages: fixed |
| G-28 | Low | Export includes **visitors' inquiries** (names, emails, messages) and the staff takedown `note` | Visitors' data leaves with the photographer: fine, but disclose it; staff notes in `removed.note` may be internal | Pages: Privacy says the export includes messages; Owner: decide whether `removed.note` should be exported |
| G-29 | Low | `DATABASE_RESTORE_DAYS`, `EMAIL_LOG_DAYS`, `ERROR_REPORT_DAYS` in `lib/retention.ts` are **unconfirmed** vendor settings | Policy accuracy | Owner: check Neon, Resend and Sentry dashboards; adjust the constants |
| G-30 | Low | Local repo is behind production (PR #33) | My inventory describes the local copy | Owner: pull, then re-run `tests/retention.test.ts` |
| G-31 | Medium | **A legal hold doesn't stop** deleting messages, galleries or albums, overwriting captions/profile, design-history trimming or the 500-message inbox cap (only account and photo deletion are blocked) | Evidence preservation; the Privacy Policy now promises only that "the account and its photos can't be deleted" | Code: add `legalHold` checks to `deleteInquiry`, `deleteGallery`, `deleteAlbum`, and skip `keepNewestInquiries` trimming while held |
| G-32 | Medium | Sentry is sent the full `referer` header, so an error right after `/reset-password?token=…` can send the token | Token leak to a vendor | Code: strip the query from `referer` in a Sentry `beforeSend`; Owner: turn on "Prevent Storing of IP Addresses". Pages: disclosed honestly |
| G-33 | Low | "Email the gallery link" sets Reply-To to the photographer's **login** email, even when they hid their contact email | Unexpected disclosure of the login email | Code: use `profile.contactEmail` as Reply-To. Pages: disclosed |
| G-34 | Low | After a downgrade, the next design save replaces the Pro theme and its settings with Classic (`withoutProSettings`, `lib/design.ts`) | The old "nothing is deleted" was untrue | Pages: Terms now says so; Owner: consider keeping Pro fields on save |
| G-35 | Low | The takedown email to the photographer goes only if the admin ticks "notify"; §512(g)(2)(A) needs prompt notice | Losing the good-faith takedown protection | Owner: always tick it, or Code: make it the default/required for copyright takedowns |
| G-36 | Low | "Retry every day" and "unfinished uploads removed after a day" need `CRON_SECRET` in production (otherwise the cron route returns 404) | Accuracy | Owner: confirm `CRON_SECRET` is set in Vercel |
| G-37 | Low | Admin deletion of a paying account revokes Pro with no refund; the Terms now promise "we'll ask Polar to refund" when we close an account without fault | Polar MST 6.4 | Owner: add "issue a pro-rata refund in Polar" to the staff checklist |

## 2. Code tasks (not done; for the owner to schedule)

In rough priority order:
1. **Renewal disclosure** next to the Go Pro buttons and on `/pricing`, with a link to the Terms' Plans section (G-03). Also disclose refund eligibility there (Polar MST 9.5).
2. **Yearly renewal reminder** email 30–45 days before `currentPeriodEnd` (satisfies both CA 15–45 and FL 30–60), unless Polar already sends one (G-04).
3. **Strip query strings** in `FolioAnalytics.beforeSend` (G-11).
4. **Block `deletePhotos` and `updateGallery` while impersonating** (G-16), with tests in `tests/admin-impersonation.test.ts`.
5. **Store the accepted Terms version** (`termsVersion: LEGAL_UPDATED`) at sign-up, and add "I'm 18 or older" to the checkbox (G-07, G-10).
6. **Daily job additions**: delete expired tokens; delete `released_subdomains` older than the hold; (once decided) delete closed reports and admin-log rows past their period, and taken-down originals past theirs; replace a deleted account's email in `admin_actions.detail` (G-08, G-14, G-22, G-23).
7. **Purge `name.folio.cam/_photos/…` URLs** on takedown if Vercel caches them; consider a shorter browser `max-age` for web copies (G-12).
8. **Contact-form notice** line (G-24).
9. **"Email all account holders"** admin tool for change notices (G-21).
10. **Auto-suspend at `STRIKE_LIMIT`** (optional; or keep it manual and document it) (G-05).
11. Legal-hold checks on the remaining delete actions (G-31); Sentry `beforeSend` stripping the referer query (G-32); gallery-email Reply-To (G-33).
12. Make the code import the mirrored constants from `lib/retention.ts` instead of repeating them (today `tests/retention.test.ts` guards against drift).

## 3. Smallest sign-up change for 18+ (proposed, not built)

In `app/ui/signup-form.tsx` and `app/(auth)/signup/google/form.tsx`, change the checkbox label to:

> I’m 18 or older and agree to the Terms and Privacy Policy.

No new field, no new server check: the existing `terms` checkbox already blocks sign-up when unticked (`signup` and `completeGoogleSignup` in `app/actions/auth.ts`). Optionally store `ageConfirmedAt` alongside `termsAcceptedAt`. A neutral date-of-birth field (FTC COPPA FAQ H.3) is stronger evidence but adds friction and personal data; lawyer's choice (LAWYER-QUESTIONS Q4).
