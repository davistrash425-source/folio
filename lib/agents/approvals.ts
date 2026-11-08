// The approval gate. Agents can only propose; an action runs only after the
// photographer clicks Approve, and only once.
//
// What makes that hold, in code rather than in a prompt:
// - No agent tool can approve. approveAction reads the login cookie itself, and
//   the background worker has no cookie, so an approval can only come from a
//   signed-in browser request. Staff viewing an account as its owner are refused.
// - runApproved first flips the row from approved to used in one guarded update,
//   so two requests can't both run it. It runs at most once: a failure afterwards
//   is reported, never retried, because a retried send could go out twice.
// - The stored action must still match the hash taken when it was proposed, so
//   an action altered after that isn't run. Editing a draft makes a new approval.
import { createHash } from "crypto";
import { currentUser, impersonationBlock } from "../auth";
import {
  consumeApproval,
  createApproval,
  decideApproval,
  findApproval,
  findUserById,
  setApprovalOutcome,
  type Approval,
} from "../db";
import { agentsAllowed } from "../plans";
import { executorFor, ExecutorRefused } from "./executors";

export type ApprovalResult = { ok?: string; error?: string };

const NOT_ALLOWED = "Folio AGENTS isn't available on this account.";
const GONE = "That request has already been handled.";

// Postgres's jsonb doesn't keep key order, so the hash is taken over a form
// with the keys sorted.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((key) => [key, canonical(object[key])]),
    );
  }
  return value;
}

export function actionHash(kind: string, action: unknown) {
  return createHash("sha256")
    .update(JSON.stringify([kind, canonical(action)]))
    .digest("hex");
}

// Called by agents' tools. Stores the request and does nothing else.
export async function proposeAction(input: {
  userId: string;
  taskId?: string;
  kind: string;
  summary: string;
  action: unknown;
}): Promise<Approval> {
  const executor = executorFor(input.kind);
  if (!executor) throw new Error("UNKNOWN_ACTION");
  const action = executor.schema.parse(input.action);
  return createApproval({
    userId: input.userId,
    taskId: input.taskId,
    kind: input.kind,
    summary: input.summary.slice(0, 500),
    action,
    actionHash: actionHash(input.kind, action),
  });
}

// The signed-in photographer behind this request, or why they can't decide.
async function decider() {
  // In this order on purpose: an impersonation cookie expiring between the two
  // checks can then only make this the admin's own account, never the target's.
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked };
  const user = await currentUser();
  if (!user || !agentsAllowed(user)) return { error: NOT_ALLOWED };
  return { user };
}

// What an approval will do, from the action itself, for the Approvals page.
export function describeApproval(approval: Pick<Approval, "kind" | "action">) {
  try {
    return executorFor(approval.kind)?.describe(approval.action) ?? "This kind of request is no longer available.";
  } catch {
    return "This request can't be read.";
  }
}

export async function approveAction(id: string): Promise<ApprovalResult> {
  const who = await decider();
  if (!who.user) return { error: who.error };
  const approval = await decideApproval(who.user.id, id, "approved", who.user.email);
  if (!approval) return { error: GONE };
  return runApproved(who.user.id, id);
}

export async function rejectAction(id: string): Promise<ApprovalResult> {
  const who = await decider();
  if (!who.user) return { error: who.error };
  const approval = await decideApproval(who.user.id, id, "rejected", who.user.email);
  return approval ? { ok: "Rejected. Nothing was done." } : { error: GONE };
}

// The photographer changed a draft. The old request is closed and a new one
// takes its place, which still needs its own click.
export async function reviseAction(id: string, action: unknown, summary?: string): Promise<ApprovalResult & { approval?: Approval }> {
  const who = await decider();
  if (!who.user) return { error: who.error };
  const old = await findApproval(who.user.id, id);
  if (!old || old.status !== "pending") return { error: GONE };
  const executor = executorFor(old.kind);
  if (!executor?.schema.safeParse(action).success) return { error: "That edit isn't valid." };
  if (!(await decideApproval(who.user.id, id, "rejected", who.user.email))) return { error: GONE };
  const approval = await proposeAction({
    userId: who.user.id,
    taskId: old.taskId ?? undefined,
    kind: old.kind,
    summary: summary ?? old.summary,
    action,
  });
  return { ok: "Updated. Approve it to go ahead.", approval };
}

// Carries out an approved action, at most once. It needs a row some browser
// request already moved to "approved"; scheduled posts (phase 5) will call
// this later, which is why it is separate from approveAction.
export async function runApproved(userId: string, id: string): Promise<ApprovalResult> {
  const user = await findUserById(userId);
  if (!user || !agentsAllowed(user)) return { error: NOT_ALLOWED };
  const approval = await consumeApproval(userId, id);
  if (!approval) return { error: GONE };
  const executor = executorFor(approval.kind);
  if (!executor || actionHash(approval.kind, approval.action) !== approval.actionHash) {
    console.error("Approval refused: its action doesn't match what was approved", approval.id);
    await setApprovalOutcome(userId, id, "failed");
    return { error: "That request was changed after it was made, so it wasn't carried out." };
  }
  try {
    const ok = await executor.run(user, approval.action);
    await setApprovalOutcome(userId, id, "done");
    return { ok };
  } catch (err) {
    // A refusal's message is written by our code, safe to show and not worth logging.
    if (err instanceof ExecutorRefused) {
      await setApprovalOutcome(userId, id, "failed").catch(() => {});
      return { error: err.message };
    }
    // The name only: an error's message can quote a client's words.
    console.error("Approved action failed", approval.id, approval.kind, (err as Error).name);
    await setApprovalOutcome(userId, id, "failed").catch(() => {});
    return { error: "That didn't work, and it won't be retried automatically." };
  }
}
