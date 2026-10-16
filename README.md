# Folio — portfolio sites for photographers

1. A photographer signs up and claims a site address.
2. They upload photos (drag and drop), put them in order and describe them.
3. They pick a style (Minimal, Gallery Dark, or Editorial) and can group photos into albums.
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
| Dashboard (photos, style, profile) | `app/dashboard`, `app/actions/site.ts` |
| Public site and templates | `app/sites/[subdomain]` |
| Database (JSON file) | `lib/db.ts` |
| Photo storage (local disk) | `lib/uploads.ts`, `app/api/uploads` |
| Resizing and metadata stripping | `lib/images.ts` |
| Albums, inquiries, publish toggle | `app/actions/site.ts`, `app/dashboard/panels.tsx` |
| Password reset, email confirmation, account deletion | `app/actions/auth.ts`, `lib/tokens.ts` |
| Rate limiting | `lib/rate-limit.ts` |
| Data export (.zip) | `app/api/export`, `lib/zip.ts` |
| Email | `lib/email.ts` |

## Environment variables

| Name | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Domain sites live under, e.g. `yourapp.com` | `localhost:3000` |
| `SESSION_SECRET` | Signs login cookies. **Required in production.** | dev-only value |

## How photos are stored

Each upload is kept as the original (`<id>.orig.<ext>`, never served, included in the account export) plus WebP copies at 640, 1280 and 2048px wide with EXIF and GPS data removed. The public site picks a size with `srcset`.

## Before going to production

- Connect an email provider in `lib/email.ts` (it refuses to run in production until you do).
- Replace the JSON file database (`lib/db.ts`) with a real database.
- Replace the `storage` object in `lib/uploads.ts` with object storage (S3, R2, Vercel Blob).
- Move rate limiting (`lib/rate-limit.ts`) to a shared store if you run more than one server.
- Generate a session secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- Decide whether new sites start as drafts (`NEW_SITES_START_PUBLISHED` in `lib/site.ts`).
- Point a wildcard DNS record (`*.yourapp.com`) at your host and add the wildcard domain there.
