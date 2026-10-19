"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createUser, deleteUser, findUserByEmail, findUserBySubdomain, subdomainOnHold, updateUser } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  createSession,
  deleteSession,
  hashPassword,
  verifyPassword,
} from "@/lib/session";
import { ADDRESS_HOLD_MONTHS, NEW_SITES_START_PUBLISHED, SUPPORT_EMAIL, appUrl, validateSubdomain } from "@/lib/site";
import { createToken, redeemToken } from "@/lib/tokens";
import { storage } from "@/lib/uploads";

const HOUR = 60 * 60 * 1000;
const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

async function sendVerificationEmail(user: { id: string; email: string }) {
  const token = await createToken(user.id, "verify", 48 * HOUR);
  await sendEmail({
    to: user.email,
    subject: "Confirm your email for Folio",
    text: `Confirm your email address by opening this link:

${appUrl(`/verify-email?token=${token}`)}

The link works for 48 hours.`,
  });
}

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> };

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const subdomain = String(formData.get("subdomain") ?? "").trim().toLowerCase();
  const fields = { name, email, subdomain };

  if (!(await rateLimit(`signup:${await clientIp()}`, 10, HOUR))) return { error: TOO_MANY, fields };
  if (!name) return { error: "Please enter your name.", fields };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email.", fields };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", fields };
  const subError = validateSubdomain(subdomain);
  if (subError) return { error: subError, fields };
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

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Limit per address (stops guessing one account's password) and per IP
  // (stops trying one password across many accounts).
  const ip = await clientIp();
  if (!(await rateLimit(`login:${email}`, 5, 15 * 60 * 1000)) || !(await rateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000))) {
    return { error: TOO_MANY, fields: { email } };
  }
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Wrong email or password.", fields: { email } };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
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
  // Same answer either way, so the form can't be used to find out who has an account.
  if (!user) return sent;
  const token = await createToken(user.id, "reset", HOUR);
  await sendEmail({
    to: user.email,
    subject: "Reset your Folio password",
    text: `Someone asked to reset the password for your Folio account. If it was you, open this link:

${appUrl(`/reset-password?token=${token}`)}

The link works for 1 hour. If it wasn't you, ignore this email.`,
  });
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

export async function resendVerification(): Promise<FormState> {
  const user = await requireUser();
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
  await updateUser(user.id, (u) => {
    u.sessionsValidFrom = Date.now();
  });
  await createSession(user.id);
  return { ok: "Signed out everywhere else." };
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  if (!(await rateLimit(`delete:${user.id}`, 5, 15 * 60 * 1000))) return { error: TOO_MANY };
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { error: "That password isn't right." };
  }
  // Folio has been asked (or is required) to keep this account for now.
  if (user.legalHold) return { error: `Your account can't be deleted right now. Write to ${SUPPORT_EMAIL} for help.` };
  await deleteUser(user.id);
  await storage.removeAll(user.id);
  await deleteSession();
  redirect("/?deleted=1");
}
