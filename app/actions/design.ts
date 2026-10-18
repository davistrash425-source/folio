"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { updateUser } from "@/lib/db";
import { designSchema, type SiteDesign } from "@/lib/design";
import { draftDesign, publishedDesign } from "@/lib/public-site";

const HISTORY_LIMIT = 20;

export type DesignResult = {
  error?: string;
  draft?: SiteDesign; // the saved draft after the action
  published?: SiteDesign; // what visitors see after the action
  canUndo?: boolean;
};

// Also checks the account still exists, so a login cookie left over from a
// deleted account can't save anything.
async function currentUserId() {
  return (await requireUser()).id;
}

function done(draft: SiteDesign, published: SiteDesign, historyLength: number): DesignResult {
  revalidatePath("/dashboard", "layout");
  return { draft, published, canUndo: historyLength > 0 };
}

// Validates and saves the photographer's draft. Visitors don't see it until
// publishDesign. The previous draft goes on the undo stack.
export async function saveDraftDesign(input: unknown): Promise<DesignResult> {
  const userId = await currentUserId();
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That design isn't valid." };

  const user = await updateUser(userId, (u) => {
    const previous = draftDesign(u);
    if (JSON.stringify(previous) === JSON.stringify(parsed.data)) return;
    u.designHistory = [...(u.designHistory ?? []), previous].slice(-HISTORY_LIMIT);
    u.draftDesign = parsed.data;
  });
  return done(draftDesign(user), publishedDesign(user), user.designHistory?.length ?? 0);
}

// Saves the draft and makes it what visitors see.
export async function publishDesign(input: unknown): Promise<DesignResult> {
  const saved = await saveDraftDesign(input);
  if (saved.error || !saved.draft) return saved;
  const draft = saved.draft;
  const user = await updateUser(await currentUserId(), (u) => {
    u.design = draft;
  });
  revalidatePath(`/sites/${user.subdomain}`, "layout");
  return done(draftDesign(user), publishedDesign(user), user.designHistory?.length ?? 0);
}

// Goes back to the previously saved draft.
export async function undoDesign(): Promise<DesignResult> {
  const userId = await currentUserId();
  const user = await updateUser(userId, (u) => {
    const history = u.designHistory ?? [];
    const previous = history.pop();
    if (!previous) return;
    u.draftDesign = previous;
    u.designHistory = history;
  });
  return done(draftDesign(user), publishedDesign(user), user.designHistory?.length ?? 0);
}

// Throws away unpublished changes: the draft becomes the published design.
export async function discardDraftDesign(): Promise<DesignResult> {
  return saveDraftDesign(publishedDesign(await requireUser()));
}
