# "Made with Folio" on client galleries: recommendation

Decided Oct 25, 2026: Free only (the badge is `folio-badge.tsx` in `app/sites/[subdomain]/g/[gallery]`, gated by `showFolioBadge` in `lib/plans.ts`). Original finding, before the badge existed: no "Made with Folio" link, and gallery pages had no footer. Galleries are Pro-only (`galleryLimit` is 0 on Free), so "Free only" would show the badge almost never.

- **Always:** best for growth, since clients see Folio. But Pro buyers pay and get no way to remove it, and clients may see it as less professional.
- **Free only:** the usual upsell lever, but here it does nothing, because only Pro can make galleries. Same as "never" in practice.
- **Never:** cleanest, most professional look for photographers' clients. No growth and no upsell.
- **Pick:** "Always", as a small muted text link at the foot, or "never" if you want Pro to feel premium. Do not choose "Free only" unless galleries open to Free accounts.
- **Decided Oct 25, 2026: "Free only", removed on Pro.** The code already does this (`GALLERY_FOLIO_BADGE = "free-only"` in `lib/plans.ts`). Caveat: Free accounts cannot create galleries today, so the badge will not show until galleries open to Free (or on a downgraded account).
