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

// A gallery's photos that still exist and haven't been taken down.
export function galleryPhotos(user: Pick<User, "photos">, gallery: Pick<ClientGallery, "photoIds">) {
  const byId = new Map(user.photos.filter((p) => !p.removed).map((p) => [p.id, p]));
  return gallery.photoIds.flatMap((id) => byId.get(id) ?? []);
}
