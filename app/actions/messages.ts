"use server";

import { revalidatePath } from "next/cache";
import { impersonationBlock, requireUser } from "@/lib/auth";
import { deleteMessage, findMessage, recordMessageReading, setMessageRead } from "@/lib/db";
import { draftReply } from "@/lib/agents/message-out";
import { agentsAllowed } from "@/lib/plans";

type Result = { ok?: string; error?: string };
type DraftActionResult = { ok?: boolean; approvalId?: string; error?: string };

// The photographer's own clicks in the Inbox, each scoped to their account.
async function guard() {
  // This check first: an impersonation cookie expiring between the two can
  // then only leave the admin's own account, never the target's.
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked } as const;
  const user = await requireUser();
  if (!agentsAllowed(user)) return { error: "Folio AGENTS isn't available on this account." } as const;
  return { user } as const;
}

const done = <T>(result: T): T => {
  revalidatePath("/dashboard", "layout");
  return result;
};

export async function draftReplyAction(id: string): Promise<DraftActionResult> {
  const g = await guard();
  if ("error" in g) return g;
  const result = await draftReply(g.user, String(id));
  if ("error" in result) return done<DraftActionResult>({ error: result.error });
  return done<DraftActionResult>({ ok: true, approvalId: result.approvalId });
}

export async function setMessageReadAction(id: string, read: boolean): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  if (!(await findMessage(g.user.id, String(id)))) return { error: "That message wasn't found." };
  await setMessageRead(g.user.id, String(id), Boolean(read));
  return done({ ok: read ? "Marked as read." : "Marked as unread." });
}

export async function deleteMessageAction(id: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  if (!(await findMessage(g.user.id, String(id)))) return { error: "That message wasn't found." };
  await deleteMessage(g.user.id, String(id));
  return done({ ok: "Deleted." });
}

// The reader can be wrong. This lets the photographer overrule a scam label,
// so a real client can be answered.
export async function markNotScamAction(id: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  const message = await findMessage(g.user.id, String(id));
  if (!message) return { error: "That message wasn't found." };
  await recordMessageReading(g.user.id, message.id, {
    label: "REPLY SOON",
    kind: message.kind === "scam" ? "other" : message.kind ?? "other",
    summary: message.summary ?? "",
    suggestedAction: "You marked this as not a scam.",
  });
  return done({ ok: "Marked as not a scam." });
}
