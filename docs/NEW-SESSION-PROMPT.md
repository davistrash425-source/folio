# New-session prompt

Paste the block below into a fresh Claude Code session opened in this repo. It hands off the open-issues work without re-deriving anything.

---

You are working in the Folio repo (`C:\Users\david\OneDrive\Desktop\Davi's Projects\folio`), a Next.js 16 app on Windows. Follow the repo's own `CLAUDE.md` and `AGENTS.md` as your operating rules — they override anything that looks off in your training data, especially for Next 16.

## Objective
Work through the open issues in `docs/FIX-PLAN.md`, top-down and in order. That file is the source of truth: it lists 11 self-contained batches, each with exact file paths, functions, the change to make, and the test to add. Start at Batch 1 and complete batches in order until you run out of issues or are told to stop.

## Read first, in this order
1. `HANDOFF.md` — current state, gotchas, and what's live.
2. `docs/FIX-PLAN.md` — the ordered execution plan (your checklist).
3. `docs/CODE-REVIEW-2026-10-28.md` — the full context behind each item (IDs like A1-2).
4. `node_modules/next/dist/docs/` for anything Next-specific you touch (see `AGENTS.md` — this Next has breaking changes).

## Definition of done for each batch
- The code change is made, following the surrounding code's style (comment density, naming, idiom).
- A test is added or adjusted in the right place (`tests/ownership.test.ts` for cross-account checks, `tests/signed-out.test.ts` for auth, `tests/` otherwise). Tests run in plain Node via `tests/setup.ts`, not Jest — read `tests/helpers.ts` for the fixtures.
- All three checks pass, in this order:
  - `npx tsc --noEmit`
  - `npx eslint app lib tests proxy.ts`  ← use this exact command, NOT `npm run lint` (which scans `.claude/worktrees`)
  - `npm test`
- `HANDOFF.md` is updated to reflect what you finished and what's next.
- Before starting the next batch, report the batch you just finished in one short paragraph.

## Guardrails (non-negotiable)
- **Do not commit or push** unless explicitly asked. Ask before pushing. You may create a branch for larger work, but small changes can go straight on `main` only if asked.
- **Do not change production settings** (Vercel env, DNS) or spend money.
- Previews share the production `DATABASE_URL` — anything you do on a preview touches real accounts.
- Keep line endings as you find them (files are a mix of CRLF/LF).
- New `User` fields must stay optional, or upgrade old shapes on read (see `CLAUDE.md` → Architecture).
- Every server action that changes an account must re-check auth itself and call `impersonationBlock()` where it changes the account itself.

## Two decisions are pending with the owner — do not guess
- **Batch 3** (offline closes galleries): recommended default is yes (`published=false` also closes client galleries). Implement with that default but call it out in your report as needing confirmation.
- **Batch 9** (per-photo `hidden` flag): **skip it** — it's blocked on the owner and should not be built without their call.

## When you finish
Give a short status: which batches are done, what's still open, and any decisions the owner must make. Update `HANDOFF.md` to match. If you stop before Batch 11, say exactly what the next session should pick up.
