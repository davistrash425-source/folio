# "Made with Folio" on client galleries: recommendation

Finding: no "Made with Folio" link exists today. Theme footers only carry the Report link, and gallery pages have no footer. Galleries are Pro-only (`galleryLimit` is 0 on Free), so "Free only" would show the badge almost never.

- **Always:** best for growth, since clients see Folio. But Pro buyers pay and get no way to remove it, and clients may see it as less professional.
- **Free only:** the usual upsell lever, but here it does nothing, because only Pro can make galleries. Same as "never" in practice.
- **Never:** cleanest, most professional look for photographers' clients. No growth and no upsell.
- **Pick:** "Always", as a small muted text link at the foot, or "never" if you want Pro to feel premium. Do not choose "Free only" unless galleries open to Free accounts.
- The code defaults to "free-only" (as asked), so nothing shows until you choose. Change `GALLERY_FOLIO_BADGE` in `lib/plans.ts` (one line).
