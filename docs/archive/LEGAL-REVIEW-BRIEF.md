# Folio: brief for the lawyer (Terms, Privacy, Copyright)

Status: DRAFT text, not yet reviewed. `LEGAL_DRAFT` in `lib/legal.ts` is still `true`, so each page shows a "Draft" banner. Pages: `/terms`, `/privacy`, `/copyright` (source in `app/(legal)/`). Last updated string: 25 October 2026.

## 1. What Folio is
A web service where photographers sign up, upload photos, design a website and publish it at `name.folio.cam`. The Free plan holds 150 photos; a Pro plan (1,500 photos) exists in code but billing is not built and whether Folio will be paid is undecided. Visitors to a site can send a contact message, and photographers can make password-protected client galleries where clients "heart" photos.

## 2. Business details still needed from the owner
- Legal name of the operator (person or company), and whether a company exists
- Postal address (also needed for the DMCA agent registration)
- Contact email (pages use `support@folio.cam`; that address must really exist)
- Country of operation and governing law / court for disputes
- Whether the owner operates from Israel (then Israeli privacy law applies as well)
- Whether Folio will charge money (affects Terms: fees, refunds, tax)
- Minimum age for users (the app has no age check today)

## 3. What each page claims, and whether the code agrees
### Terms
| Claim | Code check |
| --- | --- |
| Real email, keep password private | Email confirmation is required before a site goes live. Matches. |
| Delete account any time; site and photos removed | True (`deleteAccount`), but blocked while a legal hold is on; file removal is retried by the daily job if it fails. Backups at Neon/R2 are not mentioned. |
| Folio may store, resize, show photos "only to run your site" | Matches. Web copies strip EXIF/GPS and add the photographer's name and copyright notice. |
| No AI training; AI crawlers asked to stay away unless the user allows | Matches (`AI_TRAINING_CRAWLERS`, `User.allowAiTraining`). robots.txt is a request, not enforcement. |
| Free plan holds 150 photos | Matches `FREE_PHOTO_LIMIT`. Pro plan not described. |
| May remove photos, hide a site, close an account | Matches (take down, suspend, delete as admin). |
| After 3 upheld copyright notices the account is closed | `STRIKE_LIMIT = 3`, one strike per notice. Closure is a manual admin step, not automatic. |
| Closed account's address held 12 months | Matches `ADDRESS_HOLD_MONTHS = 12`. |
| Provided "as is", limited liability, tell users of important changes | Legal wording only; no code behind it. |

### Privacy
| Claim | Code check |
| --- | --- |
| Collects name, email, hashed password or Google sign-in, site address | Matches (scrypt hash; Google OAuth exists). |
| Photos, captions, text, design, contact-form messages | Matches. Messages are stored in the account (last 500) and emailed to the photographer. Visitor name, email, message and optional date are collected. |
| Original kept privately for export; public copies strip location/camera data | Matches. |
| Visitors' IPs used briefly for rate limits | Matches (Upstash Redis, or memory). Not stated: how long Upstash keeps them; Vercel and Sentry may also log IPs. |
| Processors: Vercel, Neon, Cloudflare (R2, Turnstile), Resend, Upstash, Sentry, Google | Matches the code. |
| "One cookie keeps you signed in; no tracking cookies" | WAS WRONG: there is also a per-gallery cookie for password galleries, a short staff-only cookie, and a possible Turnstile cookie. Fixed in `app/(legal)/privacy/page.tsx` (the only change made to the pages). |
| Export everything, delete the account, take site offline | Matches (`/api/export` zip with account.json and originals; password hash and staff notes left out). |
| Copyright notices shared with the photographer minus sender's address and phone | Matches. |
| Legal holds keep data until the hold ends | Matches (`User.legalHold`). |

## 4. Things the code does that the pages do NOT say (lawyer should decide)
1. **Staff access.** Full admins can view any photographer account as its owner ("log in as this user": typed reason, logged, 30 minutes). Staff can also read account data in `/admin`, keep private notes (`adminNotes`) and see reports. Privacy does not disclose this.
2. **Reports data.** Abuse reports and copyright notices (sender's name, email, address, phone, signature) are stored in the `reports` table and emailed to `REPORTS_EMAIL`. Retention is unlimited.
3. **Admin action log** (`admin_actions`) and strikes are kept indefinitely.
4. **Emails Folio sends:** verification, password reset, takedown and suspension notices, a one-time draft-site reminder (daily cron), and gallery links a photographer sends to clients.
5. **Client galleries:** clients' favourites are stored on the gallery with no name or email, but a cookie is set.
6. **Retention.** Nothing says how long data lives after deletion (database backups at Neon, R2, Sentry events, email logs at Resend), or that a closed account's subdomain is recorded for 12 months.
7. **Uploaded-content licence** is brief; no indemnity, no dispute process, no governing law, no minimum age.
8. **Sign in with Google:** the Privacy page does not say what is taken from the Google account.
9. **Pro plan and payments** are not covered.
10. **"We will tell account holders about important changes":** no code sends such notices; it would be a manual email.

## 5. Open questions for the lawyer
United States first:
- Is the DMCA process on `/copyright` complete? Counter-notices are just an email to support, handled by hand; the page does not state the 10 to 14 business-day restoration window or the required counter-notice contents (17 U.S.C. 512(g)). The designated-agent section is being filled in separately (owner item 6) once an agent is registered at dmca.copyright.gov.
- Repeat-infringer policy: is "3 strikes, closed by an admin" enough to count as reasonably implemented?
- Is "as is" plus limited liability enforceable against consumers, and do we need an arbitration or venue clause?
- Children: do we need COPPA wording or a minimum age?
- California (CCPA/CPRA) and other state laws: do we need a "your rights" section and a notice at collection, given we do not sell data?
- Photographers publish photos of people: do the Terms need a model-release / right-of-publicity line?
- Staff "log in as user": is a disclosure enough, or is explicit consent needed?

Outside the US (EU/UK visitors, and Israel if applicable):
- GDPR/UK GDPR: is Folio a controller (accounts) and a processor (photographers' visitors' messages)? Do we need a legal-basis table, a data processing agreement, an EU representative and a transfers clause (processors are mostly US)?
- Israel: the Protection of Privacy Law and any database registration duty; should the Terms use Israeli governing law and courts?
- Is the processor list enough, or must each one be named with purpose and location?
- Retention periods, and erasure rights while a legal hold or DMCA record exists.

## 6. Finish line
When the lawyer signs off and the owner supplies the business details: update the text, set `LEGAL_DRAFT = false` and update `LEGAL_UPDATED` in `lib/legal.ts`, then run `npm test`.
