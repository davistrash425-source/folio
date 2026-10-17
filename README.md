# Folio — portfolio sites for photographers

1. A photographer signs up and claims a site address.
2. They upload photos, then add a description and location to each one.
3. They group photos into albums, and design the site in the Web design editor: pages (home,
   galleries, about, contact…), each page's sections, theme, colors, fonts, gallery layout and captions. Design
   changes stay in a draft (with a live preview) until they publish them.
4. They add their name, bio, contact details and social links.
5. Their site is live at `name.<root domain>`, with album pages like `name.<root domain>/weddings`,
   a full-screen photo viewer, and a contact form that lands in their dashboard inbox.

## Running locally

```bash
npm run dev
```

- App: http://localhost:3000
- A photographer's site: http://yourname.localhost:3000 (`*.localhost` resolves to your machine in Chrome, Edge and Firefox)

Data is stored in `data/` (git-ignored): `data/db.json` for accounts and `data/uploads/` for photos.

Emails (password reset, email confirmation, new inquiries) are printed to the dev server's console until an email provider is connected in `lib/email.ts`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (image processing, slugs, zip export) |
| `npm run test:smoke` | Checks a running server; set `BASE_URL` to test a deployment |
| `npm run backfill-photos` | Makes web-sized copies of photos uploaded before resizing existed. Stop the dev server first. |

## How it fits together

| Piece | Where |
| --- | --- |
| Subdomain routing (`name.domain` → `/sites/name`) | `proxy.ts` |
| Sign up / log in / log out | `app/(auth)`, `app/actions/auth.ts`, `lib/session.ts` |
| Dashboard: Manage website tab (side panel pages) | `app/dashboard/manage/*`, `app/dashboard/layout.tsx` |
| Dashboard: Preview website tab | `app/dashboard/preview`, `app/site-preview` |
| Site design model (what the editor edits) | `lib/design.ts`, `app/actions/design.ts` |
| Web design editor | `app/dashboard/design-editor.tsx` |
| Public site themes (one file each) | `app/sites/[subdomain]/themes/`, picked in `renderer.tsx` |
| Theme names and descriptions | `lib/themes.ts` (themes), `lib/templates.ts` (Classic looks) |
| Browser-side photo compression | `lib/compress-image.ts` |
| Database (JSON file) | `lib/db.ts` |
| Photo storage (local disk) | `lib/uploads.ts`, `app/api/uploads` |
| Resizing and metadata stripping | `lib/images.ts` |
| Photos, albums, inquiries, site online/offline | `app/actions/site.ts` |
| Password reset, email confirmation, account deletion | `app/actions/auth.ts`, `lib/tokens.ts` |
| Rate limiting | `lib/rate-limit.ts` |
| Data export (.zip) | `app/api/export`, `lib/zip.ts` |
| Email | `lib/email.ts` |

## Environment variables

| Name | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Domain sites live under, e.g. `yourapp.com` | `localhost:3000` |
| `SESSION_SECRET` | Signs login cookies. **Required in production.** | dev-only value |

## How site design works

Each account has a `SiteDesign` object (`lib/design.ts`): theme, colors, fonts, gallery style, captions, which albums appear, and the site's **pages**. Each page has a name, an address (`/about`), a menu setting and an ordered list of sections: header, gallery (all photos, chosen photos or one album, with an optional layout of its own), album links, about, text and contact. It's validated with a zod schema, and the renderer draws the site from it.

- Addresses: `/` is the first page, `/<page>` the other pages, and `/<album>` each album. If a page and an album share an address, the page wins (the editor and album creation warn about this).
- Older designs are upgraded when read: version 1 (one page) and version 2 (before there were separate themes) become Classic with the same look, colors and pages. Accounts that never saved a design keep their original one-page layout. New accounts start with Classic and a home page and an About page.

- The editor saves to `draftDesign`. Publishing copies it to `design`, which is what visitors see. The last 20 saved drafts are kept for Undo.
- The dashboard preview frames (`/site-preview`) show the draft. The editor sends unsaved changes to the frame with `postMessage`, so the preview updates instantly.
- Accounts created before designs existed get the preset for their original template.
- A future AI assistant only has to return a new `SiteDesign` that passes the schema; the placeholder box in the editor marks where it goes.

## Themes

A site is drawn by one of four themes, each with its own layout code in `app/sites/[subdomain]/themes/`. They all read the same content (pages, sections, photos, albums, captions, bio), so switching themes never loses anything.

| Theme | What it is | Settings |
| --- | --- | --- |
| **Classic** | Clean pages, fully editable | Look (17 starting looks), colors, fonts, gallery layouts, header styles |
| **Exhibition** | A gallery wall: photos hang in one row you scroll sideways (one at a time, vertically, on phones) with museum wall labels | Wall color, label position |
| **Index** | A big typeset list of the work; hover a line to see the photo (phones get thumbnails) | Highlight color, list order |
| **Film strip** | Frames on strips of film with sprocket holes, edge print and frame numbers; text on taped paper notes | Film stock, frame numbers |

- The three creative themes set their own layout, colors and fonts. The editor hides Classic's controls for them, and Classic's settings are kept for when you switch back.
- Classic's 17 looks (Minimal, Sepia Print, Polaroid…) are color, font and gallery presets, not separate layouts.
- To add a theme: write a component that takes `{ site }`, register it in `renderer.tsx`, add it to `THEMES` in `lib/design.ts` (with settings in `themeSettingsSchema`) and to `lib/themes.ts`, and add a miniature to `ThemeArt` in the editor. Themes can use the helpers in `themes/shared.ts`: `currentPage`, `navItems`, `pageGalleries` (one lightbox for the whole page), `visibleSections`.
- Fonts for the creative themes are in `themes/fonts.ts` with `preload: false`, so a site only downloads the fonts its theme uses.

## How photos are stored

Photos over 20 MB are compressed in the browser before upload (`lib/compress-image.ts`): shrunk to at most 8000px or 40 megapixels and re-encoded at the highest quality that fits, so the stored original is the compressed version. Animated GIFs over 20 MB and HEIC files are refused with a clear message.

Each upload is kept as the original (`<id>.orig.<ext>`, never served, included in the account export) plus WebP copies at 640, 1280 and 2048px wide with EXIF and GPS data removed. The public site picks a size with `srcset`.

## Before going to production

- Connect an email provider in `lib/email.ts` (it refuses to run in production until you do).
- Replace the JSON file database (`lib/db.ts`) with a real database.
- Replace the `storage` object in `lib/uploads.ts` with object storage (S3, R2, Vercel Blob).
- Move rate limiting (`lib/rate-limit.ts`) to a shared store if you run more than one server.
- Generate a session secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- Decide whether new sites start as drafts (`NEW_SITES_START_PUBLISHED` in `lib/site.ts`).
- Point a wildcard DNS record (`*.yourapp.com`) at your host and add the wildcard domain there.
