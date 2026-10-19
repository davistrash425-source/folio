import { notFound } from "next/navigation";
import { requireUser } from "./auth";

// Folio's own staff: the accounts whose login email is listed in ADMIN_EMAILS
// (comma-separated). They can see every report and take content down.
export function isAdmin(user: { email: string }) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}

// The signed-in admin. Signed-out visitors go to the login page; anyone else
// gets "not found", so the admin pages don't reveal that they exist.
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}

// Upheld copyright notices an account can have before it's suspended under
// the repeat-infringer policy (the Copyright Policy states the same number).
export const STRIKE_LIMIT = 3;
