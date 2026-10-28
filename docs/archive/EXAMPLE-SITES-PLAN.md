# Example sites and landing photos (owner to-do item 8)

## State of the landing page photos
- `folio-homepage-photos/` (main checkout) holds 12 JPEGs, 1-19 MB each, mostly 3456x2304 landscape. One is portrait-ish (IMG_7133, 3241x3607).
- All 12 are already processed: `public/home/` has 12 WebP files and `app/ui/home-photos.json` lists the same 12. Running the script again changes nothing. Nothing to commit.

## What `npm run homepage-photos` needs
- Source: `folio-homepage-photos/` at the repo root (git-ignored; never commit originals).
- Formats: jpg, jpeg, png, webp, tif, tiff, avif. Any size; camera rotation is applied.
- Output: 600x400 WebP (cropped to fit, focus on the interesting part), no EXIF/GPS, in `public/home/<name>.webp`. Name comes from the file name (lowercased, dashes).
- Order: photos already in the JSON keep their name and place; new files go at the end; files deleted from the folder come off the list. To reorder, edit `app/ui/home-photos.json`.
- Landing page reads the list in `app/ui/frames.tsx`. Use landscape 3:2 photos; portraits are cropped to 3:2.
- Commit `public/home/` and `app/ui/home-photos.json` after running.

## Proposal: three example sites ("Made with Folio")
Each should show a different kind of photographer and a different theme, so visitors see range. Each is a real Folio account with a published design, built after you choose.

| # | Photographer type | Theme | Why | Photos needed |
| --- | --- | --- | --- | --- |
| A | Street / travel (matches your current photos) | Exhibition (free) | Horizontal gallery wall suits wide street frames | 12-15 landscape, 3-4 portrait |
| B | Wedding / portrait studio | Monograph (Pro) | Photo-book feel suits couples and slow storytelling | 14-18, mixed; at least 6 portrait |
| C | Editorial / documentary or product | Contact sheet (Pro) or Index (free) | Shows the proof-sheet or typeset-list style for working photographers | 20-24 landscape and portrait mixed |

Alternatives: Classic with a "Look" for a plain, conventional portfolio; Film strip for an analog/hobbyist photographer.

Each site also needs: a made-up name and subdomain (e.g. `example-street.folio.cam`), a short bio, 2-3 album names, a few captions.

Photo requirements: you own the rights (or the photographer has agreed in writing); at least 2048 px on the long edge; no recognisable people unless they have consented; no GPS worry (Folio strips it).

## Open choices for the owner
1. Which three types and themes (table above or alternatives)?
2. Whose photos: yours only, or invited photographers (needs their permission)?
3. Put photos per site in subfolders, e.g. `folio-example-photos/street/`, `.../wedding/`, `.../editorial/`, and tell Claude when ready.
4. Should the example accounts be on Pro (needed for Monograph and Contact sheet)? Staff can switch an account to Pro.
