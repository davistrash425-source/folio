# Registering a DMCA designated agent (owner guide)

Checked against the Copyright Office's own pages (copyright.gov/dmca-directory and its FAQ) on Oct 25, 2026.

## Why

If Folio hosts photos that users upload, US law (DMCA section 512) protects the service from being sued for a user's infringement, but only if it has a designated agent registered with the US Copyright Office and shown on its website. The registration is online only.

## Cost and renewal

- **$6** per registration, amendment or renewal. No extra fee for alternate names.
- It **expires after 3 years** unless you amend or resubmit it (that is the renewal, another $6). The system emails reminders at 90, 60, 30 days and 1 week before. If it lapses you lose the protection until you re-register. Put the date in your calendar.

## What to prepare

Service provider (Folio):
- Full legal name of the operator (you personally, or your company), and a **physical street address**. A PO box is only allowed with the Copyright Office's prior approval, granted in exceptional cases such as a safety threat. This address is for the Office and is not necessarily the public one (check the directory entry after you submit).
- Alternate names: `Folio`, `folio.cam`. Listing the domain is enough. Subdomains need no separate entry.

Designated agent (the person or role that receives takedown notices):
- Name (an individual, a job title like "Copyright Agent", or a department), organization, mailing address, phone, email. Only one agent is allowed.
- The agent's address **can be a PO box** without special approval. So if you don't want your home address public, use a PO box or a mailbox rental (UPS Store style) or a registered-agent / law-firm service as the agent. A third party can also manage the registration for you.
- Use an email you will actually read. Suggestion: `support@folio.cam` (create the forward first, see checklist item 5), or a dedicated `copyright@folio.cam`.

Account contacts: a primary contact (first and last name, phone, email) for the Office to reach you, plus the provider phone and email. A secondary contact is optional.

## Steps (you do these, Claude must not)

1. Go to dmca.copyright.gov and create an account (needs an email address and a password).
2. Start a new designation: enter the provider information, alternate names, the agent, and the contacts above.
3. Pay the $6 by card or bank account on the site.
4. Save the confirmation and the expiry date; add a calendar reminder about 2 months before 3 years.
5. Send Claude the agent details exactly as registered (name, organization if any, address, phone if shown, email).

## What Claude then does

In `lib/legal.ts`, set `DMCA_AGENT` (currently `null`) to the details, for example:

```ts
export const DMCA_AGENT: DmcaAgent | null = {
  name: "Copyright Agent",
  organization: "Folio",
  address: "PO Box 123, City, State ZIP, Country",
  phone: "+1 555 0100",
  email: "copyright@folio.cam",
};
```

The `/copyright` page then shows it under "Designated agent" instead of the plain support address. The US requires the agent's name, address, phone and email on the site, so include a phone unless the registered record has none.

## What Folio's code already has

- `/report/copyright`: a form that collects a full DMCA notice (17 U.S.C. 512(c)(3)) into `reports.notice`.
- Takedown tools in `/admin`: remove a photo (web copies deleted, original kept), restore it, suspend a site, legal hold, close reports.
- Repeat-infringer policy: one strike per copyright notice, account closed at `STRIKE_LIMIT`.
- Notice copied to the photographer without the sender's address and phone; counter-notices go to the support address.
- Emails about takedowns are in `lib/admin-emails.ts` (get legal wording reviewed by the lawyer in checklist item 5).

## Notes

- This is not legal advice. Ask the lawyer whether to register under a company rather than your personal name.
- The US safe harbour does not cover non-US law (for example Israel); the lawyer can advise.
