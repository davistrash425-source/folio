import { notFound } from "next/navigation";
import { currentStaff, isAdmin, requireUser, type StaffRole } from "./auth";

export { isAdmin };

export type Staff = { id: string; email: string; role: StaffRole };

// Staff who may look at the admin pages: full admins and read-only viewers.
// Signed-out visitors go to the login page; anyone else gets "not found", so
// the admin pages don't reveal that they exist.
export async function requireAdmin(): Promise<Staff> {
  const staff = await currentStaff();
  if (!staff) {
    await requireUser();
    notFound();
  }
  return { id: staff.user.id, email: staff.user.email, role: staff.role };
}

// For anything that changes something: full admins only. A viewer who gets
// here (the pages hide the buttons) is told "not found" like everyone else.
export async function requireFullAdmin(): Promise<Staff> {
  const staff = await requireAdmin();
  if (staff.role !== "admin") notFound();
  return staff;
}

// Upheld copyright notices an account can have before it's suspended under
// the repeat-infringer policy (the Copyright Policy states the same number).
export const STRIKE_LIMIT = 3;
