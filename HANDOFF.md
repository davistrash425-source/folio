# Handoff

**Status as of Oct 30, 2026.** Everything built so far is on `main` and live at www.folio.cam. **Paid plans (Folio Pro, Polar) are live in production since Oct 30** and a real purchase worked. Uncommitted on purpose (owner said don't commit): this file, `docs/BACKLOG.md`, `CLAUDE.md`, and the untracked `docs/FIX-PLAN.md`, `docs/NEW-SESSION-PROMPT.md`.

## What is live
- Free plan (150 photos) and Pro: 1,500 photos, 20 password-protected client galleries, 50 GB, editable and extra special themes (Contact sheet, Monograph), no gallery footer badge (`lib/plans.ts`).
- Polar billing in production: org `folio-camera` on polar.sh (Individual, identity verified, Stripe payouts connected, account review approved Oct 30). Products: Monthly $12 `369d04ad-f2d7-40a6-a418-885fc60d55e4`, Yearly $120 `f5226918-c23b-467c-b60b-918b6a6102b0`. API key "Folio" (no expiry; checkouts r/w, customer_sessions:write, subscriptions r/w). Webhook endpoint `3398fdf6-d3fe-45db-bb58-978c2d85470d` → `https://www.folio.cam/api/webhooks/billing`, Raw, API version 2026-10, all `subscription.*`; secret copyable on the endpoint page. DNS TXT `_polar-challenge.folio.cam` in Vercel DNS (`rec_08c1e78a8e048db296da6780`): keep it, Polar re-checks it. Vercel Production has all five `POLAR_*` (deployment `dpl_4J55uBiBdNFjGp8t8mydXAWsG2et`). Preview still points at the sandbox.
- Real-money test, Oct 30: purchase on a fresh account (`davistrash425@gmail.com`) → Plan page showed Folio Pro, all webhook deliveries 200; refunded and cancelled → Plan page shows "ends on November 30, 2026, you keep Pro until then" (correct for cancel-at-period-end). Not seen yet: an actual downgrade in production (happens Nov 30 for that account; check then that it drops to Free and the "plan has ended" email arrives), the yearly plan, a failed payment.
- Gotcha found: the first test purchase on `folio.user.001@gmail.com` was recorded but never granted Pro, because that account was once set with admin `setPlan` (`planSource: "manual"`, which webhooks never override, and nothing resets it). It was refunded. Backlog has an admin "let payments decide" item and a "what should a refund do" item (Polar's dashboard can't revoke immediately once a subscription is cancelled).
- On a downgrade nothing is deleted: `galleriesOpen` hides client galleries and `lib/public-site.ts` shows Classic instead of a saved Pro theme.
- Photos are stored in Cloudflare R2 (public address `img.foliocdn.com`; also served from each site's own host), CSP is enforced, DMCA agent is registered (DMCA-1084175, renew by Oct 2029).
- Legal pages are still drafts (`LEGAL_DRAFT = true` in `lib/legal.ts`).
- `/admin` works for `davifree425@gmail.com` (owner confirmed Oct 30; staff roles need a confirmed email).

## Still to do before a proper Pro launch (owner)
1. Lawyer review of Terms, Privacy and Copyright (brief: `docs/LAWYER-BRIEF.md`), then set `LEGAL_DRAFT=false`.
2. Vercel Pro plan (Hobby forbids commercial use). Owner chose to stay on Hobby until there are paying users.
3. The Claude Doc backlog got the Oct 30 billing edits (backlog tab only); its "Agent context" tab and any older Oct 28 differences were not re-checked.

## Just built (Oct 30, uncommitted)
Admin "Let payments decide" button: `letPaymentsDecide` in `app/actions/admin.ts` (full admin only, logged as `plan-from-payments`, sets `planSource: "billing"` and the plan from the saved `User.billing` via `grantsPro`, Free when none). The admin site page's Plan card now says whether the plan is hand-set and shows the subscription status; the button only appears for hand-set plans. Tests: two in `tests/billing.test.ts`, plus the action added to the signed-out/photographer and viewer lists in `tests/admin.test.ts` and `tests/admin-oversight.test.ts`. tsc, lint, all 479 tests and `npm run build` pass. Next: owner says whether to commit, push and deploy. Once deployed, use it on `folio.user.001@gmail.com`: its last saved subscription state is the cancelled-at-period-end one, so it will show Pro until Nov 30, 2026.

## Next coding work
`docs/FIX-PLAN.md`, Batch 1 first (pg pool error listener, `connection()` in Google cookie read, `impersonationBlock()` on remaining actions).

## Code review (Oct 28, 2026)
`docs/CODE-REVIEW-2026-10-28.md` is the list to work from: what was fixed and what is still open, most important first. It replaces the unverified `docs/FULL-CHECK-NOTES.md` (raw findings, kept for the IDs). The "Folio: Full Project Check" Claude Doc was never filled in and is superseded; ignore it.
- Fixed in PR #24 (merged and live): staff roles need a confirmed email; Google sign-in no longer lets a pre-registered password survive on an unconfirmed account; `/apiary`-style paths are rewritten; account deletion stops when Polar can't end the subscription; late events for an older subscription are ignored; admin `setPlan` refreshes the live site; takedown retries after a storage error; deletion refuses legal-hold accounts inside the SQL; finish can't re-publish a taken-down photo; the export no longer includes `legalHold` and lists unreadable photos in `MISSING-FILES.txt`; the orphan sweep skips legal-hold accounts.
- Biggest open items: ZIP export above 4 GiB, taken-down photos staying cached for a year, no pool `error` listener in `lib/pg.ts`, several actions missing `impersonationBlock()`, client galleries ignoring "site offline", low-contrast text and keyboard focus gaps. Details are in the review doc.
- **`docs/FIX-PLAN.md`** is the ordered execution plan for all open items, split into 11 self-contained batches. Work from it top-down.
- **Staff roles now require a confirmed email, and that is live.** The owner confirmed on Oct 30 that `/admin` still works for `davifree425@gmail.com` (the only `ADMIN_EMAILS` entry), so that account is confirmed.

## Branches
No open PRs; `main` is the only branch. (Old branches were deleted Oct 28; a backup bundle of all of them is in `Davi's Projects/folio-cleanup-backup-2026-10-28`, outside the repo.)

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
