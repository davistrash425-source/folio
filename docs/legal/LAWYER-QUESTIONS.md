# Open questions for the lawyer

Prepared Nov 1, 2026, with the revised drafts of `/terms`, `/privacy` and `/copyright`. Each question gives what I found (RESEARCH.md has the sources), my recommendation, and the matching question in `docs/LAWYER-BRIEF.md` (Q1–Q18). **I'm not a lawyer; these are recommendations to check, not conclusions.**

## Terms

### L-1 · Content license (brief Q1)
**Found:** peers range from Pic-Time's "revocable, limited, during the term, only to provide the service" to Squarespace's "perpetual, irrevocable, sublicensable, including promotion". Adobe limits sublicensing to its agents and excludes marketing.
**Draft:** worldwide, non-exclusive, royalty-free; store/copy/resize/convert/show/send and write metadata; only to run the user's site and features and keep Folio safe; only Folio's hosting providers handle content; no marketing use without asking; ends per photo on deletion, with a caching/backup and legal-hold carve-out.
**Question:** Is this grant enough to cover client downloads, the zip, the export, CDN caching and legal holds? Should "promote Folio" (example sites, social posts) be an opt-in instead of excluded?

### L-2 · Arbitration and class-action waiver (brief Q3)
**Found:** 5 of 8 peers arbitrate (JAMS/NAM/ADR Canada) with a class waiver, three with a 30-day opt-out; Pic-Time and Plausible don't. *Heckman v. Live Nation* (9th Cir. 2024) struck down a one-sided mass-arbitration setup. Consumer arbitration fees usually fall on the business. Polar's buyer terms already put buyer–Polar payment disputes into arbitration.
**Draft:** courts in Miami-Dade, with small claims available, after 30 days of informal resolution. No arbitration.
**Recommendation:** keep courts for now (cheap, simple, fits a tiny user base). If you'd rather arbitrate, this is the clause I'd suggest as a starting point (not in the page):

> *Arbitration.* If we can't resolve a dispute informally within 30 days, you and we agree to resolve it by binding individual arbitration administered by [JAMS / the AAA] under its consumer rules, except that either of us may bring an individual claim in small-claims court, and either of us may ask a court to stop infringement of intellectual property. You and we waive the right to a jury trial and to bring or join a class or representative action. You can opt out of arbitration by emailing [support] within 30 days of first agreeing to these terms. If the class waiver is found unenforceable for a claim, that claim goes to court, not arbitration. Folio pays the arbitration provider's fees for claims under $[10,000].

### L-3 · Liability cap amount (brief Q3)
**Found:** peers cap at fees for 3 months (ShootProof), 6 months (Pic-Time), 12 months (Squarespace, Photta), or $20 (Format), with floors of $20–$100. Florida enforces clear exculpatory clauses (*Sanislo*, Fla. 2015) but disfavours them.
**Draft:** greater of **$50** (`LIABILITY_FLOOR_USD`) or fees paid in the last 12 months; excludes indirect losses; doesn't apply to fraud, gross negligence, wilful misconduct.
**Question:** right number? Should consumers and business users be treated differently?

### L-4 · 18+ and how to enforce it (brief Q4)
**Found:** ShootProof and Format require 18. COPPA only bites with actual knowledge of under-13s; the FTC recommends neutral age questions (FAQ H.3).
**Draft:** Terms say 18+; accounts of younger users are closed.
**Proposal (not built):** add "I'm 18 or older" to the existing required sign-up checkbox (GAP-ANALYSIS §3).
**Question:** is a self-declaration enough, or should we ask for a date of birth? What to do with minors' content when closing their account?

### L-5 · Paid-plan wording (brief Q5, Q16)
**Found:** CA ARL §17602 (as amended July 2025): disclosure next to the buy button, separate express consent, 3-year consent records, online cancellation, 7–30 days' notice of price changes, reminders for yearly plans. FL §501.165 likely covers the yearly plan: 30–60 days' notice before renewal. Polar MST: Polar is reseller; Folio must disclose refund eligibility (9.5); if the product becomes unavailable, keep access or refund pro-rata (6.4).
**Draft:** Polar as merchant of record; auto-renewal; cancel via Polar portal or email; no refund for a started period except where law requires or Folio's error; pro-rata refund if Folio closes or ends an account without fault; deleting an account ends Pro without refund; 30 days' email notice of price changes; downgrade keeps everything.
**Questions:** (a) Does Polar's checkout satisfy the ARL's disclosure and consent requirements for Folio, or does Folio need its own disclosure and consent record (GAP G-03)? (b) Is a yearly-plan reminder required from Folio if Polar doesn't send one (G-04)? (c) Is "no refund on account deletion" OK, given MST 6.4? (d) Does the FTC's §5/ROSCA still require anything beyond this now that the click-to-cancel rule is vacated? (e) Are the 150-photo downgrade rules described well enough?

### L-6 · Address hold and suspension without notice (brief Q6)
**Draft:** 12-month hold, possibly returned to the former owner; may act without warning when urgent or required by law/safety; "write to us and we'll look again".
**Question:** fine as drafted? Should there be a formal appeal step?

### L-7 · Repeat-infringer policy and `/copyright` (brief Q2)
**Found:** §512(i) needs a reasonably implemented policy communicated to users; §512(g)(2) needs restore in 10–14 business days.
**Draft:** "At 3 strikes we take the site offline and close accounts that keep infringing"; counter-notice elements and 10–14 business days now on `/copyright`.
**Note:** the code doesn't suspend automatically; staff must (GAP G-05).
**Question:** is "take offline, and close accounts that keep infringing" an adequate "termination in appropriate circumstances"? Should strikes expire?

### L-8 · Model releases, minors, galleries (brief Q13, Q14)
**Draft:** users promise consent the law requires, typically a model release for portfolio use; written guardian permission for identifiable minors; show permissions on request; galleries: files are addressable, downloads are web copies, client contracts are the photographer's.
**Question:** is "consent the law requires" right, or should it be "a signed release from every identifiable person" (ShootProof's stricter version)? Anything else for galleries (e.g. a clause that clients get no rights from Folio)?

## Privacy

### L-9 · GDPR / UK GDPR applicability (brief Q8)
**Found:** EDPB 3/2018: accessibility, English and an email address aren't targeting; USD-only, US-run, no EU marketing points away from Art. 3(2)(a); Folio's analytics aren't profiling (3(2)(b)). Hosting in Frankfurt doesn't by itself bring a non-EU controller in. If GDPR applies, an Art. 27 representative is probably needed (paid service).
**Draft:** an "EU and UK" paragraph with lawful bases, rights and complaint right, without claiming GDPR applies or is complied with.
**Question:** agree GDPR probably doesn't apply? If it might, appoint a representative now, or block EU sign-ups, or accept the risk?

### L-10 · Cookie banner (brief Q10)
**Found:** all Folio cookies are strictly necessary; Turnstile is security; Vercel Analytics is cookieless but its script sends data (EDPB 2/2023 reads Art. 5(3) broadly).
**Recommendation:** no banner for US users. For EU/UK visitors, either (a) no banner + clear disclosure (draft), or (b) skip analytics for EU/UK visitors (easy, Vercel knows the country).
**Question:** (a) or (b)?

### L-11 · Israel (brief Q8; brief "where I am")
**Found:** Amendment 13 in force Aug 14, 2025; §11 notice duty; secondary sources disagree on reach to foreign controllers; the operator runs Folio from Israel during his gap year.
**Draft:** an "Israel" line on access/correction and whether giving information is mandatory.
**Question:** needs an Israeli lawyer: does running `/admin` and support from Israel make this a database "in Israel"? Any registration, DPO or security-regulation duty?

### L-12 · Staff access wording (brief Q9)
**Draft:** staff see every account; admins can open the dashboard as the user for 30 minutes with a logged reason, see messages and make changes but can't delete, change address/profile, export, or sign out; private notes; actions logged.
**Question:** enough? Should users be notified after an impersonation session?

### L-13 · Legal holds (brief Q11)
**Draft:** hold after a court order, subpoena, law-enforcement preservation request or legal claim; nothing deleted; user not always told.
**Question:** right triggers? Is "not always told" acceptable, or should users be told unless a gag order applies? Should holds be reviewed on a schedule?

### L-14 · Retention periods (brief Q7) — owner decisions
| Data | Today | My suggestion |
|---|---|---|
| Reports and DMCA notices | Forever | 3 years after closing (17 U.S.C. §507(b) limitations period) |
| Admin log | Forever, keeps a deleted account's email | 3 years; anonymise the email on deletion |
| Taken-down originals | Until restored/deleted | 12 months after takedown unless disputed or on hold |
| Support inbox | Forever | 3 years |
| Released addresses | Rows forever (hold 12 months) | Delete after 12 months |
| Neon restore window | Plan-dependent | 7 days; confirm plan |
**Question:** acceptable? Any legal minimum (tax records are Polar's)?

### L-15 · Breach plan (brief Q12)
**Found:** FL §501.171: 30 days to notify individuals, AG if 500+ Floridians, CRAs if 1,000+; email + password counts as personal information; vendors must notify within 10 days.
**Draft:** promise to notify "without unreasonable delay … as the law requires".
**Question:** does a salted scrypt hash make the password "rendered unusable" (exempting a breach)? Is a one-page written plan enough?

### L-16 · US state privacy laws (brief Q7)
**Found:** below CCPA ($26.625M / 100k consumers) and FDBR ($1B) thresholds; FL §501.715 (no sale of sensitive data) applies to all, and Folio sells nothing.
**Draft:** "below the size at which most of those laws apply", rights offered to all, no sale/sharing.
**Question:** fine to say "below the size"? Any state law that applies regardless of size that I've missed?

## Business

### L-17 · LLC (brief Q15)
Not researched in depth. Notes: the Terms, Privacy, DMCA agent registration and Polar account all name David as an individual. Forming an LLC would need: updating `OPERATOR_*` in `lib/legal.ts`, amending the DMCA designation, moving the Polar account, and probably a notice of change under the Terms (an assignment clause is in the draft).

### L-18 · Trademark and insurance (brief Q17, Q18)
Not researched in this pass (Alexia's notes mention a USPTO search and cyber insurance).

### L-19 · CSAM reporting
**Found (general knowledge, not fetched):** 18 U.S.C. §2258A requires providers to report apparent CSAM to NCMEC. **Question:** confirm the duty and the steps (registering with the CyberTipline, preservation).
