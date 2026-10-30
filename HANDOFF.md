# Handoff

## Current task (Oct 30, 2026): bug check + fix everything — code done, not merged
- **Goal:** owner asked for a full multi-agent bug check, then "fix everything, go with your recommendations, update all docs".
- **Done:** all findings fixed on branch `bug-check-fixes`, which also carries the Oct 29 FIX-PLAN work (it was uncommitted in `.claude/worktrees/fix-plan`, applied here) and the Vercel Pro docs commit `7d884e3` (cherry-picked from `worktree-status-vercel-pro`). Full list and decisions: `docs/CODE-REVIEW-2026-10-30.md`. tsc, eslint, `npm run build` and 513/513 tests pass. Docs updated: CLAUDE.md, README.md, both review docs, FIX-PLAN.md, BACKLOG.md and the Claude Doc (both tabs).
- **In progress:** committing on the branch. Next: ask the owner before pushing; then a PR, CI, merge, check the Vercel deploy.
- **Owner to do after merge:** set `CLOUDFLARE_PURGE_TOKEN` + `CLOUDFLARE_PURGE_ZONE_ID` in Vercel (takedown cache purge); try the new email Confirm button once on production.
- **Gotchas:** the old worktrees `.claude/worktrees/fix-plan` and `status-vercel-pro` are now redundant (their work is on this branch); remove them only after the branch is merged. `--color-rule` got much darker (#8f8879) for contrast, so every divider line is darker; revert in `app/globals.css` if the owner dislikes it.

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
2. After `bug-check-fixes` is merged: the Cloudflare purge variables (above).

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
