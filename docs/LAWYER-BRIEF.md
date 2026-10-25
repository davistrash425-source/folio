# Folio: brief for the lawyer

**Service:** Folio (folio.cam). Photographers sign up, upload photos, design a website and publish it at `name.folio.cam`. Free plan now (150 photos); a paid Pro plan is planned (more photos, password-protected client galleries).
**Operator:** David Leonardo Freeman, an individual (may form a Florida LLC later), 1250 95th Street, Bay Harbor Islands, FL 33154. Governing law chosen: Florida.
**Draft pages to review:** `https://folio.cam/terms`, `/privacy`, `/copyright` (source: `app/(legal)/`).

## What the service does with data
- **Accounts:** name, email, hashed password (or Google sign-in), site address. Sign-up requires accepting Terms and Privacy (timestamp stored).
- **Photos:** originals kept privately (for the owner's export); public web copies have location and camera data removed and carry the photographer's name and copyright notice. Client-gallery links are private by password, but the image files are the same public web copies.
- **Visitors:** a contact form on each site (message goes to the photographer); IP addresses used briefly for rate limits. No advertising or tracking cookies; one sign-in cookie.
- **Processors:** Vercel (hosting), Neon (database), Cloudflare (R2 storage, Turnstile), Resend (email), Upstash (rate limits), Sentry (errors), Google (sign-in).
- **AI:** photos are not used to train AI; sites ask known AI crawlers to stay away unless the photographer allows them.
- **Deletion:** users can export everything and delete their account. A closed account's address is held 12 months. Legal holds can pause deletion.

## Moderation and copyright
- Reports form for abuse; DMCA notice form (17 U.S.C. § 512(c)(3)) at `/report/copyright`. Takedowns hide the photo, keep the original, and send the owner the notice without the sender's address and phone. Counter-notices go to support@folio.cam.
- Repeat infringers: one strike per upheld notice; account closed at the limit set in code.
- DMCA designated agent: not yet registered (owner to-do).

## Questions for the lawyer
1. Are the Terms enough for an individual operator, and what changes if an LLC is formed (liability, name on the pages)?
2. Is the Florida governing law and Miami-Dade venue sensible, and is a limitation of liability / disclaimer clause adequate?
3. Privacy: what is needed for EU/UK and California visitors and photographers (lawful basis, rights requests, data transfers, children)?
4. DMCA: is the notice, counter-notice and repeat-infringer wording compliant? Which address should be public for the agent (a PO box or registered agent instead of a home address)?
5. Photographers' clients: do client-gallery emails and contact-form messages need extra notices?
6. Pro plan: refund, cancellation and sales-tax wording, once a payment provider is chosen.
7. Anything missing that a photo-hosting service normally needs (acceptable-use rules, prohibited content, takedown for non-copyright reports)?
