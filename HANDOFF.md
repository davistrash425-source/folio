# Handoff

**Status as of Oct 28, 2026.** Everything built so far is on `main` and live at www.folio.cam. Paid plans are still closed: the `POLAR_*` variables exist in Vercel Preview only, so nobody can check out in production. There are no feature branches; the only open PRs are docs (see "Open PRs").

## What is live
- Free plan (150 photos) and the Pro features in code: 1,500 photos, 20 password-protected client galleries, 50 GB, editable and extra special themes (Contact sheet, Monograph), no gallery footer badge (`lib/plans.ts`).
- Polar billing (`lib/billing.ts`, `lib/billing-webhook.ts`, `app/api/webhooks/billing`, Plan page, public `/pricing`). Sandbox-tested end to end on a preview (buy, cancel, uncancel, end); the field names match real events. Not tested: the yearly plan, the downgrade email, a failed payment.
- On a downgrade nothing is deleted: `galleriesOpen` hides client galleries and `lib/public-site.ts` shows Classic instead of a saved Pro theme.
- Photos are stored in Cloudflare R2 (public address `img.foliocdn.com`; a later change also serves them from each site's own host), CSP is enforced, DMCA agent is registered (DMCA-1084175, renew by Oct 2029).
- Legal pages are still drafts (`LEGAL_DRAFT = true` in `lib/legal.ts`).

## Before Pro can launch (all need the owner)
1. Lawyer review of Terms, Privacy and Copyright (brief: `docs/LAWYER-BRIEF.md`, in open PR #17), then set `LEGAL_DRAFT=false`.
2. Vercel Pro plan (Hobby forbids commercial use).
3. A separate production Polar account: the two products ($12/month, $120/year), an access token, and a webhook to `https://www.folio.cam/api/webhooks/billing`.
4. `POLAR_*` in Vercel Production with `POLAR_SERVER=production`, then one real $12 purchase and a refund.

## Known problems (from the paused full check, not yet verified)
Read `docs/FULL-CHECK-NOTES.md` (about 150 raw findings, many duplicates, written before the check was verified). Confirmed in code on Oct 28:
- Admin `setPlan` (`app/actions/admin.ts`) passes `publicChange: false`, but the public site reads `plan`, so a staff plan change doesn't show on the live site until the cache refreshes.
- `cancelSubscriptionFor` (`lib/billing.ts`) logs a Polar failure and deletes the account anyway, so a subscription can keep billing.
- The stale-webhook check in `applyBillingEvent` only compares events for the same subscription id, so a late "active" event for an older subscription can restore Pro.
The check itself is unfinished: quality gates on `origin/main`, adversarial verification of the high findings, and the merged report doc ("Folio: Full Project Check", https://claude.ai/artifact/LTmpe1539z4gJjQAUcwKJ5, only the skeleton exists).

## Open PRs
- #23 Keeps `docs/FULL-CHECK-NOTES.md` and four finished planning docs in `docs/archive/`, plus one backlog fact.
- #19 Backlog and owner checklist refresh.
- #17 `docs/LAWYER-BRIEF.md`.
Merge these and no branches are left. (Old branches were deleted Oct 28; a backup bundle of all of them is in `Davi's Projects/folio-cleanup-backup-2026-10-28`, outside the repo.)

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
