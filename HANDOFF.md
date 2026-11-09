# Handoff

## Collapsible bottom preview in the design editor (Nov 9, 2026): in progress (worktree branch `claude/folio-collapsible-preview`, off main bc2c038)
- **Goal:** owner: when the screen is narrow and the preview docks at the bottom, make it collapsible, in the real editor too.
- **Done:** `app/dashboard/design-editor.tsx` on this branch: Collapse / Show preview button; collapsed = slim bar at the bottom; replaces the Hide link and floating button. Same markup as the Agents branch `claude/folio-agents-artifact-update-123ac4` (1b92e6e), which already has it.
- **Next:** owner OK'd shipping. PR from this branch; squash-merge once CI is green (merging deploys it). Lint, tsc, 552 tests, build and a temporary Playwright check at 800/390/1400px passed locally.
- **Gotchas:** Artifact https://claude.ai/artifact/42s7E2wVdkZhy9srYzKo6Y has a Code switch (Agents / main); its source was in a session scratchpad, not the repo. PR #35 (Client galleries text) is merged and deployed.

## Artifact of the Folio UI (Nov 8, 2026): Status: complete
- **Goal:** owner wanted a clickable Claude artifact of Folio's UI matching current `main` (cf82108), no "Folio Agents" (none exist on main; the parked AI box is left out).
- **Done:** private artifact https://claude.ai/artifact/42s7E2wVdkZhy9srYzKo6Y (landing, pricing, log in, sign up, every Manage page, Web design, Preview; sample data). Checked in Chrome at about 850px wide. Only this note changed in the repo.
- **Gotchas:** the per-album and per-gallery pages aren't included; the photographer themes are simplified copies. Claude in Chrome can't open `file://` pages.
- **Follow-up fix (Nov 9):** removed the outdated "which isn't open yet" from `app/dashboard/manage/galleries/page.tsx`, and from the artifact. The other "aren't open yet" messages only show when billing is off, so they stay. Owner OK'd shipping: PR from `claude/folio-website-ui-eb653c`; next step is squash-merge once CI is green (merging deploys it). tsc, lint, 552 tests and build pass locally.

## Finishing the owner to-do list (Nov 4, 2026): in progress (worktree branch `claude/project-status-50d31e`)
- **Goal:** owner wants the rest of this session spent completing: lawyer changes to legal pages, Cloudflare purge env vars, a real Google Drive upload test, the Nov 30 downgrade check, and the two backlog decisions.
- **Decisions (owner, Nov 4):** a full refund in Polar ends Pro right away (drop to Free; nothing deleted). Photos that are in a client gallery and not placed on the public site are left out of the public "all photos" page, plus a per-photo "Hide from site" toggle. Lawyer wants changes and to see the pages again, so `LEGAL_DRAFT` stays true.
- **Done (not committed):**
  - Refunds: `order.refunded`/`order.updated` with status `refunded` → `applyRefund` in `lib/billing-webhook.ts` revokes the subscription in Polar and drops to Free now (+ downgrade email); `User.billing.refundedSubscriptionIds` stops late events re-granting Pro. Partial refunds ignored; manual plans kept. 6 tests in `tests/billing.test.ts`.
  - Gallery-only photos: `lib/site-photos.ts` (`sitePhotos`, `galleryOnlyPhotoIds`); used by `siteData` (`lib/public-site.ts`) and the inquiry form (`app/actions/site.ts`). `Photo.hiddenFromSite` + "Hide from my public site" checkbox in `app/dashboard/photo-drawer.tsx`; library labels "Hidden from site" / "Client gallery only". Tests: `tests/site-photos.test.ts`.
  - Vercel Production: `CLOUDFLARE_PURGE_ZONE_ID` = foliocdn.com zone `4c1c39dd2d668f04733f957ff1f7316b` (added Nov 4).
  - tsc, lint, 552 tests and `npm run build` pass (ran `npm ci` in the worktree: Turbopack needs local node_modules).
  - Polar webhook endpoint now also sends `order.refunded` (ticked and saved Nov 4, owner OK'd).
  - Nov 30 check is moot: the Oct 30 test account was deleted Nov 1 (its subscription revoked then; webhook 200). davistrash425@gmail.com is now a new account `davif123`, Pro set by hand. No real downgrade has been seen in production yet; tests cover it. (A scheduled task for it was created then deleted.)
  - Owner set `CLOUDFLARE_PURGE_TOKEN` in Vercel Production (Nov 4); active from the next deploy. Owner tried a real Google Drive upload on www.folio.cam: works.
  - Backlog updated in `docs/BACKLOG.md` and the Claude Doc (Drive, purge, refund, gallery-photo items).
- **In progress / next:** PR for this branch; squash-merge once CI is green (deploys the code + activates the purge token). Then the lawyer changes once the owner pastes the notes.
- **Gotcha:** fresh worktree needs `npx next typegen` before `tsc`.
- **Open questions:** owner still to paste the lawyer's meeting notes.


## New-user polish (Nov 1, 2026): live (PR #30, merged into main)
- **Goal:** owner's notes: Google button below the fold on /signup; Free users can preview greyed-out Pro themes; design page collapsed except Theme with a Save button that opens the next; make the design tab easier.
- **Done:** Google button + "or sign up with email" divider at the top of signup and login (`app/ui/google-button.tsx` `OrDivider`, `app/ui/signup-form.tsx`, `app/(auth)/login/page.tsx`; auth layout spacing tightened). Design editor is 5 numbered steps (`Step` in `app/dashboard/design/ui.tsx`, replaced `Group`): Choose a theme, Colors and layout (Classic look/colors/fonts + gallery style, or the theme's settings), Pages, Captions and albums, About you. One open at a time; closed ones show a summary; "Save and continue" saves now and opens the next. Pro themes on Free: greyed with a Pro badge; click → popup → "Preview" shows it only in the preview frame (`previewTheme` in `app/dashboard/design-editor.tsx`, never saved) with a "Get Folio Pro / Stop preview" bar. `tests/e2e/header-photo.spec.ts` opens the Pages step first. tsc, lint, 525 tests, build pass; checked in Chrome on a local Free account (`preview-tester-1101@example.com`, local data only).
- CI (incl. browser tests) passed on the PR.

## Header photo on the Pro themes (Nov 1, 2026): live (PR #29)
- **Goal:** owner: "for the pro themes, there is no option to add a header photo, add that".
- **Done:** `HEADER_PHOTO_THEMES` (`lib/design.ts`: Classic + every Pro theme) gates `PageHeaderPhoto` (`app/dashboard/design-editor.tsx`) and the header section settings (`headerPhoto` prop, `app/dashboard/design/sections.tsx`). Shared `heroCover` in `themes/shared.ts` (Tag, Studio use it). New layouts: Contact Sheet = framed "Enlargement" under the title; Monograph = frontispiece above the title; Mosaic = edge-to-edge photo under the wordmark. Test in `tests/design.test.ts`. Checked in the browser on local example sites (local data only).
- Merged and deployed to production Nov 1. Local `main` had a stale copy of the logo commit; kept as branch `backup-local-main-c60f239` (safe to delete).

## Status (Oct 31, 2026): no open PRs
Everything is merged into `main` and deployed: #25 (bug-check fixes), #26 (Google Drive upload), #27 (header-photo browser test), #28 (three new Pro themes), plus the logo and two CI fixes. The owner asked for PRs to be managed end to end: bring the branch up to date with main, resolve conflicts, push, squash-merge once CI is green.

**CI gotcha:** Turbopack sometimes fails on Google Fonts with "next/font/google queries have exactly one entry" (Next.js 16.4.2 bug; hit both `next build` and the dev server in the browser test, about half the CI runs on #28). `.github/workflows/ci.yml` now retries the build and the browser test up to 3 times (each attempt logs a `::warning::`). A Vercel deploy could hit it too: if a deploy fails with that message, just redeploy. Mocking the fonts (`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`) was tried: Turbopack needs every exact font URL listed, so it was dropped.

## Three new Pro themes: Tag, Mosaic, Studio (Oct 31, 2026, PR #28, live)
`themes/tag.tsx`, `themes/mosaic.tsx`, `themes/studio.tsx`, fonts in `themes/fonts.ts` (Anton, Space Grotesk/Mono, Martian Mono with `wdth` axis, Instrument Sans/Serif), registered in `lib/design.ts`, `lib/themes.ts`, `renderer.tsx`, the editor and pricing. Design canvas: https://claude.ai/artifact/SnR4E3A6YDQojvoYobgxXB. Gotcha: a pre-existing `Date.now()` prerender error from `app/sites/[subdomain]/not-found.tsx` shows in the dev console on site pages.

## Google Drive upload (Oct 31, 2026): live (PR #26)
"Choose from Google Drive" on the upload page (`lib/google-drive.ts`, `app/dashboard/photo-uploader.tsx`); the button shows on www.folio.cam. Set up Oct 31 in Google Cloud project "folio" (`extreme-core-512711-c7`): Drive API and Picker API enabled; API key "Folio Drive picker (browser)" limited to `folio.cam/*`, `www.folio.cam/*`, `localhost:3000/*` and those two APIs; `drive.file` scope added (non-sensitive; the app is In production, so anyone can use it). Owner added `GOOGLE_PICKER_API_KEY` to Vercel Production. **Not yet tried:** a real sign-in, pick and upload. **Owner to do:** Privacy wording with the lawyer Nov 1 (Folio reads only the Drive files picked).

## Logo (Oct 31, 2026): done
Folio icon (ink tile, italic Newsreader F, red dot) replaced the Next.js favicon: `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`; `proxy.ts` lets them through on photographer subdomains too.

## Bug check + fixes (Oct 30, 2026): merged (PR #25)
- All findings fixed; full list and decisions: `docs/CODE-REVIEW-2026-10-30.md`.
- **Owner to do:** set `CLOUDFLARE_PURGE_TOKEN` + `CLOUDFLARE_PURGE_ZONE_ID` in Vercel (takedown cache purge); try the new email Confirm button once on production.
- **Gotchas:** the old worktrees `.claude/worktrees/fix-plan` and `status-vercel-pro` are redundant now that #25 is merged. `--color-rule` got much darker (#8f8879) for contrast, so every divider line is darker; revert in `app/globals.css` if the owner dislikes it.

## What is live
- Free plan (150 photos) and Pro: 1,500 photos, 20 password-protected client galleries, 50 GB, editable and extra special themes (Contact sheet, Monograph), no gallery footer badge (`lib/plans.ts`).
- Polar billing in production: org `folio-camera` on polar.sh (Individual, identity verified, Stripe payouts connected, account review approved Oct 30). Products: Monthly $12 `369d04ad-f2d7-40a6-a418-885fc60d55e4`, Yearly $120 `f5226918-c23b-467c-b60b-918b6a6102b0`. API key "Folio" (no expiry; checkouts r/w, customer_sessions:write, subscriptions r/w). Webhook endpoint `3398fdf6-d3fe-45db-bb58-978c2d85470d` → `https://www.folio.cam/api/webhooks/billing`, Raw, API version 2026-10, all `subscription.*`; secret copyable on the endpoint page. DNS TXT `_polar-challenge.folio.cam` in Vercel DNS (`rec_08c1e78a8e048db296da6780`): keep it, Polar re-checks it. Vercel Production has all five `POLAR_*` (deployment `dpl_4J55uBiBdNFjGp8t8mydXAWsG2et`). Preview still points at the sandbox.
- Real-money test, Oct 30: purchase on a fresh account (`davistrash425@gmail.com`) → Plan page showed Folio Pro, all webhook deliveries 200; refunded and cancelled → Plan page shows "ends on November 30, 2026, you keep Pro until then" (correct for cancel-at-period-end). Not seen yet: an actual downgrade in production (happens Nov 30 for that account; check then that it drops to Free and the "plan has ended" email arrives), the yearly plan, a failed payment.
- Gotcha found: the first test purchase on `folio.user.001@gmail.com` was recorded but never granted Pro, because that account was once set with admin `setPlan` (`planSource: "manual"`, which webhooks never override, and nothing resets it). It was refunded. Backlog has an admin "let payments decide" item and a "what should a refund do" item (Polar's dashboard can't revoke immediately once a subscription is cancelled).
- On a downgrade nothing is deleted: `galleriesOpen` hides client galleries and `lib/public-site.ts` shows Classic instead of a saved Pro theme.
- Photos are stored in Cloudflare R2 (public address `img.foliocdn.com`; also served from each site's own host), CSP is enforced, DMCA agent is registered (DMCA-1084175, renew by Oct 2029).
- Legal pages are still drafts (`LEGAL_DRAFT = true` in `lib/legal.ts`).
- `/admin` works for `davifree425@gmail.com` (owner confirmed Oct 30; staff roles need a confirmed email).

## Owner update (Oct 30)
The owner has moved to Vercel Pro and has fully launched Folio Pro. They meet the lawyer on Sunday, Nov 1, 2026.

## Still to do (owner)
1. Lawyer review of Terms, Privacy and Copyright (brief: `docs/LAWYER-BRIEF.md`; meeting Sunday, Nov 1, 2026), then set `LEGAL_DRAFT=false` and apply any wording changes the lawyer asks for.
2. The Cloudflare purge variables (above).
3. Try "Choose from Google Drive" once on www.folio.cam (sign in to Google, pick a photo, check it uploads).

## Just built (Oct 30, live in d686f65)
Admin "Let payments decide" button: `letPaymentsDecide` in `app/actions/admin.ts` (full admin only, logged as `plan-from-payments`, sets `planSource: "billing"` and the plan from the saved `User.billing` via `grantsPro`, Free when none). The admin site page's Plan card now says whether the plan is hand-set and shows the subscription status; the button only appears for hand-set plans. Tests: two in `tests/billing.test.ts`, plus the action added to the signed-out/photographer and viewer lists in `tests/admin.test.ts` and `tests/admin-oversight.test.ts`. tsc, lint, all 479 tests and `npm run build` pass. Pushed to `main` and live (deployment `dpl_H6qn6EPkAP96ZuEX9Fkjh1n9A2D3`, READY). Once deployed, use it on `folio.user.001@gmail.com`: its last saved subscription state is the cancelled-at-period-end one, so it will show Pro until Nov 30, 2026.

## Next coding work
Merge `bug-check-fixes`. Then what's left in `docs/CODE-REVIEW-2026-10-30.md` under "Still open" (per-photo hide flag needs the owner; `'unsafe-inline'` stays for now).

## Code reviews
`docs/CODE-REVIEW-2026-10-30.md` is current: everything from the Oct 28 review and the Oct 30 bug check is fixed on `bug-check-fixes`, with what's still open at the end. `docs/CODE-REVIEW-2026-10-28.md` and `docs/FIX-PLAN.md` are kept for reference. Staff roles require a confirmed email (live; `/admin` works for `davifree425@gmail.com`).

## Branches
`main` (live) and `bug-check-fixes` (this work, not pushed yet). Worktree branches `worktree-fix-plan` and `worktree-status-vercel-pro` are folded into `bug-check-fixes`. A backup bundle of the branches deleted Oct 28 is in `Davi's Projects/folio-cleanup-backup-2026-10-28`, outside the repo.

## Sandbox facts
Polar sandbox org `foliocam`; products Monthly `d11e5d3e-b633-4869-8f70-57a5299633de`, Yearly `fe2b76c3-bcd0-4502-99c2-a54a22300054`; token `folio-sandbox` expires Nov 25, 2026. The sandbox webhook (id `c3c351de-bb5e-4d2a-b051-84c163045dbd`) still points at a deleted preview URL with a Vercel protection-bypass secret; delete the secret and repoint or remove the webhook when the sandbox is no longer needed. Vercel Preview also has a branch-scoped `PRO_FOR_EVERYONE` variable for a deleted branch; it does nothing and can be removed in the dashboard.

## Gotchas
- Previews share the production `DATABASE_URL`, so anything done on a preview touches real accounts.
- An admin `setPlan` marks the plan as manual; webhooks never override it, so don't use it on an account under payment test.
- Lint with `npx eslint app lib tests proxy.ts`, not `npm run lint` (it scans `.claude/worktrees`).
- A `node_modules` junction into a worktree works for tsc and tests but not for the Turbopack build. Remove the junction with `rmdir` before deleting a worktree, or git follows it.
- The backlog lives in two places and both are edited together: `docs/BACKLOG.md` and the Claude Doc "Folio — Improvement Backlog" (https://claude.ai/artifact/2GPiZULFPDtucJhJ5WCXXF). The Claude Doc has not been synced with the Oct 28 edits.
- Windows: files are a mix of CRLF and LF; keep line endings when editing by script.
- Don't change production settings (Vercel env, DNS) or spend money without the owner's approval.
