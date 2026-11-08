"use server";

import { revalidatePath } from "next/cache";
import { impersonationBlock, requireUser } from "@/lib/auth";
import { findApproval, stopAgentTask } from "@/lib/db";
import { agentsAllowed } from "@/lib/plans";
import { approveAction, rejectAction, reviseAction } from "@/lib/agents/approvals";

type Result = { ok?: string; error?: string };

const done = (result: Result): Result => {
  revalidatePath("/dashboard", "layout");
  return result;
};

// The gate checks the sign-in, the account and impersonation itself.
export async function approve(id: string): Promise<Result> {
  return done(await approveAction(String(id)));
}

export async function reject(id: string): Promise<Result> {
  return done(await rejectAction(String(id)));
}

// Only a note's text or a reply's body can be edited; the edit closes the old
// request and makes a new one that still needs its own click. Everything else
// in the action (who it goes to, from where, the subject) stays as it was.
export async function reviseNote(id: string, text: string): Promise<Result> {
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked };
  const user = await requireUser();
  if (!agentsAllowed(user)) return { error: "Folio AGENTS isn't available on this account." };
  const approval = await findApproval(user.id, String(id));
  if (!approval || (approval.kind !== "save_note" && approval.kind !== "send_email_reply")) return { error: "That request can't be edited." };
  const clean = String(text).replace(/\r\n/g, "\n").trim().slice(0, 20_000);
  if (!clean) return { error: "That edit isn't valid." };
  if (approval.kind === "save_note") {
    const { error, ok } = await reviseAction(approval.id, { text: clean }, "Your edited note");
    return done({ error, ok });
  }
  const { error, ok } = await reviseAction(approval.id, { ...(approval.action as object), body: clean }, "Your edited reply");
  return done({ error, ok });
}

export async function stopTask(id: string): Promise<Result> {
  const user = await requireUser();
  if (!agentsAllowed(user)) return { error: "Folio AGENTS isn't available on this account." };
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked };
  await stopAgentTask(user.id, String(id));
  return done({ ok: "Stopped." });
}
