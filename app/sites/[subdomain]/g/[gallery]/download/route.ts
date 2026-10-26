import { findUserBySubdomain } from "@/lib/db";
import { findGallery, galleryExpired, galleryPhotos } from "@/lib/galleries";
import { galleriesOpen } from "@/lib/plans";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hasGalleryAccess } from "@/lib/session";
import { downloadFile, storage } from "@/lib/uploads";
import { zipResponse } from "@/lib/zip";

// All the photos in a client gallery as one .zip, for someone who has typed
// the gallery's password. These are the web copies (the largest size), never
// the private originals.
export async function GET(_req: Request, ctx: RouteContext<"/sites/[subdomain]/g/[gallery]/download">) {
  const { subdomain, gallery: slug } = await ctx.params;
  const owner = await findUserBySubdomain(subdomain);
  const gallery = owner && !owner.suspended && owner.emailVerified && galleriesOpen(owner) ? findGallery(owner, slug) : undefined;
  if (!owner || !gallery || galleryExpired(gallery) || !(await hasGalleryAccess(gallery.id, gallery.passwordHash))) {
    return new Response("Not found", { status: 404 });
  }
  // A zip of a whole shoot is heavy to build, so it is rationed.
  if (!(await rateLimit(`gallery-zip:${await clientIp()}:${gallery.id}`, 10, 60 * 60 * 1000))) {
    return new Response("Too many downloads. Try again later.", { status: 429 });
  }

  const files = galleryPhotos(owner, gallery).map((photo, i) => async () => {
    const file = downloadFile(photo);
    if (!file) return null;
    const data: Buffer | null = await storage.get(owner.id, file).catch(() => null);
    return data && { name: `${String(i + 1).padStart(3, "0")}-${photo.id}.${file.split(".").pop()}`, data };
  });
  const name = gallery.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "gallery";
  return zipResponse(files, `${name}.zip`);
}
