"use server";

// Admins can have as many sites as they like. Each extra site is an account
// of its own (User.managedBy), and the admin switches between their sites.
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { currentAdmin, requireUser } from "@/lib/auth";
import { createUser, findUserById, findUserBySubdomain, subdomainOnHold, updateUser } from "@/lib/db";
import { clearManager, createSession, setManager } from "@/lib/session";
import { ADDRESS_HOLD_MONTHS, validateSubdomain } from "@/lib/site";

export type SiteFormState = { error?: string; fields?: Record<string, string> };

// The admin behind this login. Signed-out visitors go to the login page;
// anyone else is told the action doesn't exist.
async function requireSiteOwner() {
  const admin = await currentAdmin();
  if (!admin) {
    await requireUser();
    notFound();
  }
  return admin;
}

export async function createSite(_prev: SiteFormState, formData: FormData): Promise<SiteFormState> {
  const admin = await requireSiteOwner();
  const name = String(formData.get("name") ?? "").trim();
  const subdomain = String(formData.get("subdomain") ?? "").trim().toLowerCase();
  const fields = { name, subdomain };
  const taken = { error: "That address is taken — try another.", fields };

  if (!name) return { error: "Please enter a name for the site.", fields };
  const invalid = validateSubdomain(subdomain);
  if (invalid) return { error: invalid, fields };
  if (await subdomainOnHold(subdomain, ADDRESS_HOLD_MONTHS, admin.id)) {
    return { error: "That address belonged to another site recently, so it’s held for a year. Try another.", fields };
  }
  if (await findUserBySubdomain(subdomain)) return taken;

  let siteId: string;
  try {
    // The email is never used: nobody signs in to the site directly.
    const site = await createUser({
      name,
      subdomain,
      email: `${randomUUID()}@sites.folio.invalid`,
      passwordHash: "",
      published: true,
    });
    siteId = site.id;
  } catch (err) {
    if ((err as Error).message === "SUBDOMAIN_TAKEN") return taken;
    throw err;
  }
  await updateUser(siteId, (u) => {
    u.managedBy = admin.id;
    u.emailVerified = true;
    u.profile.contactEmail = admin.profile.contactEmail || admin.email;
  });
  await createSession(siteId);
  await setManager(admin.id);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/manage/upload");
}

// Signs in as one of the admin's sites: their own account or an extra site.
export async function switchSite(siteId: string) {
  const admin = await requireSiteOwner();
  if (siteId === admin.id) {
    await createSession(admin.id);
    await clearManager();
  } else {
    const site = await findUserById(siteId);
    if (!site || site.managedBy !== admin.id) notFound();
    await createSession(site.id);
    await setManager(admin.id);
  }
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/manage/photos");
}
