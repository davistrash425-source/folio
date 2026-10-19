import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { updateUser } from "@/lib/db";
import {
  MAX_PHOTOS,
  PHOTO_ERRORS,
  PHOTO_LIMIT_MESSAGE,
  deletePhotoFiles,
  finishDirectUpload,
  storage,
} from "@/lib/uploads";

// Making the web copies of a large photo takes a few seconds.
export const maxDuration = 60;

const signedOut = () => Response.json({ error: "you've been signed out — log in again" }, { status: 401 });

// Step two of a direct upload (see ../start): checks the photo that arrived
// in storage, makes its web copies and adds it to the account. Answers 503
// when storage fails, which the browser retries; other errors are the photo's.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return signedOut();
  const body = await req.json().catch(() => null);
  const file = typeof body?.file === "string" ? body.file : "";

  let photo: Awaited<ReturnType<typeof finishDirectUpload>>;
  try {
    photo = await finishDirectUpload(user.id, file);
  } catch (err) {
    const message = (err as Error).message;
    // Storage failures aren't the photo's fault. Log them, or they're invisible.
    if (!PHOTO_ERRORS.has(message)) {
      console.error("finishPhotoUpload:", err);
      return Response.json({ error: "couldn't be saved, try again in a minute" }, { status: 503 });
    }
    if (message === "NOT_AN_IMAGE") console.warn("finishPhotoUpload:", (err as Error).cause);
    return Response.json({ error: message === "TOO_LARGE" ? "over 20 MB" : "couldn't be read as an image" });
  }

  let full = false;
  try {
    await updateUser(user.id, (u) => {
      if (u.photos.some((p) => p.id === photo.id)) return; // finished twice
      full = u.photos.length >= MAX_PHOTOS;
      if (!full) u.photos.push({ ...photo, createdAt: new Date().toISOString() });
    });
  } catch (err) {
    // The account was deleted while the photo was uploading (say, from
    // another tab). Don't leave its photos behind.
    if ((err as Error).message !== "USER_NOT_FOUND") throw err;
    await storage.removeAll(user.id);
    return signedOut();
  }
  if (full) {
    await deletePhotoFiles(user.id, { ...photo, createdAt: "" });
    return Response.json({ error: PHOTO_LIMIT_MESSAGE });
  }
  // The browser refreshes the page itself once the whole batch is done.
  revalidatePath("/dashboard", "layout");
  return Response.json({ ok: "Uploaded 1 photo." });
}
