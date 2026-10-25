"use server";

import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { randomUUID } from "crypto";
import { STRIKE_LIMIT, requireFullAdmin } from "@/lib/admin";
import { restoredEmail, suspendedEmail, takedownEmail, unsuspendedEmail } from "@/lib/admin-emails";
import { adminRole, currentImpersonation, currentUser, requireUser } from "@/lib/auth";
import {
  allUserIds,
  deleteUser,
  findReport,
  findUserById,
  findUserBySubdomain,
  logAdminAction,
  managedSites,
  photosWithoutRights,
  setReportStatus,
  updateUser,
  type Photo,
  type User,
} from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { clearImpersonation, IMPERSONATION_MINUTES, startImpersonation as beginImpersonation } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { deleteWebCopies, photoRights, remakeWebCopies, storage } from "@/lib/uploads";
import { sendVerificationEmail } from "@/lib/verify-email";

// What Folio's admins can do to an account (the pages in app/admin). Every
// action is logged, and goes back to the page with a message saying what
// happened. Photographers are emailed unless the admin unticks "notify"
// (which they should for anything that must not be tipped off, like a child
// safety case).

const str = (formData: FormData, key: string, max = 500) => String(formData.get(key) ?? "").trim().slice(0, max);
const plural = (count: number) => (count === 1 ? "1 photo" : `${count} photos`);
const yearOf = (photo: Photo) => new Date(photo.createdAt).getUTCFullYear();

async function accountFrom(formData: FormData) {
  const user = await findUserById(str(formData, "userId", 100));
  if (!user) notFound();
  return user;
}

function backTo(user: User, message: string): never {
  redirect(`/admin/sites/${user.subdomain}?done=${encodeURIComponent(message)}`);
}

// Emails the account's owner, replying to the reports inbox. Returns a note
// for the admin if it failed: the action itself is already done.
async function tellOwner(user: User, formData: FormData, email: { subject: string; text: string }) {
  if (!formData.get("notify")) return "";
  try {
    await sendEmail({ to: user.email, replyTo: process.env.REPORTS_EMAIL || undefined, ...email });
    return " They were emailed.";
  } catch (err) {
    console.error("Admin email failed", err);
    return " The email to them failed; tell them yourself.";
  }
}

// Takes photos off the site and deletes their web copies, keeping the private
// originals. With a copyright notice it also records a strike (one per
// notice) and closes the notice.
export async function takeDownPhotos(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  const ids = new Set(formData.getAll("photo").map(String));
  const reportId = str(formData, "reportId", 100);
  const report = reportId ? await findReport(reportId) : null;
  if (reportId && report?.subdomain !== user.subdomain) backTo(user, "That report isn't about this site.");
  const note = str(formData, "note");
  const at = new Date().toISOString();

  let taken: Photo[] = [];
  let strike = 0; // the strike this added, if it added one
  await updateUser(user.id, (u) => {
    taken = u.photos.filter((p) => ids.has(p.id) && !p.removed);
    for (const photo of taken) photo.removed = { at, ...(report ? { reportId: report.id } : {}), ...(note ? { note } : {}) };
    if (taken.length && report?.reason === "copyright" && !u.strikes?.some((s) => s.reportId === report.id)) {
      (u.strikes ??= []).push({ at, reportId: report.id });
      strike = u.strikes.length;
    }
  });
  if (!taken.length) backTo(user, "Nothing changed: choose photos that are on the site.");
  await Promise.all(taken.map((photo) => deleteWebCopies(user.id, photo)));
  if (report) await setReportStatus(report.id, "closed", `Took down ${plural(taken.length)}.`);

  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    reportId: report?.id,
    action: "take-down-photos",
    detail: `Took down ${plural(taken.length)}${note ? `: ${note}` : ""}.${strike ? ` Strike ${strike}.` : ""}`,
  });
  const emailed = await tellOwner(
    user,
    formData,
    takedownEmail({ name: user.profile.name, siteUrl: siteUrl(user.subdomain), count: taken.length, report, note }),
  );
  const strikeNote = strike
    ? ` Strike ${strike} of ${STRIKE_LIMIT}.${strike >= STRIKE_LIMIT ? " That's the limit: suspend the site under the repeat-infringer policy." : ""}`
    : "";
  backTo(user, `Took down ${plural(taken.length)}.${strikeNote}${emailed}`);
}

// Puts taken-down photos back, remaking their web copies. After a valid
// counter-notice ("disputed"), the strikes from their notices are removed.
export async function restorePhotos(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  const ids = new Set(formData.getAll("photo").map(String));
  const disputed = Boolean(formData.get("disputed"));
  const chosen = user.photos.filter((p) => ids.has(p.id) && p.removed);
  if (!chosen.length) backTo(user, "Nothing changed: choose photos that are taken down.");

  // The web copies come first, so a photo is never back on the site without them.
  const remade = new Map<string, Awaited<ReturnType<typeof remakeWebCopies>>>();
  let failed = 0;
  for (const photo of chosen) {
    try {
      remade.set(photo.id, await remakeWebCopies(user.id, photo, photoRights(user.profile, yearOf(photo))));
    } catch (err) {
      console.error("Couldn't remake web copies", photo.id, err);
      failed++;
    }
  }
  let restored = 0;
  const reportIds = new Set<string>();
  await updateUser(user.id, (u) => {
    for (const photo of u.photos) {
      const copies = remade.get(photo.id);
      if (!copies || !photo.removed) continue;
      if (photo.removed.reportId) reportIds.add(photo.removed.reportId);
      Object.assign(photo, copies);
      delete photo.removed;
      restored++;
    }
    if (disputed) u.strikes = (u.strikes ?? []).filter((s) => !reportIds.has(s.reportId));
  });

  const failure = failed ? ` ${plural(failed)} couldn't be restored (the original is missing or damaged).` : "";
  if (!restored) backTo(user, `Nothing changed.${failure}`);
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "restore-photos",
    detail: `Put back ${plural(restored)}${disputed ? " after a counter-notice; their strikes were removed" : ""}.`,
  });
  const emailed = await tellOwner(
    user,
    formData,
    restoredEmail({ name: user.profile.name, siteUrl: siteUrl(user.subdomain), count: restored }),
  );
  backTo(user, `Put back ${plural(restored)}.${failure}${emailed}`);
}

// Hides the whole site and stops uploads, until unsuspended.
export async function suspendSite(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  const reason = str(formData, "reason") || "it breaks Folio's rules";
  await updateUser(user.id, (u) => {
    u.suspended = { at: new Date().toISOString(), reason };
  });
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "suspend",
    detail: `Suspended the site because ${reason}.`,
  });
  const emailed = await tellOwner(user, formData, suspendedEmail({ name: user.profile.name, siteUrl: siteUrl(user.subdomain), reason }));
  backTo(user, `Suspended the site.${emailed}`);
}

export async function unsuspendSite(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  await updateUser(user.id, (u) => {
    delete u.suspended;
  });
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "unsuspend",
    detail: "Lifted the suspension.",
  });
  const emailed = await tellOwner(user, formData, unsuspendedEmail({ name: user.profile.name, siteUrl: siteUrl(user.subdomain) }));
  backTo(user, `Lifted the suspension.${emailed}`);
}

// Keeps everything in the account (no deleting photos or the account), for
// a case where the law may require Folio to preserve evidence. Never emailed.
export async function placeLegalHold(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  const note = str(formData, "note");
  await updateUser(user.id, (u) => {
    u.legalHold = { at: new Date().toISOString(), note };
  });
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "legal-hold",
    detail: `Placed a legal hold${note ? `: ${note}` : ""}.`,
  });
  backTo(user, "Froze the account: its photos and the account can't be deleted until you release it.");
}

export async function releaseLegalHold(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  await updateUser(user.id, (u) => {
    delete u.legalHold;
  });
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "release-legal-hold",
    detail: "Released the legal hold.",
  });
  backTo(user, "Released the legal hold.");
}

// Writes the copyright details into web copies made before Folio added
// them, dated with each photo's upload year. Does as many as it can in about
// 40 seconds (the admin page allows 60); run it again until none are left.
export async function addRightsToOlderPhotos() {
  await requireFullAdmin();
  const started = Date.now();
  const outOfTime = () => Date.now() - started > 40_000;
  let updated = 0;
  let failed = 0;
  for (const id of await allUserIds()) {
    if (outOfTime()) break;
    const user = await findUserById(id);
    const todo = user?.photos.filter((p) => !p.copyright && !p.removed && p.variants?.length) ?? [];
    if (!user || !todo.length) continue;
    const remade = new Map<string, Awaited<ReturnType<typeof remakeWebCopies>>>();
    for (const photo of todo) {
      if (outOfTime()) break;
      try {
        remade.set(photo.id, await remakeWebCopies(user.id, photo, photoRights(user.profile, yearOf(photo))));
      } catch (err) {
        console.error("Couldn't add copyright details", photo.id, err);
        failed++;
      }
    }
    // A photo taken down meanwhile must not get its web copies back.
    const takenDown: Photo[] = [];
    await updateUser(user.id, (u) => {
      for (const photo of u.photos) {
        const copies = remade.get(photo.id);
        if (!copies) continue;
        if (photo.removed) takenDown.push(photo);
        else Object.assign(photo, copies);
      }
    });
    await Promise.all(takenDown.map((photo) => deleteWebCopies(user.id, photo)));
    updated += remade.size - takenDown.length;
  }
  const left = await photosWithoutRights();
  const message =
    `Added copyright details to ${plural(updated)}.` +
    (failed ? ` ${plural(failed)} failed; see the server log.` : "") +
    (left ? ` ${plural(left)} left: run it again.` : " All done.");
  redirect(`/admin?done=${encodeURIComponent(message)}`);
}

// Closing marks a report as dealt with; the note says how.
export async function closeReport(formData: FormData) {
  await setStatus(formData, "closed");
}

export async function reopenReport(formData: FormData) {
  await setStatus(formData, "open");
}

async function setStatus(formData: FormData, status: "open" | "closed") {
  const admin = await requireFullAdmin();
  const report = await findReport(str(formData, "reportId", 100));
  if (!report) notFound();
  const note = status === "closed" ? str(formData, "note") : report.note;
  await setReportStatus(report.id, status, note);
  const owner = await findUserBySubdomain(report.subdomain);
  if (owner) {
    await logAdminAction({
      adminEmail: admin.email,
      userId: owner.id,
      subdomain: owner.subdomain,
      reportId: report.id,
      action: status === "closed" ? "close-report" : "reopen-report",
      detail: status === "closed" ? `Closed a report${note ? `: ${note}` : ""}.` : "Reopened a report.",
    });
  }
  redirect(`/admin/reports/${report.id}?done=${encodeURIComponent(status === "closed" ? "Closed." : "Reopened.")}`);
}

// ── Account oversight ───────────────────────────────────────────────────

// A private note about the account, for other staff. The photographer never
// sees it (it isn't in their export either).
export async function addAdminNote(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  const text = str(formData, "text", 1000);
  if (!text) backTo(user, "Write something to save.");
  await updateUser(
    user.id,
    (u) => {
      (u.adminNotes ??= []).push({ id: randomUUID(), at: new Date().toISOString(), by: admin.email, text });
    },
    { publicChange: false },
  );
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "add-note",
    detail: "Added a private note.",
  });
  backTo(user, "Saved the note.");
}

// Ends every login to the account, on every device.
export async function signOutAccountEverywhere(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  await updateUser(
    user.id,
    (u) => {
      u.sessionsValidFrom = Date.now();
    },
    { publicChange: false },
  );
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "sign-out-everywhere",
    detail: "Signed the account out of every device.",
  });
  backTo(user, "Signed them out everywhere.");
}

// For someone stuck without their confirmation email. Their site can go live
// once they've turned it on, so check who they are first.
export async function verifyAccountEmail(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  if (user.emailVerified) backTo(user, "Their email is already confirmed.");
  await updateUser(user.id, (u) => {
    u.emailVerified = true;
  });
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "verify-email",
    detail: `Marked the email ${user.email} as confirmed.`,
  });
  backTo(user, "Marked their email as confirmed.");
}

export async function resendAccountVerification(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  if (user.emailVerified) backTo(user, "Their email is already confirmed.");
  try {
    await sendVerificationEmail(user);
  } catch (err) {
    console.error("Admin verification email failed", err);
    backTo(user, "The email couldn't be sent. Try again in a moment.");
  }
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "resend-verification",
    detail: `Sent the confirmation email to ${user.email}.`,
  });
  backTo(user, `Sent a confirmation email to ${user.email}.`);
}

// Closes the account and deletes its photos, after typing the address. Never
// while a legal hold is on it (or on one of an admin's extra sites), and never
// for staff.
export async function deleteAccountAsAdmin(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  if (str(formData, "confirm", 100).toLowerCase() !== user.subdomain) backTo(user, "Type the site's address to confirm.");
  if (adminRole(user) || user.managedBy) backTo(user, "Staff accounts and their extra sites can't be deleted here.");
  const accounts = [user, ...(await managedSites(user.id))];
  if (accounts.some((a) => a.legalHold)) backTo(user, "This account is on legal hold, so it can't be deleted. Release the hold first.");

  // Logged first, so the record exists even if clearing out the files fails.
  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "delete-account",
    detail: `Deleted the account ${user.email} (${plural(user.photos.length)}${accounts.length > 1 ? `, and ${accounts.length - 1} extra site(s)` : ""}).`,
  });
  for (const account of accounts.reverse()) {
    await deleteUser(account.id);
    await storage.removeAll(account.id);
  }
  redirect(`/admin/accounts?done=${encodeURIComponent(`Deleted ${user.subdomain}.`)}`);
}

// ── Viewing an account as its owner ─────────────────────────────────────

// "Log in as this user", to reproduce a problem. Full admins only, with a
// reason that goes in the log; it lasts IMPERSONATION_MINUTES, is carried by
// its own cookie (lib/session.ts), and the banner on every dashboard page
// lets the admin stop. While it runs, the account's password, email,
// address, sessions, export and deletion are off limits (see
// impersonationBlock), as are all admin pages.
export async function startImpersonation(formData: FormData) {
  const admin = await requireFullAdmin();
  const user = await accountFrom(formData);
  const reason = str(formData, "reason", 200);
  if (reason.length < 5) backTo(user, "Say why you need to see their account (a few words), then try again.");
  if (adminRole(user) || user.managedBy || user.id === admin.id) backTo(user, "You can't view staff accounts or extra sites this way.");
  if ((await currentUser())?.id !== admin.id) backTo(user, "Switch back to your own site first.");

  await logAdminAction({
    adminEmail: admin.email,
    userId: user.id,
    subdomain: user.subdomain,
    action: "impersonation-started",
    detail: `Started viewing the account as its owner (up to ${IMPERSONATION_MINUTES} minutes). Reason: ${reason}`,
  });
  await beginImpersonation(admin.id, user.id);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/manage/photos");
}

// Works from the banner. It isn't an admin page (while it's on, the browser is
// the photographer's), so it only needs the impersonation itself to be valid.
export async function stopImpersonation() {
  await requireUser();
  const impersonation = await currentImpersonation();
  if (!impersonation) notFound();
  await logAdminAction({
    adminEmail: impersonation.admin.email,
    userId: impersonation.target.id,
    subdomain: impersonation.target.subdomain,
    action: "impersonation-ended",
    detail: "Stopped viewing the account as its owner.",
  });
  await clearImpersonation();
  revalidatePath("/dashboard", "layout");
  redirect(`/admin/sites/${impersonation.target.subdomain}`);
}
