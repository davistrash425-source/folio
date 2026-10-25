import { redirect } from "next/navigation";
import { findUserById, type User } from "./db";
import { getImpersonation, getManager, getSession } from "./session";

// Folio's own staff, by login email. ADMIN_EMAILS (comma-separated) are full
// admins: they can see every report, take content down and have as many sites
// as they like (see currentAdmin). ADMIN_VIEWER_EMAILS are read-only staff:
// they can look at every admin page but can't change anything.
const emailList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export type StaffRole = "admin" | "viewer";

export function adminRole(user: { email: string }): StaffRole | null {
  const email = user.email.toLowerCase();
  if (emailList(process.env.ADMIN_EMAILS).includes(email)) return "admin";
  if (emailList(process.env.ADMIN_VIEWER_EMAILS).includes(email)) return "viewer";
  return null;
}

// Full admins only; viewers are not admins in this sense.
export function isAdmin(user: { email: string }) {
  return adminRole(user) === "admin";
}

// The full admins' login emails, for filtering the accounts list.
export const adminEmails = () => emailList(process.env.ADMIN_EMAILS);

// Whether a login cookie issued at `issuedAt` still counts for this account:
// not if it was issued before the account's last "sign out everywhere" (a
// password reset does that too).
const stillValid = (user: User, issuedAt: number) => !user.sessionsValidFrom || issuedAt >= user.sessionsValidFrom;

// The account this browser is logged in as, or null. A login cookie only
// counts if its account still exists (cookies outlive deleted accounts) and is
// still valid. An admin's extra site (User.managedBy) is only signed in
// alongside that admin's own manager cookie, while they are still an admin.
async function loggedInAccount() {
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

// An admin looking at someone's account as that person ("Log in as this
// user"). It only counts while all of this still holds, checked on every
// request: the impersonation cookie is signed and unexpired, the logged-in
// account is the admin named in it, is their own account (not an extra site)
// and is still a full admin, and the target still exists and is an ordinary
// photographer (never staff, never an admin's extra site).
export async function currentImpersonation() {
  const cookie = await getImpersonation();
  if (!cookie) return null;
  const admin = await loggedInAccount();
  if (!admin || admin.id !== cookie.adminId || admin.managedBy || !isAdmin(admin)) return null;
  const target = await findUserById(cookie.targetId);
  if (!target || target.id === admin.id || target.managedBy || adminRole(target)) return null;
  return { admin, target, expires: cookie.expires };
}

// The signed-in user, or null: the account being impersonated while an admin
// is doing that, otherwise the account this browser is logged in as. Because
// this is the target, the admin pages and actions (which need staff) don't
// work while impersonating.
export async function currentUser() {
  const impersonation = await currentImpersonation();
  if (impersonation) return impersonation.target;
  return loggedInAccount();
}

// Actions that must not run while an admin is looking at someone's account as
// them (changing the account itself, deleting it, signing it out, exporting
// it). Returns the message to show, or null when it's fine to go ahead.
export async function impersonationBlock() {
  return (await currentImpersonation()) ? "Not available while you’re viewing this account as an admin. Stop viewing it first." : null;
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

// The staff member behind the current login, with their role, or null. A full
// admin counts while switched to one of their extra sites; a read-only viewer
// counts only on their own account.
export async function currentStaff() {
  const user = await currentUser();
  if (!user) return null;
  if (user.managedBy) {
    const manager = await managerOf(user);
    return manager ? { user: manager, role: "admin" as const } : null;
  }
  const role = adminRole(user);
  return role ? { user, role } : null;
}

// Returns the signed-in user or sends them to /login.
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
