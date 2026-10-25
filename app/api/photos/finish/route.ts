import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { updateUser } from "@/lib/db";
import { photoLimit, photoLimitMessage } from "@/lib/plans";
import {
  PHOTO_ERRORS,
  deletePhotoFiles,
  finishDirectUpload,
  photoRights,
  storage,
} from "@/lib/uploads";

// Making the web copies of a large photo takes a few seconds.
export const maxDuration = 60;

const signedOut = () => Response.json({ error: "you've been signed out — log in again" }, { status: 401 });

// Step two of a direct upload (see ../start): checks the photo that arrived
// in storage, makes its web copies and adds it to the account. Answers 503
// when storage fails, which the browser retries; other errors are the photo's.
export async function POST(req: Request) {
  // How long each step took, sent back as a Server-Timing header so a slow
  // upload can be diagnosed from the browser's network panel.
  const timings: Record<string, number> = {};
  let started = performance.now();
  const lap = (step: string) => {
    timings[step] = performance.now() - started;
    started = performance.now();
  };
  const answer = (body: object, status = 200) =>
    Response.json(body, {
      status,
      headers: {
        "Server-Timing": Object.entries(timings)
          .map(([step, ms]) => `${step};dur=${ms.toFixed(0)}`)
          .join(", "),
      },
    });

  const user = await currentUser();
  if (!user) return signedOut();
  lap("auth");
  const body = await req.json().catch(() => null);
  const file = typeof body?.file === "string" ? body.file : "";

  let photo: Awaited<ReturnType<typeof finishDirectUpload>>;
  try {
    photo = await finishDirectUpload(user.id, file, timings, photoRights(user.profile));
  } catch (err) {
    const message = (err as Error).message;
    // Storage failures aren't the photo's fault. Log them, or they're invisible.
    if (!PHOTO_ERRORS.has(message)) {
      console.error("finishPhotoUpload:", err);
      return answer({ error: "couldn't be saved, try again in a minute" }, 503);
    }
    if (message === "NOT_AN_IMAGE") console.warn("finishPhotoUpload:", (err as Error).cause);
    return answer({ error: message === "TOO_LARGE" ? "over 20 MB" : "couldn't be read as an image" });
  }
  started = performance.now();

  let full = false;
  try {
    await updateUser(user.id, (u) => {
      if (u.photos.some((p) => p.id === photo.id)) return; // finished twice
      full = u.photos.length >= photoLimit(u);
      if (!full) u.photos.push({ ...photo, createdAt: new Date().toISOString() });
    });
  } catch (err) {
    // The account was deleted while the photo was uploading (say, from
    // another tab). Don't leave its photos behind.
    if ((err as Error).message !== "USER_NOT_FOUND") throw err;
    await storage.removeAll(user.id);
    return signedOut();
  }
  lap("save");
  if (full) {
    await deletePhotoFiles(user.id, { ...photo, createdAt: "" });
    return answer({ error: photoLimitMessage(user) });
  }
  // The browser refreshes the page itself once the whole batch is done.
  revalidatePath("/dashboard", "layout");
  return answer({ ok: "Uploaded 1 photo." });
}
