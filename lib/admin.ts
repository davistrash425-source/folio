import { notFound } from "next/navigation";
import { currentAdmin, isAdmin, requireUser } from "./auth";

export { isAdmin };

// The signed-in admin (also while they're switched to one of their extra
// sites). Signed-out visitors go to the login page; anyone else gets "not
// found", so the admin pages don't reveal that they exist.
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) {
    await requireUser();
    notFound();
  }
  return admin;
}

// Upheld copyright notices an account can have before it's suspended under
// the repeat-infringer policy (the Copyright Policy states the same number).
export const STRIKE_LIMIT = 3;
