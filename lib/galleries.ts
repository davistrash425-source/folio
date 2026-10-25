// Client galleries: a private page of chosen photos, opened with a link and a
// password. The link is random (so it can't be guessed) and the password is
// asked for before any photo is listed. The photos themselves are the same
// web copies the portfolio serves, so this keeps a gallery out of sight; it
// does not make an image address secret to someone who already has it.
import { randomBytes } from "crypto";
import type { ClientGallery, User } from "./db";

export const MIN_GALLERY_PASSWORD = 6;

export const newGallerySlug = () => randomBytes(6).toString("base64url");

export function findGallery(user: Pick<User, "galleries">, slugOrId: string) {
  return user.galleries?.find((g) => g.slug === slugOrId || g.id === slugOrId);
}

// The link stops working after the end of the day in expiresAt (UTC).
export function galleryExpired(gallery: Pick<ClientGallery, "expiresAt">, now = Date.now()) {
  if (!gallery.expiresAt) return false;
  return now >= Date.parse(`${gallery.expiresAt}T00:00:00Z`) + 24 * 60 * 60 * 1000;
}

export const validExpiryDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

// A gallery's photos that still exist and haven't been taken down.
export function galleryPhotos(user: Pick<User, "photos">, gallery: Pick<ClientGallery, "photoIds">) {
  const byId = new Map(user.photos.filter((p) => !p.removed).map((p) => [p.id, p]));
  return gallery.photoIds.flatMap((id) => byId.get(id) ?? []);
}
