import { redirect } from "next/navigation";
import { findUserById } from "./db";
import { getSession } from "./session";

// The signed-in user, or null. A login cookie only counts if its account
// still exists (cookies outlive deleted accounts) and it was issued after the
// account's last "sign out everywhere" (a password reset does that too).
export async function currentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;
  if (user.sessionsValidFrom && session.issuedAt < user.sessionsValidFrom) return null;
  return user;
}

// Returns the signed-in user or sends them to /login.
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
