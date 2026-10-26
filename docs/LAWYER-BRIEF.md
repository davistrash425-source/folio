# Folio: brief for a lawyer

Prepared Oct 26, 2026. Folio is a US-based website service for photographers. I'd like a US attorney to review the three legal pages below and answer the questions at the end. I'm asking for a flat-fee review of existing text, not a rewrite from scratch.

## 1. What to review

Live at `https://folio.cam` (they currently show a "Draft" banner):

- `/terms`: Terms of Service
- `/privacy`: Privacy Policy
- `/copyright`: copyright policy, DMCA agent details and the notice form (`/report/copyright`)

Source text is in `app/(legal)/`, and operator details are in `lib/legal.ts`. I can send the page text as a document on request.

## 2. Who and what

- **Operator:** David Leonardo Freeman, an individual (no company yet), 1250 95th Street, Bay Harbor Islands, FL 33154. Contact: support@folio.cam.
- **Governing law in the Terms:** Florida; disputes in Miami-Dade County state or federal courts.
- **Product:** photographers sign up, upload photos, design a website and publish it at `name.folio.cam`.
- **Audience:** mainly US photographers and visitors, and a few in Israel.
- **Plans:** Free now (150 photos). A paid Pro plan is planned (1,500 photos, client galleries, extra themes; launch price $12/month or $120/year). No payments are taken yet.
- **Status:** live at folio.cam, no paying users yet.

## 3. How the service handles content (facts relevant to the policies)

- Photographers' original files are stored privately and never shown publicly. Public web copies have GPS and camera data removed and carry the photographer's name and copyright notice in metadata.
- Folio does not use photographers' photos to train AI, and asks AI-training crawlers to stay away unless the photographer opts in.
- Sites start as drafts and go live only after the photographer confirms their email and publishes.
- Photographers can export all data and delete their account. A deleted account's subdomain is reserved for 12 months.
- Visitors can report a site (anonymous abuse report) or send a copyright notice (full DMCA form under 17 U.S.C. § 512(c)(3)). Copyright notices are shared with the photographer minus the sender's address and phone.
- **Takedown process:** staff can remove a photo (the web copies are deleted and the original is kept), suspend a site, or close an account. Each upheld copyright notice adds one strike; **3 strikes close the account**.
- **Legal holds:** staff can place a hold on an account that blocks deletion and sends no emails to the user.
- **Staff access:** staff can view an account as its owner for support (typed reason, 30 minutes, logged). Staff can also add private notes about accounts.
- **Client galleries (Pro):** password-protected links. The image files behind a link are the same public web copies, so a link is private but the files are not secret if someone has the address.
- **Contact forms:** visitors can message a photographer through the form on a site. Messages are stored in the account and emailed.
- **Public contact email:** hidden by default; the photographer can choose to show it.

## 4. Data collected and who handles it

Collected: name, email, hashed password (or Google sign-in), subdomain, photos and text the user adds, messages sent through contact forms, report and copyright-notice details, and visitors' IP addresses (briefly, for rate limits and abuse protection).

Service providers (as listed in the Privacy Policy): Vercel (hosting), Neon (database), Cloudflare (R2 photo storage, Turnstile bot check), Resend (email), Upstash (rate limits), Sentry (error reports), Google (sign-in).

Cookies: sign-in, client gallery access, and Turnstile. No advertising or tracking cookies.

## 5. Registrations

- DMCA designated agent registered with the US Copyright Office: **DMCA-1084175** (Oct 26, 2026; renew by Oct 2029). Agent: David Leonardo Freeman; alternate names Folio, folio.cam, www.folio.cam. Shown on `/copyright`.

## 6. Questions

**Terms of Service**
1. Does the Terms text give Folio the right license to host, resize and display users' photos, and is the "to run your site" limit drafted correctly?
2. Is the repeat-infringer policy (3 strikes, account closed) adequate for DMCA § 512(i)? Is the process for counter-notices and restoring photos complete? (Please look at `/copyright` closely.)
3. The Terms say the service is "provided as it is" and exclude indirect and lost-profit damages. Is that wording enforceable and enough? Should there be a liability cap, an indemnity from users, an arbitration clause or a class-action waiver?
4. Should the Terms set a minimum age (for example, 13 for COPPA reasons, or 18)?
5. The Terms don't cover paid plans yet. What must they say before I charge (billing, auto-renewal and cancellation rules, refunds, price changes, downgrade rules when a Pro user is over the Free photo limit)?
6. Is it fine to hold a closed account's address for 12 months and to suspend or close accounts without notice in some cases?

**Privacy Policy**
7. Is the policy complete for a US-focused service? What is missing: categories of data, retention periods, state privacy law disclosures (California and others), and data deletion rules?
8. Do I need GDPR/UK wording, or Israeli privacy wording, given a few users and visitors there? If not, how should I limit or disclose that?
9. Staff can view accounts as their owners and keep private notes. Is that disclosed enough in the Privacy Policy, and what should I say about it?
10. Do I need a cookie banner for the cookies listed above?
11. Legal holds: the policy says data is kept while a hold is active and the user is not told. Is that wording appropriate? What triggers should I act on (subpoena, preservation letter)?
12. What should I do if there is a data breach? Do I need a written plan?

**Business**
13. Should I form an LLC (and in which state) before charging customers, and does it change the Terms and DMCA registration?
14. Sales tax and other tax issues when selling a subscription online. Does using a merchant-of-record payment provider (Paddle or Lemon Squeezy) take this off my plate?
15. Is "Folio" worth a trademark search or registration, and is there any obvious conflict?
16. Should I carry any insurance (for example media liability or cyber)?

## 7. What I'm asking for

- A quote for a flat fee to review `/terms`, `/privacy` and `/copyright` and mark up the changes.
- Answers (even short ones) to the questions above.
- Sign-off I can rely on to remove the "Draft" banner.

I'll apply the edits to the site myself.
