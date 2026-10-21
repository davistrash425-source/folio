import { redirect } from "next/navigation";
import { findUserById, type User } from "./db";
import { getManager, getSession } from "./session";

// Folio's own staff: the accounts whose login email is listed in ADMIN_EMAILS
// (comma-separated). They can see every report and take content down, and
// can have as many sites as they like (see currentAdmin).
export function isAdmin(user: { email: string }) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}

// Whether a login cookie issued at `issuedAt` still counts for this account:
// not if it was issued before the account's last "sign out everywhere" (a
// password reset does that too).
const stillValid = (user: User, issuedAt: number) => !user.sessionsValidFrom || issuedAt >= user.sessionsValidFrom;

// The signed-in user, or null. A login cookie only counts if its account
// still exists (cookies outlive deleted accounts) and is still valid.
// An admin's extra site (User.managedBy) is only signed in alongside that
// admin's own manager cookie, while they are still an admin.
export async function currentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user || !stillValid(user, session.issuedAt)) return null;
  if (user.managedBy) {
    const manager = await managerOf(user);
    if (!manager) return null;
  }
  return user;
}

async function managerOf(site: User) {
  const cookie = await getManager();
  if (!cookie || cookie.userId !== site.managedBy) return null;
  const admin = await findUserById(cookie.userId);
  if (!admin || !stillValid(admin, cookie.issuedAt) || !isAdmin(admin)) return null;
  return admin;
}

// The admin behind the current login, or null: the signed-in admin, or the
// admin who switched to one of their extra sites.
export async function currentAdmin() {
  const user = await currentUser();
  if (!user) return null;
  if (user.managedBy) return managerOf(user);
  return isAdmin(user) ? user : null;
}

// Returns the signed-in user or sends them to /login.
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
