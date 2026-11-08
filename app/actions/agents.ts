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

// Only notes can be edited; the edit closes the old request and makes a new
// one that still needs its own click.
export async function reviseNote(id: string, text: string): Promise<Result> {
  const user = await requireUser();
  if (!agentsAllowed(user)) return { error: "Folio AGENTS isn't available on this account." };
  const approval = await findApproval(user.id, String(id));
  if (!approval || approval.kind !== "save_note") return { error: "That request can't be edited." };
  const clean = String(text).replace(/\r\n/g, "\n").trim();
  const { error, ok } = await reviseAction(approval.id, { text: clean }, "Your edited note");
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
