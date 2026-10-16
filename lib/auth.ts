import { redirect } from "next/navigation";
import { findUserById } from "./db";
import { getSessionUserId } from "./session";

// Returns the signed-in user or sends them to /login.
export async function requireUser() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const user = await findUserById(userId);
  if (!user) redirect("/login");
  return user;
}
