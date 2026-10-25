# Photo domain plan (owner to-do item 7)

**Status: done Oct 26, 2026.** The owner bought `foliocdn.com` on Cloudflare (option a). `img.foliocdn.com` is connected to `folio-photos`, the cache rule uses an edge TTL of 1 day (not the month suggested below, to keep takedowns quick) and a browser TTL of 1 year, and `R2_PUBLIC_URL` is `https://img.foliocdn.com`. The old `r2.dev` address is still enabled; disabling it is optional (step 4). The text below is the original plan, written Oct 25, 2026, before any of it was done.

## What we found (read-only)

- `folio.cam` uses **Vercel's nameservers** (`ns1/ns2.vercel-dns.com`), not Cloudflare. Vercel holds its DNS, including the wildcard `*` record Vercel manages for photographers' sites, the Resend email records and the ImprovMX mail-forwarding records.
- R2's "Custom Domains" feature only accepts a domain whose DNS zone is active on Cloudflare. So `photos.folio.cam` is **not possible** as things stand. The two ways round it are bad:
  - Moving all of `folio.cam` to Cloudflare DNS: possible, but it moves the wildcard, the email records and the certificate setup for every photographer site. Risky for little gain.
  - Keeping `folio.cam` on Vercel and pointing only `photos` at Cloudflare (a "partial/CNAME setup"): that is a Cloudflare Business-plan feature, so it costs far more than a domain.
- The code needs nothing changed:
  - `photoUrl` in `lib/uploads.ts` builds every address as `${R2_PUBLIC_URL}/<userId>/<file>` when the app runs, and strips a trailing slash. Nothing is stored in the database with the old host, so existing photos move over on their own.
  - `lib/security-headers.ts` takes the origin of `R2_PUBLIC_URL` for `img-src` and `connect-src`, so the policy follows the variable. `tests/r2.test.ts` already uses `https://photos.example.com`.
  - `next.config.ts` has no `images`/`remotePatterns` setting, and photos are plain `<img>` with a `srcset`, so no image-host list needs updating. `next/image` is used only in `app/ui/frames.tsx`, for local files.
- One thing to know: the current value may include a path (the test uses `https://pub-abc.r2.dev/folio-photos`). A custom domain serves the bucket at its root, so the new value is just `https://<domain>` with no path.

## Options

| | (a) Second domain, e.g. `folio-photos.com` | (b) `photos.folio.cam` |
| --- | --- | --- |
| Works with R2 | Yes: the whole domain's DNS lives on Cloudflare | No, unless DNS for all of `folio.cam` moves to Cloudflare, or you pay for Cloudflare Business |
| Cost | About $11.25 a year for a `.com` (Vercel's price; Cloudflare Registrar sells at wholesale cost, usually a little less, check at checkout). Cloudflare's free plan and R2 custom domain cost nothing extra | Free if it were possible, but it is not on the free plan |
| Risk to the main site | None, folio.cam DNS is untouched | Moving nameservers could break wildcard sites and email |
| Cookies | The photo host is a different site, so your login cookie is never sent with photo requests. Smaller requests, nothing to leak | A subdomain of folio.cam would receive folio.cam cookies if any were scoped to the parent domain (ours are host-only, but this is a thing to keep watching) |
| Who holds DNS | Cloudflare for the photo domain, Vercel for folio.cam | One place, if moved |

**Recommendation: (a), a second domain.** Pick a short `.com` (names such as `folio-photos.com` or `foliocdn.com`; availability is not checked, search at purchase time). It is the only route that is cheap, free of risk to the live site, and supported by R2 on the free plan. Ask Claude to check availability and the exact price first if you want. Buy it at Cloudflare Registrar (simplest, because it is then on Cloudflare automatically), or elsewhere and change its nameservers to Cloudflare's.

## Click-by-click steps (about 30 minutes, owner only)

1. **Get the domain on Cloudflare.**
   - Cloudflare dashboard → Domain Registration → Register Domains → search, buy. (If bought elsewhere: Cloudflare → Add a domain → Free plan, then at the registrar replace the nameservers with the two Cloudflare gives you and wait until Cloudflare shows "Active".)
2. **Connect it to the public bucket.**
   - Cloudflare → R2 Object Storage → bucket `folio-photos` → Settings → Custom Domains → Connect Domain.
   - Enter the domain you want photos on, for example `img.folio-photos.com` (or the bare domain). Continue → Connect Domain. Cloudflare adds the DNS record itself. Wait until the status says Active (a few minutes).
3. **Cache rules.** (The default already caches images; this makes it strong and consistent.)
   - Make sure the bucket's custom domain has **Min TLS 1.2** (same Settings page).
   - Cloudflare → the photo domain → Caching → Cache Rules → Create rule. Name: `Photos long cache`. When: Hostname equals `img.folio-photos.com`. Then: Eligible for cache; Edge TTL: Ignore cache-control header and use 1 month; Browser TTL: Override, 1 year. Deploy.
   - Why this is safe: photo files get a new id when a photographer uploads a replacement, and removed photos are deleted from the bucket. One caveat: after a takedown, a copy can stay in Cloudflare's cache for up to the edge TTL. For an urgent takedown, use Caching → Configuration → Purge Cache → Custom Purge with the photo's address. If that is not acceptable, set Edge TTL to 1 day.
   - Leave **Smart Tiered Cache** on if offered (free).
4. **Turn off the old address.** Do this only after step 6 passes: bucket Settings → Public Development URL → Disable. That removes the rate-limited `r2.dev` link.
5. **Change the variable in Vercel.**
   - Vercel → project `folio` → Settings → Environment Variables → `R2_PUBLIC_URL` → Edit → `https://img.folio-photos.com` (no trailing slash needed, no path). Apply to Production (and Preview if it is set there).
   - Deployments → latest → ⋯ → Redeploy. The security policy picks up the new host in the same redeploy.
6. **Verify.**
   - Open a published site, such as `https://<subdomain>.folio.cam`, with DevTools → Network → Img. Photo requests should go to the new domain and return 200.
   - Check headers on one photo: `cf-cache-status: MISS` on the first load and `HIT` on a reload. Content type `image/webp`.
   - Console should show no "[Report Only] Refused to load" lines for the new host.
   - In the dashboard, upload one new photo and confirm it shows.
   - Open an original-file address in the private bucket: it must still not load (the private bucket is untouched by this change).
7. **Roll back if needed.** Put the old `R2_PUBLIC_URL` back in Vercel and redeploy. Nothing else was changed, so rollback is just that.

Do owner checklist item 4 (enforcing the CSP) after this, so the policy is checked against the final photo address.

## Code changes

None needed. No test added: `tests/r2.test.ts` and `tests/security-headers.test.ts` already cover URL building and the policy following the variable.
