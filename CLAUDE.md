# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Folio: a Next.js 16 app where photographers sign up, upload photos, design a site in an editor, and publish it at `name.<root domain>`. README.md has the product walkthrough, theme details and the pre-launch checklist.

## Commands

```bash
npm run dev            # http://localhost:3000; a site at http://<subdomain>.localhost:3000
npm run lint
npx next typegen       # route types (PageProps, RouteContext) — needed before tsc on a fresh checkout
npx tsc --noEmit
npm test               # every tests/*.test.ts
npm run build
npm run test:smoke     # against a running server; BASE_URL=https://… to target a deployment
```

One test file, or tests by name:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup.ts --test tests/db.test.ts
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup.ts --test --test-name-pattern="export" "tests/*.test.ts"
```

CI (`.github/workflows/ci.yml`) runs lint → typegen → tsc → `npm test` → build → smoke test against `npm start`.

## Tests run in plain Node, not Next

There is no Jest/Vitest. `tests/setup.ts` (loaded via `--import`) does three things every test depends on:
- Points `FOLIO_DATA_DIR` at a fresh temp folder per test process, so tests never touch `data/`.
- Swaps `next/cache`, `next/headers`, `next/navigation` and `next/server` for the fakes in `tests/stubs/`. `redirect()` throws a `RedirectError`; `redirectedTo()` in `tests/helpers.ts` catches it. Cookies live in `cookieJar`, request headers in `requestHeaders`, and `revalidated` records cache invalidations.
- Resolves `@/…` and extensionless relative imports to `.ts` files the way the bundler would.

So server actions (`app/actions/*`) and route handlers are called directly as functions. `tests/helpers.ts` has the fixtures: `makeUser`, `signInAs`, `addPhoto`, `formOf`/`formWith`, `captureEmails` (dev email goes to `console.log`), `databaseText`.

## Architecture

**Subdomain routing.** `proxy.ts` (Next 16's replacement for middleware) rewrites `alice.<root>/x` to `/sites/alice/x`. `NEXT_PUBLIC_ROOT_DOMAIN` sets the root (default `localhost:3000`).

**Data layer.** Every read and write of accounts goes through the functions in `lib/db.ts`; nothing else talks to the database.
- `lib/pg.ts` connects to Postgres via `DATABASE_URL`, or, when unset (dev and tests), to PGlite saved in `<DATA_DIR>/pg`. Production refuses to start without `DATABASE_URL`.
- Each account is one `users` row: the whole `User` object in a `data` jsonb column, plus unique `email`/`subdomain` columns. One-time links are in `tokens`, stored as hashes only.
- All changes go through `updateUser(id, fn)`, which locks the row (`select … for update`), lets `fn` mutate the `User`, and saves it. If `fn` throws, nothing is saved.
- `User` fields added over time are optional, and older shapes are upgraded when read (e.g. `readDesign` in `lib/design.ts`). Keep new fields optional, or upgrade old shapes the same way.

**Auth.** `lib/session.ts` signs a `userId.expires` cookie with HMAC (`SESSION_SECRET`, required in production) and hashes passwords with scrypt. No session list is stored on the server.
- Every signed-in check goes through `currentUser()` or `requireUser()` in `lib/auth.ts`, never `getSession` directly. They also check that the account still exists, and that the cookie was issued after the account's `sessionsValidFrom`.
- A password reset and the "Sign out everywhere else" button both set `sessionsValidFrom`, which signs out every other device.
- Server actions never trust the page and always call one of these.

**Per-host files.** `proxy.ts` doesn't rewrite `/robots.txt` and `/sitemap.xml`. `app/robots.ts` and `app/sitemap.ts` read the Host header (`siteSubdomain` in `lib/site.ts`) and answer for the app or for one site.

**Limits and reports.** `MAX_PHOTOS` in `lib/uploads.ts` (2,000, a placeholder until plans exist) is checked before uploading and again inside `updateUser`. Every theme's footer has a `ReportLink` (`themes/report-link.tsx`) to `/report`; reports go into the `reports` table and to `REPORTS_EMAIL`. A `"use server"` file may only export async functions, so shared constants like `REPORT_REASONS` live in `lib/`.

**Public site caching.** `lib/public-site.ts` loads a site with `"use cache"` and tags it `site:<subdomain>`. `updateUser`, `createUser` and `deleteUser` in `lib/db.ts` invalidate that tag (`siteChanged`), so any account change refreshes the public site. Dashboard pages refresh with `revalidatePath("/dashboard", "layout")`. `next.config.ts` turns on `cacheComponents` and partial prerendering.

**Site design.** A `SiteDesign` (`lib/design.ts`, a zod schema) describes the whole site: theme, colors, fonts, pages, and each page's sections. The editor saves to `draftDesign` (keeping 20 earlier drafts for undo in `designHistory`), and publishing copies it to `design`. `app/sites/[subdomain]/renderer.tsx` picks a theme component from `themes/`. All themes read the same content, so switching themes loses nothing. README.md lists the steps for adding a theme.

**Photos.** Files larger than 20 MB are compressed in the browser first (`lib/compress-image.ts`).
- On upload, the original is saved as `<id>.orig.<ext>`. It is never served and is only included in the account export.
- `lib/images.ts` (sharp) makes WebP copies at 640, 1280 and 2048px with EXIF and GPS removed. `photoSource` builds the `srcset` from them.
- All file access goes through the `storage` object in `lib/uploads.ts`.
  - With the six `R2_*` variables it uses Cloudflare R2: originals in the private bucket, web copies in the public one, served from `R2_PUBLIC_URL`. Setting only some of them throws at startup.
  - Otherwise it writes to local disk under `<DATA_DIR>/uploads/<userId>/`, served by `app/api/uploads/[userId]/[file]`, which returns 404 for originals and non-image extensions.
- Uploads with R2 skip the app server, because Vercel caps request bodies at about 4.5 MB.
  - The browser calls `startPhotoUpload` for a presigned PUT address. Its type and exact size are signed, and it lasts 10 minutes.
  - The browser uploads to that address, then calls `finishPhotoUpload`, which reads the file back, validates it with sharp and makes the variants.
  - Without R2, `PhotoUploader` (`app/dashboard/editor.tsx`) falls back to the `uploadPhotos` form action.

**Swappable services.** Each production service is switched on by its env vars and has a local stand-in when they're missing:
- `sendEmail` in `lib/email.ts` uses Resend, and otherwise logs to the console (and throws in production).
- `rateLimit` in `lib/rate-limit.ts` is async. It uses Upstash Redis, and otherwise counts in memory. If Redis is unreachable it falls back to memory rather than locking users out.
- Tests fake the network for each of these with `t.mock.method(globalThis, "fetch", …)`.

## Environment variables

| Name | Purpose | When unset |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection (Neon in production) | PGlite in `<DATA_DIR>/pg`; production refuses to start |
| `SESSION_SECRET` | Signs login cookies | Dev-only value; production refuses to start |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Domain the sites live under | `localhost:3000` |
| `FOLIO_DATA_DIR` | Local data folder (PGlite database, uploaded photos) | `data/` (git-ignored) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_URL` | Photo storage on Cloudflare R2 (all six or none) | Local disk |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email through Resend | Console; production throws |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared rate limits | In memory |
| `REPORTS_EMAIL` | Inbox for site reports | Reports only saved in the database |

`NEW_SITES_START_PUBLISHED` in `lib/site.ts` decides whether new sites start live or as drafts.

## Launch plan and current state

Chosen setup: Vercel for hosting (with a wildcard `*.domain`), Postgres on Neon, Cloudflare R2 for photos (originals in a private bucket, web copies in a public one), Resend for email, and Upstash Redis for rate limits. The domain isn't bought yet (`folio.com` is taken), and whether Folio will be paid is undecided.

The order of work:
1. Move off local disk: database, photo storage with direct uploads, email and rate limits. This is done on the `move-to-postgres` branch, pending CI and a merge into `main`.
2. Deploy a staging copy on the real domain and run the smoke test against it.
3. Add terms and privacy pages (which need the owner's business details), Sentry and backups. The photo limit, reporting, sign-out-everywhere and robots/sitemaps are done.
4. Run a private beta.
5. Add billing and custom domains, if wanted.

Each storage piece swaps one module whose interface the rest of the app already uses: the functions in `lib/db.ts`, the `storage` object and `photoUrl` in `lib/uploads.ts`, `sendEmail` in `lib/email.ts`, and `rateLimit` in `lib/rate-limit.ts`. Keep those signatures stable.

## Working in this repo

- The machine is Windows. The shell tools are Git Bash and PowerShell, and git warns about LF→CRLF on every file (harmless).
- Commit only when asked, and ask before pushing. Small changes have gone straight to `main`; larger work like the infrastructure moves goes on a branch.
- Explain git and infrastructure terms in plain language; the owner has asked what a branch is. Keep status updates short: what's done, what's left, and what decision is needed from them.
- Each check (`tsc`, lint, tests, build) should pass before reporting work as done. The full test suite takes about 20s because each test file starts its own PGlite.

## Conventions

- Server actions return `{ error?, ok? }` for the form to show, and use `redirect()` for navigation.
- Tests are named as plain-English statements of behavior. Many check that one user can't reach another user's data (`tests/ownership.test.ts`, `tests/signed-out.test.ts`); add to those when adding an action.
- `npm run backfill-photos` and `npm run import-json` (copies an old `data/db.json` into Postgres) are one-time migration scripts in `scripts/`.
- The landing page's sample photos come from the owner's git-ignored `folio-homepage-photos/` folder: `npm run homepage-photos` writes the web copies to `public/home/` and the order to `app/ui/home-photos.json` (commit both).
