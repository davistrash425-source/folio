"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { findUserBySubdomain, updateUser } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { MIN_GALLERY_PASSWORD, findGallery, galleryExpired, galleryPhotos, newGallerySlug, validExpiryDate } from "@/lib/galleries";
import { galleriesOpen, galleryLimit } from "@/lib/plans";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site";
import { grantGalleryAccess, hasGalleryAccess, hashPassword, verifyPassword } from "@/lib/session";
import { MAX_PHOTOS } from "@/lib/uploads";

export type GalleryState = { error?: string; ok?: string };

const PASSWORD_TOO_SHORT = `Use a password of at least ${MIN_GALLERY_PASSWORD} characters.`;
const NOT_PRO = "Client galleries are part of Folio Pro.";
const refresh = () => revalidatePath("/dashboard", "layout");

// A private changes-only update: galleries never appear on the public site,
// so they don't clear its cache.
const PRIVATE = { publicChange: false } as const;

export async function createGallery(_prev: GalleryState, formData: FormData): Promise<GalleryState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const password = String(formData.get("password") ?? "");
  if (galleryLimit(user) === 0) return { error: NOT_PRO };
  if (!title) return { error: "Give the gallery a name, like the client's name." };
  if (password.length < MIN_GALLERY_PASSWORD) return { error: PASSWORD_TOO_SHORT };
  const passwordHash = await hashPassword(password);

  const id = randomUUID();
  let full = false;
  await updateUser(
    user.id,
    (u) => {
      const galleries = (u.galleries ??= []);
      if (galleries.length >= galleryLimit(u)) {
        full = true;
        return;
      }
      galleries.push({ id, slug: newGallerySlug(), title, passwordHash, photoIds: [], createdAt: new Date().toISOString() });
    },
    PRIVATE,
  );
  if (full) return { error: `You've reached the limit of ${galleryLimit(user)} client galleries.` };
  refresh();
  redirect(`/dashboard/manage/galleries/${id}`);
}

export async function updateGallery(id: string, _prev: GalleryState, formData: FormData): Promise<GalleryState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const password = String(formData.get("password") ?? "");
  const expires = String(formData.get("expires") ?? "").trim();
  if (!title) return { error: "Give the gallery a name." };
  if (password && password.length < MIN_GALLERY_PASSWORD) return { error: PASSWORD_TOO_SHORT };
  if (expires && !validExpiryDate(expires)) return { error: "That expiry date isn't valid." };
  const passwordHash = password ? await hashPassword(password) : "";
  let found = false;
  await updateUser(
    user.id,
    (u) => {
      const gallery = findGallery(u, id);
      if (!gallery) return;
      found = true;
      gallery.title = title;
      if (expires) gallery.expiresAt = expires;
      else delete gallery.expiresAt;
      if (passwordHash) gallery.passwordHash = passwordHash;
    },
    PRIVATE,
  );
  if (!found) return { error: "That gallery no longer exists." };
  refresh();
  return { ok: password ? "Saved. The new password is in effect; everyone must enter it again." : "Saved." };
}

const photoIdsSchema = z.array(z.string().trim().min(1).max(100)).max(MAX_PHOTOS);

export async function setGalleryPhotos(id: string, photoIds: string[]): Promise<GalleryState> {
  const user = await requireUser();
  const parsed = photoIdsSchema.safeParse(photoIds);
  if (!parsed.success) return { error: "Those photos couldn't be saved." };
  let found = false;
  await updateUser(
    user.id,
    (u) => {
      const gallery = findGallery(u, id);
      if (!gallery) return;
      found = true;
      const own = new Set(u.photos.filter((p) => !p.removed).map((p) => p.id));
      gallery.photoIds = [...new Set(parsed.data)].filter((photoId) => own.has(photoId));
    },
    PRIVATE,
  );
  if (!found) return { error: "That gallery no longer exists." };
  refresh();
  return { ok: "Saved." };
}

// Sends the gallery link to a client. The password is never in the email: the
// photographer gives it separately, so the mailbox alone isn't enough.
export async function emailGalleryLink(id: string, _prev: GalleryState, formData: FormData): Promise<GalleryState> {
  const user = await requireUser();
  const to = String(formData.get("email") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (!z.email().safeParse(to).success) return { error: "Enter your client's email address." };
  const gallery = findGallery(user, id);
  if (!gallery) return { error: "That gallery no longer exists." };
  if (!(await rateLimit(`gallery-email:${user.id}`, 20, 60 * 60 * 1000))) {
    return { error: "You've sent a lot of emails. Try again in an hour." };
  }
  const link = `${siteUrl(user.subdomain)}/g/${gallery.slug}`;
  const lines = [
    `${user.profile.name || "Your photographer"} has shared a private photo gallery with you: ${gallery.title}.`,
    note,
    `Open it here: ${link}`,
    "You'll need the password, which they will send you separately.",
    gallery.expiresAt ? `The link works until ${gallery.expiresAt}.` : "",
  ].filter(Boolean);
  try {
    await sendEmail({ to, subject: `${gallery.title}: your photos`, text: lines.join("\n\n"), replyTo: user.email });
  } catch {
    return { error: "The email couldn't be sent. Try again in a moment." };
  }
  return { ok: `Sent to ${to}. Remember to give them the password.` };
}

export async function deleteGallery(id: string): Promise<GalleryState> {
  const user = await requireUser();
  await updateUser(
    user.id,
    (u) => {
      u.galleries = (u.galleries ?? []).filter((g) => g.id !== id);
    },
    PRIVATE,
  );
  refresh();
  return { ok: "Deleted." };
}

// ── Visitors ────────────────────────────────────────────────────────────

const WRONG = "That password isn't right.";

// A visitor types the password on name.folio.cam/g/<slug>. Anyone can try, so
// attempts are limited per visitor address and per gallery.
export async function unlockGallery(
  subdomain: string,
  slug: string,
  _prev: GalleryState,
  formData: FormData,
): Promise<GalleryState> {
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const ip = await clientIp();
  const window = 15 * 60 * 1000;
  if (
    !(await rateLimit(`gallery:${ip}:${subdomain}:${slug}`.slice(0, 200), 8, window)) ||
    !(await rateLimit(`gallery-ip:${ip}`, 40, window))
  ) {
    return { error: "Too many tries. Wait a few minutes and try again." };
  }
  const owner = await findUserBySubdomain(subdomain);
  const found = owner && !owner.suspended && owner.emailVerified && galleriesOpen(owner) ? findGallery(owner, slug) : undefined;
  const gallery = found && !galleryExpired(found) ? found : undefined;
  // Takes the same time whether or not there is such a gallery.
  const ok = await verifyPassword(password, gallery?.passwordHash ?? "");
  if (!gallery || !ok) return { error: WRONG };
  await grantGalleryAccess(gallery.id, gallery.passwordHash);
  redirect(`/g/${gallery.slug}`);
}

// A client hearts or un-hearts a photo. Needs the same cookie as viewing the
// gallery, and only photos in the gallery count.
export async function toggleFavourite(subdomain: string, slug: string, photoId: string): Promise<{ error?: string; favourites?: string[] }> {
  const ip = await clientIp();
  if (!(await rateLimit(`gallery-fav:${ip}:${subdomain}:${slug}`.slice(0, 200), 120, 15 * 60 * 1000))) {
    return { error: "Too many changes. Wait a few minutes." };
  }
  const owner = await findUserBySubdomain(subdomain);
  const gallery = owner && !owner.suspended && owner.emailVerified && galleriesOpen(owner) ? findGallery(owner, slug) : undefined;
  if (!owner || !gallery || galleryExpired(gallery) || !(await hasGalleryAccess(gallery.id, gallery.passwordHash))) {
    return { error: "This gallery isn't available." };
  }
  let favourites: string[] = [];
  let missing = false;
  await updateUser(
    owner.id,
    (u) => {
      const g = findGallery(u, slug);
      if (!g) return;
      if (!galleryPhotos(u, g).some((p) => p.id === photoId)) {
        missing = true;
        return;
      }
      const current = new Set(g.favouriteIds ?? []);
      if (!current.delete(photoId)) current.add(photoId);
      g.favouriteIds = [...current];
      favourites = g.favouriteIds;
    },
    PRIVATE,
  );
  if (missing) return { error: "That photo isn't in this gallery." };
  return { favourites };
}
