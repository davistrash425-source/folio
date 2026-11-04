// Which of a photographer's photos stay off their public site (owner's
// decision, Nov 4, 2026). Besides photos Folio has taken down:
// - photos the photographer hid ("Hide from my site", Photo.hiddenFromSite);
// - photos that are only in a client gallery: in at least one gallery, in no
//   album, and not picked anywhere in the design. Adding one to an album or
//   picking it in the design puts it on the site.
import type { User } from "./db";
import type { SiteDesign } from "./design";

// Every string anywhere in the design, so a photo picked in any section
// (a header photo, a chosen set...) counts as placed. The caption list only
// says which photos get captions, so it doesn't count.
function designStrings(value: unknown, out: Set<string>) {
  if (typeof value === "string") out.add(value);
  else if (Array.isArray(value)) for (const v of value) designStrings(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) designStrings(v, out);
  return out;
}

export function galleryOnlyPhotoIds(user: Pick<User, "photos" | "albums" | "galleries">, design: SiteDesign) {
  const inGallery = new Set((user.galleries ?? []).flatMap((g) => g.photoIds));
  if (inGallery.size === 0) return new Set<string>();
  const inAlbum = new Set((user.albums ?? []).flatMap((a) => a.photoIds));
  const picked = designStrings({ ...design, captions: undefined }, new Set());
  return new Set(user.photos.filter((p) => inGallery.has(p.id) && !inAlbum.has(p.id) && !picked.has(p.id)).map((p) => p.id));
}

// The photos visitors may see on the site shown with this design.
export function sitePhotos<P extends User["photos"][number]>(user: Pick<User, "albums" | "galleries"> & { photos: P[] }, design: SiteDesign) {
  const galleryOnly = galleryOnlyPhotoIds(user, design);
  return user.photos.filter((p) => !p.removed && !p.hiddenFromSite && !galleryOnly.has(p.id));
}
