"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { findUserBySubdomain, updateUser } from "@/lib/db";
import { MIN_GALLERY_PASSWORD, findGallery, newGallerySlug } from "@/lib/galleries";
import { galleryLimit } from "@/lib/plans";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { grantGalleryAccess, hashPassword, verifyPassword } from "@/lib/session";
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
  if (!title) return { error: "Give the gallery a name." };
  if (password && password.length < MIN_GALLERY_PASSWORD) return { error: PASSWORD_TOO_SHORT };
  const passwordHash = password ? await hashPassword(password) : "";
  let found = false;
  await updateUser(
    user.id,
    (u) => {
      const gallery = findGallery(u, id);
      if (!gallery) return;
      found = true;
      gallery.title = title;
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
  const gallery = owner && !owner.suspended && owner.emailVerified ? findGallery(owner, slug) : undefined;
  // Takes the same time whether or not there is such a gallery.
  const ok = await verifyPassword(password, gallery?.passwordHash ?? "");
  if (!gallery || !ok) return { error: WRONG };
  await grantGalleryAccess(gallery.id, gallery.passwordHash);
  redirect(`/g/${gallery.slug}`);
}
