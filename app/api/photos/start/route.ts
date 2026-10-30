import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { updateUser } from "@/lib/db";
import { pendingUploadBytes, uploadBlock } from "@/lib/plans";
import { UPLOAD_URL_SECONDS, directUpload } from "@/lib/uploads";

export const UPLOAD_STARTS_PER_HOUR = 500;

// Step one of a direct upload: the browser asks for an address to send one
// photo straight to storage (R2), then calls /api/photos/finish. With no
// direct uploads (the local disk) the answer is empty, and the browser uses
// the uploadPhotos action instead.
//
// A route handler, not a server action, because the browser runs server
// actions one at a time, and photos are uploaded several at once.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "you've been signed out — log in again" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const type = typeof body?.type === "string" ? body.type : "";
  const size = typeof body?.size === "number" ? body.size : NaN;
  if (user.suspended) return Response.json({ error: "your site is suspended, so you can't upload right now" });
  const blocked = uploadBlock(user, Number.isFinite(size) ? Math.max(0, size) : 0);
  if (blocked) return Response.json({ error: blocked });
  // Every start hands out an address that can fill storage, and one that is
  // never finished leaves its file behind. A big batch of photos is a few
  // hundred starts, so this is generous for people and small for abuse.
  if (!(await rateLimit(`upload-start:${user.id}`, UPLOAD_STARTS_PER_HOUR, 60 * 60 * 1000))) {
    return Response.json({ error: "you've started a lot of uploads in the last hour — wait a while and try again" });
  }
  try {
    const direct = await directUpload(user.id, type, size);
    if (!direct) return Response.json({});
    // Uploads already under way count too, or many started at once could
    // fill storage past the limit before any of them is saved.
    let full: string | null = null;
    const now = Date.now();
    await updateUser(
      user.id,
      (u) => {
        const pending = (u.pendingUploads ?? []).filter((p) => p.expires > now);
        full = uploadBlock(u, pendingUploadBytes({ pendingUploads: pending }, now) + size);
        if (!full) pending.push({ file: direct.file, bytes: size, expires: now + UPLOAD_URL_SECONDS * 1000 });
        u.pendingUploads = pending;
      },
      { publicChange: false },
    );
    if (full) return Response.json({ error: full });
    return Response.json({ direct });
  } catch (err) {
    const message = (err as Error).message;
    if (message === "UNSUPPORTED_TYPE") return Response.json({ error: "not a JPG, PNG, WebP, GIF or AVIF" });
    if (message === "TOO_LARGE") return Response.json({ error: "over 20 MB" });
    throw err;
  }
}
