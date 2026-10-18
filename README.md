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

Locally there's nothing to set up. Each production service has a local stand-in, used whenever its environment variables are missing:

| Piece | Production | Locally (and in tests) |
| --- | --- | --- |
| Database | Postgres (Neon) via `DATABASE_URL` | PGlite (the same Postgres, running inside Node) in `data/pg/` |
| Photos | Cloudflare R2 | `data/uploads/` |
| Email | Resend | Printed to the dev server's console |
| Rate limits | Upstash Redis | Counted in memory |

`data/` is git-ignored. If you have accounts from before the move to Postgres (`data/db.json`), copy them across once with `npm run import-json` while the dev server is stopped.

## Scripts

| Command | What it does |
| --- | --- |
| `npm test` | Every `tests/*.test.ts` file: unit tests, plus server actions and routes run in plain Node with Next's cookies, redirects and cache stubbed (`tests/stubs/`, `tests/helpers.ts`). Each run uses its own empty data folder, never `data/` (see `tests/setup.ts`) |
| `npm run test:smoke` | Checks a running server; set `BASE_URL` to test a deployment |
| `npm run import-json` | Copies accounts from the old JSON database (`data/db.json`) into Postgres. Safe to re-run. Set `DATABASE_URL` to import into a real server. |
| `npm run backfill-photos` | Makes web-sized copies of photos uploaded before resizing existed. Works on `data/db.json`, so run it before `import-json`. Stop the dev server first. |

GitHub Actions (`.github/workflows/ci.yml`) runs lint, type checks, `npm test`, a production build and `npm run test:smoke` on every push to `main` and every pull request.

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
| Database (Postgres, one jsonb row per account) | `lib/db.ts`, connection in `lib/pg.ts` |
| Photo storage (R2 or local disk), direct uploads | `lib/uploads.ts`, `app/api/uploads` (local only) |
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
| `FOLIO_DATA_DIR` | Local folder for PGlite and photos | `data` |
| `DATABASE_URL` | Postgres connection string (Neon: use the pooled one). **Required in production.** | PGlite in `data/pg` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API token with read and write access to both buckets | photos on local disk |
| `R2_PUBLIC_BUCKET`, `R2_PUBLIC_URL` | Bucket for the web copies, and its public address (custom domain or r2.dev URL) | |
| `R2_PRIVATE_BUCKET` | Bucket for the originals. Never make it public. | |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend key, and the sender, e.g. `Folio <hello@yourapp.com>` on a domain verified in Resend | printed to the console (refuses in production) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis, for rate limits shared by every server | in memory |

Set all six R2 variables or none: a partial setup stops the app at startup.

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

With R2, originals go to the private bucket and web copies to the public one, which visitors load directly from `R2_PUBLIC_URL`. Hosts like Vercel cap a request to the app at about 4.5 MB, so photos don't pass through the app:

1. The browser asks for an upload address (`startPhotoUpload`). It's a signed R2 address that works for 10 minutes and accepts only the declared type and exact size, at most 20 MB.
2. The browser sends the photo straight to the private bucket.
3. `finishPhotoUpload` reads it back, checks that it's a real image within the limit, makes the web copies, and adds it to the account. A bad file is deleted.

Without R2 (local development), photos go through the app with `uploadPhotos`.

## Before going to production

Accounts and keys:
- **Neon:** create a project and set `DATABASE_URL` to its pooled connection string. The tables are created on first start. To bring over local accounts, run `DATABASE_URL=… npm run import-json`.
- **Cloudflare R2:**
  - Create two buckets: a public one for web copies, with a custom domain (or the r2.dev address), and a private one for originals.
  - Create an API token with read and write access to both, then set the six `R2_*` variables.
  - Give the **private** bucket a CORS rule so browsers can upload to it directly:
    ```json
    [{ "AllowedOrigins": ["https://yourapp.com"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
    ```
- **Resend:** verify your domain (it gives you DNS records to add), then set `RESEND_API_KEY` and `EMAIL_FROM`.
- **Upstash:** create a Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- **Session secret:** generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` and set it as `SESSION_SECRET`.

Domain:
- Point the domain and a wildcard record (`*.yourapp.com`) at your host, and add both there.
- Set `NEXT_PUBLIC_ROOT_DOMAIN`.

Decisions:
- Whether new sites start as drafts (`NEW_SITES_START_PUBLISHED` in `lib/site.ts`).

Known gap: a photo uploaded directly to R2 but never finished (say the tab closed in between) stays in the private bucket. It's at most 20 MB and visible to no one. A cleanup job can come later.
