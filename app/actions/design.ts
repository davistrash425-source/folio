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

// Autosaves within this long of the last undo step join that step, so one
// burst of editing is undone at once instead of a keystroke at a time.
const HISTORY_COALESCE_MS = 30_000;

// Validates and saves the photographer's draft. Visitors don't see it until
// publishDesign. The previous draft goes on the undo stack, except that
// autosaves close together share one entry.
export async function saveDraftDesign(input: unknown, opts?: { autosave?: boolean }): Promise<DesignResult> {
  const userId = await currentUserId();
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That design isn't valid." };
  const autosave = opts?.autosave === true;

  const user = await updateUser(
    userId,
    (u) => {
      const previous = draftDesign(u);
      if (JSON.stringify(previous) === JSON.stringify(parsed.data)) return;
      const now = Date.now();
      const joinsLastStep = autosave && u.designHistoryAt !== undefined && now - u.designHistoryAt < HISTORY_COALESCE_MS;
      if (!joinsLastStep) u.designHistory = [...(u.designHistory ?? []), previous].slice(-HISTORY_LIMIT);
      if (autosave) u.designHistoryAt = joinsLastStep ? u.designHistoryAt : now;
      else delete u.designHistoryAt;
      u.draftDesign = parsed.data;
    },
    { publicChange: false },
  );
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
  const user = await updateUser(
    userId,
    (u) => {
      const history = u.designHistory ?? [];
      const previous = history.pop();
      if (!previous) return;
      u.draftDesign = previous;
      u.designHistory = history;
      // The next edit starts a new undo step.
      delete u.designHistoryAt;
    },
    { publicChange: false },
  );
  return done(draftDesign(user), publishedDesign(user), user.designHistory?.length ?? 0);
}

// Throws away unpublished changes: the draft becomes the published design.
export async function discardDraftDesign(): Promise<DesignResult> {
  return saveDraftDesign(publishedDesign(await requireUser()));
}
