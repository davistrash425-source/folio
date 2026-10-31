import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { updateUser } from "@/lib/db";
import { uploadBlock } from "@/lib/plans";
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

// One request at a time per upload. A second, racing request for the same file
// waits for the first and reuses its answer, so the web copies aren't made
// twice. (Per-process; on a multi-instance host the extra write is harmless —
// identical bytes under the same names.)
const inflight = new Map<string, Promise<Response>>();

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
  if (user.suspended) return answer({ error: "your site is suspended, so you can't upload right now" });
  lap("auth");
  const body = await req.json().catch(() => null);
  const file = typeof body?.file === "string" ? body.file : "";
  // Checked before any web copy is written. A photo already in the account
  // is never made public again by calling this twice, and a photo taken
  // down by Folio (its record stays, marked removed) stays down.
  const existing = user.photos.find((p) => p.file === file);
  if (existing?.removed) return answer({ error: "this photo was taken down by Folio, so it can't be uploaded again" });
  if (existing) return answer({ ok: "Uploaded 1 photo." });

  const pending = inflight.get(file);
  if (pending) return (await pending).clone();

  const finish = async (): Promise<Response> => {
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

    let blocked: string | null = null;
    try {
      await updateUser(user.id, (u) => {
        u.pendingUploads = u.pendingUploads?.filter((p) => p.file !== file && p.expires > Date.now());
        if (u.photos.some((p) => p.id === photo.id)) return; // finished twice
        blocked = uploadBlock(u, photo.bytes);
        if (!blocked) u.photos.push({ ...photo, createdAt: new Date().toISOString() });
      });
    } catch (err) {
      // The account was deleted while the photo was uploading (say, from
      // another tab). Don't leave its photos behind.
      if ((err as Error).message !== "USER_NOT_FOUND") throw err;
      await storage.removeAll(user.id);
      return signedOut();
    }
    lap("save");
    if (blocked) {
      await deletePhotoFiles(user.id, { ...photo, createdAt: "" });
      return answer({ error: blocked });
    }
    // The browser refreshes the page itself once the whole batch is done.
    revalidatePath("/dashboard", "layout");
    return answer({ ok: "Uploaded 1 photo." });
  };

  const running = finish();
  inflight.set(file, running);
  try {
    return await running;
  } finally {
    inflight.delete(file);
  }
}
