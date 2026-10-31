"use server";

import { redirect } from "next/navigation";
import { currentImpersonation, impersonationBlock, requireUser } from "@/lib/auth";
import { cancelSubscriptionFor } from "@/lib/billing";
import { createUser, deleteUsers, findUserByEmail, findUserBySubdomain, hasPendingToken, logAdminAction, managedSites, subdomainOnHold, updateUser } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { clearGoogleSignup, readGoogleSignup } from "@/lib/google";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  clearManager,
  createSession,
  deleteSession,
  hashPassword,
  isLegacyPasswordHash,
  verifyPassword,
} from "@/lib/session";
import { ADDRESS_HOLD_MONTHS, NEW_SITES_START_PUBLISHED, SUPPORT_EMAIL, appUrl, validateSubdomain } from "@/lib/site";
import { removeAccountFiles } from "@/lib/cleanup";
import { createToken, redeemToken } from "@/lib/tokens";
import { NOT_HUMAN, TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";
import { sendVerificationEmail } from "@/lib/verify-email";

const HOUR = 60 * 60 * 1000;
const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

export type FormState = {
  error?: string;
  ok?: string;
  fields?: Record<string, string>;
  // Which field the form should focus (and mark red) after a failed submit.
  field?: "name" | "email" | "password" | "subdomain";
};

const TERMS_REQUIRED = "Please agree to the Terms and Privacy Policy to create an account.";

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const subdomain = String(formData.get("subdomain") ?? "").trim().toLowerCase();
  const fields = { name, email, subdomain };

  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, 10, HOUR))) return { error: TOO_MANY, fields };
  if (!(await verifyTurnstile(formData.get(TURNSTILE_FIELD), ip))) return { error: NOT_HUMAN, fields };
  if (!name) return { error: "Please enter your name.", fields, field: "name" };
  if (!formData.get("terms")) return { error: TERMS_REQUIRED, fields };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email.", fields, field: "email" };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", fields, field: "password" };
  const subError = validateSubdomain(subdomain);
  if (subError) return { error: subError, fields, field: "subdomain" };
  if (await subdomainOnHold(subdomain, ADDRESS_HOLD_MONTHS)) {
    return {
      error: `That address belonged to a site that closed recently, so it's held for a year. Try another, or write to ${SUPPORT_EMAIL} if it was yours.`,
      fields,
    };
  }

  if (await findUserByEmail(email)) {
    return { error: "An account with that email already exists.", fields };
  }
  if (await findUserBySubdomain(subdomain)) {
    return { error: "That site address is taken — try another.", fields };
  }

  try {
    const user = await createUser({
      name,
      email,
      subdomain,
      passwordHash: await hashPassword(password),
      published: NEW_SITES_START_PUBLISHED,
      termsAcceptedAt: true,
    });
    await createSession(user.id);
    await sendVerificationEmail(user).catch((err) => console.error("Verification email failed", err));
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "EMAIL_TAKEN") return { error: "An account with that email already exists.", fields };
    if (msg === "SUBDOMAIN_TAKEN") return { error: "That site address is taken — try another.", fields };
    throw err;
  }
  redirect("/dashboard");
}

// The last step for someone who signed in with Google but has no account yet:
// they pick their name and site address. There is no password (they sign in
// with Google), and their email is already confirmed by Google.
export async function completeGoogleSignup(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const subdomain = String(formData.get("subdomain") ?? "").trim().toLowerCase();
  const fields = { name, subdomain };

  const identity = await readGoogleSignup();
  if (!identity) return { error: "That link has expired. Start again with Continue with Google.", fields };
  if (!(await rateLimit(`signup:${await clientIp()}`, 10, HOUR))) return { error: TOO_MANY, fields };

  if (!name) return { error: "Please enter your name.", fields, field: "name" };
  if (!formData.get("terms")) return { error: TERMS_REQUIRED, fields };
  const subError = validateSubdomain(subdomain);
  if (subError) return { error: subError, fields, field: "subdomain" };
  if (await subdomainOnHold(subdomain, ADDRESS_HOLD_MONTHS)) {
    return {
      error: `That address belonged to a site that closed recently, so it's held for a year. Try another, or write to ${SUPPORT_EMAIL} if it was yours.`,
      fields,
      field: "subdomain",
    };
  }
  if (await findUserBySubdomain(subdomain)) {
    return { error: "That site address is taken — try another.", fields, field: "subdomain" };
  }
  if (await findUserByEmail(identity.email)) {
    return { error: "An account with that email already exists.", fields };
  }

  try {
    const user = await createUser({
      name,
      email: identity.email,
      subdomain,
      passwordHash: "",
      published: NEW_SITES_START_PUBLISHED,
      googleId: identity.googleId,
      emailVerified: true,
      termsAcceptedAt: true,
    });
    await clearGoogleSignup();
    await createSession(user.id);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "EMAIL_TAKEN") return { error: "An account with that email already exists.", fields };
    if (msg === "SUBDOMAIN_TAKEN") return { error: "That site address is taken — try another.", fields, field: "subdomain" };
    throw err;
  }
  redirect("/dashboard");
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Limits go by visitor address, never by account alone: a limit on the email
  // by itself would let anyone lock the real owner out by typing wrong
  // passwords. One address can try an account 5 times per 15 minutes, and
  // 30 times in all (stops one password tried across many accounts).
  const ip = await clientIp();
  const window = 15 * 60 * 1000;
  if (
    !(await rateLimit(`login:${ip}:${email.slice(0, 200)}`, 5, window)) ||
    !(await rateLimit(`login-ip:${ip}`, 30, window))
  ) {
    return { error: TOO_MANY, fields: { email } };
  }
  const user = await findUserByEmail(email);
  // verifyPassword takes the same time whether or not the account exists.
  if (!(await verifyPassword(password, user?.passwordHash ?? "")) || !user) {
    return { error: "Wrong email or password.", fields: { email } };
  }
  // Upgrade a password hashed with the old default cost, now that it's confirmed.
  if (isLegacyPasswordHash(user.passwordHash)) {
    const upgraded = await hashPassword(password);
    await updateUser(user.id, (u) => void (u.passwordHash = upgraded));
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  // Logging out also ends viewing an account as its owner, so log that too.
  const impersonation = await currentImpersonation();
  if (impersonation) {
    await logAdminAction({
      adminEmail: impersonation.admin.email,
      userId: impersonation.target.id,
      subdomain: impersonation.target.subdomain,
      action: "impersonation-ended",
      detail: "Stopped viewing the account as its owner (logged out).",
    });
  }
  await deleteSession();
  redirect("/");
}

// ── Password reset ──────────────────────────────────────────────────────

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fields = { email };
  if (!(await rateLimit(`reset:${await clientIp()}`, 5, HOUR))) return { error: TOO_MANY, fields };
  const sent = { ok: "If an account uses that email, we've sent it a reset link.", fields };

  const user = await findUserByEmail(email);
  // Same answer either way, so the form can't be used to find out who has an
  // account. A missing account still does the scrypt work of a real one, so
  // the reply time doesn't give it away either.
  if (!user) {
    await verifyPassword("timing-equalizer", "");
    return sent;
  }
  // A pending link still works; a second request keeps it rather than making
  // the first email's link fail.
  if (await hasPendingToken(user.id, "reset")) return sent;
  const token = await createToken(user.id, "reset", HOUR);
  // The same answer whether or not sending works, so a mail outage can't
  // tell anyone which addresses have accounts.
  await sendEmail({
    to: user.email,
    subject: "Reset your Folio password",
    text: `Someone asked to reset the password for your Folio account. If it was you, open this link:

${appUrl(`/reset-password?token=${token}`)}

The link works for 1 hour. If it wasn't you, ignore this email.`,
  }).catch((err) => console.error("Couldn't send a password reset email", err));
  return sent;
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const userId = await redeemToken(token, "reset");
  if (!userId) return { error: "This reset link has expired or was already used. Request a new one." };
  const passwordHash = await hashPassword(password);
  // Getting the link proves they own the address. Anyone else signed in to
  // the account (perhaps whoever knew the old password) is signed out.
  await updateUser(userId, (u) => {
    u.passwordHash = passwordHash;
    u.emailVerified = true;
    u.sessionsValidFrom = Date.now();
  });
  await createSession(userId);
  redirect("/dashboard");
}

// ── Email verification ──────────────────────────────────────────────────

// The Confirm button on /verify-email. Opening the link doesn't confirm
// anything, because mail scanners open links before people do and would use
// the one-time token up.
export async function confirmEmail(formData: FormData) {
  const userId = await redeemToken(String(formData.get("token") ?? ""), "verify");
  if (!userId) redirect("/dashboard/manage/account?verified=expired");
  await updateUser(userId, (u) => {
    u.emailVerified = true;
  });
  redirect("/dashboard/manage/account?verified=1");
}

export async function resendVerification(): Promise<FormState> {
  const user = await requireUser();
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked };
  if (!(await rateLimit(`verify:${user.id}`, 3, HOUR))) return { error: TOO_MANY };
  if (user.emailVerified) return {};
  await sendVerificationEmail(user);
  return { ok: `Sent — check ${user.email}.` };
}

// ── Account deletion ────────────────────────────────────────────────────

// ── Signing out other devices ───────────────────────────────────────────

// Ends every login to this account except this one: on a lost phone, a
// shared computer, anywhere.
export async function signOutEverywhereElse(): Promise<FormState> {
  const user = await requireUser();
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked };
  await updateUser(user.id, (u) => {
    u.sessionsValidFrom = Date.now();
  }, { publicChange: false });
  await createSession(user.id);
  return { ok: "Signed out everywhere else." };
}

// Deletes the signed-in account, confirmed with its password. An admin's
// extra site has none, so it's confirmed by typing its address, and the admin
// goes back to their own site. Deleting an admin's account deletes their
// extra sites too.
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked };
  if (!(await rateLimit(`delete:${user.id}`, 5, 15 * 60 * 1000))) return { error: TOO_MANY };
  // An admin's extra site has no password; neither does a Google-only account.
  // Both confirm by typing the site's address instead.
  const hasPassword = Boolean(user.passwordHash);
  if (user.managedBy || !hasPassword) {
    if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== user.subdomain) {
      return { error: "Type the site's address to confirm." };
    }
  } else if (!(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) {
    return { error: "That password isn't right." };
  }
  const extraSites = user.managedBy ? [] : await managedSites(user.id);
  // Folio has been asked (or is required) to keep this account for now.
  if ([user, ...extraSites].some((u) => u.legalHold)) {
    return { error: `Your account can't be deleted right now. Write to ${SUPPORT_EMAIL} for help.` };
  }
  // Ends the subscription before anything is deleted, so a Polar failure leaves the account whole.
  try {
    await cancelSubscriptionFor(user);
  } catch (err) {
    console.error("Couldn't end the subscription before deleting an account", user.id, err);
    return { error: `We couldn't end your subscription just now, so your account was not deleted. Try again in a few minutes or write to ${SUPPORT_EMAIL}.` };
  }
  // All together: a legal hold placed meanwhile on any of them stops the lot.
  const accounts = [...extraSites, user];
  try {
    await deleteUsers(accounts.map((a) => a.id));
    for (const account of accounts) await removeAccountFiles(account.id);
  } catch (err) {
    if ((err as Error).message !== "LEGAL_HOLD") throw err;
    return { error: `Your account can't be deleted right now. Write to ${SUPPORT_EMAIL} for help.` };
  }
  if (user.managedBy) {
    await createSession(user.managedBy);
    await clearManager();
    redirect("/dashboard/manage/photos");
  }
  await deleteSession();
  redirect("/?deleted=1");
}
