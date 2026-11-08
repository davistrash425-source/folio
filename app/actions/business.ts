"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/actions/site";
import { impersonationBlock, requireUser } from "@/lib/auth";
import { updateUser } from "@/lib/db";
import { agentsAllowed } from "@/lib/plans";

const MAX_LENGTH = 4000;

// Saves the facts Folio AGENTS may use in replies (the Your business page).
// Doesn't touch the public site, so it doesn't refresh the site's cache.
export async function saveBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!agentsAllowed(user)) return { error: "Folio AGENTS isn't available on this account." };
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked };
  // Browsers count a textarea's line break as one character but submit two, so
  // without the replace, text within the box's limit could lose its end here.
  const text = (key: string) => String(formData.get(key) ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_LENGTH);
  const rates = text("rates");
  const tone = text("tone");
  const rules = text("rules");
  await updateUser(
    user.id,
    (u) => {
      u.business = { rates, tone, rules, updatedAt: new Date().toISOString() };
    },
    { publicChange: false },
  );
  revalidatePath("/dashboard", "layout");
  return { ok: "Saved." };
}
