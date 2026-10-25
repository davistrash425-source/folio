"use client";

 
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { uploadPhotos } from "@/app/actions/site";
import { Button, Message } from "@/app/ui/form";
import { CompressError, MAX_UPLOAD_BYTES, UPLOAD_TYPES, compressPhoto, formatMB, isHeic, isIOS, photoType } from "@/lib/compress-image";
import { UploadError, finishDirect, sendDirect } from "@/lib/photo-upload";

type UploadItem = {
  file: File; // as chosen, to try again with
  status: "waiting" | "preparing" | "uploading" | "processing" | "done" | "failed";
  size: number; // bytes to send
  sent: number;
  reason?: string;
  retry?: boolean; // failed in a way that trying again might fix
  note?: string; // e.g. "Compressed 34 MB → 11 MB"
};

// Photos sent at the same time. More keeps a fast connection busy while the
// server works on earlier photos; too many slows each one down on a phone.
const CONCURRENT_UPLOADS = 3;

// Photos the server may be making web copies of at once. Twice the uploads,
// so a slot that just finished sending is never kept waiting by the others.
const MAX_FINISHING = CONCURRENT_UPLOADS * 2;

const ACCEPT = UPLOAD_TYPES.join(",");

// HEIC can be picked on a computer (it's converted in the browser), but not on
// an iPhone or iPad: offered only JPEG, iOS converts photos itself, faster.
const ACCEPT_WITH_HEIC = `${ACCEPT},image/heic,image/heif,.heic,.heif`;

const acceptForDevice = () => (isIOS() ? ACCEPT : ACCEPT_WITH_HEIC);

const neverChanges = () => () => {};

export function PhotoUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  // The device is only known in the browser; the server renders plain ACCEPT.
  const accept = useSyncExternalStore(neverChanges, acceptForDevice, () => ACCEPT);
  const busy = items.some((i) => i.status !== "done" && i.status !== "failed");
  const running = useRef(false); // set at once, before the state above updates

  async function upload(files: File[]) {
    if (files.length === 0 || running.current) return;
    running.current = true;
    setItems(files.map((file) => ({ file, status: "waiting", size: file.size, sent: 0 })));
    const update = (i: number, item: Partial<UploadItem>) =>
      setItems((cur) => cur.map((x, j) => (j === i ? { ...x, ...item } : x)));

    // Converting or shrinking a photo takes a lot of memory on a phone, so
    // only one is done at a time even while others upload.
    let preparing: Promise<unknown> = Promise.resolve();
    // Photos in storage that the server is still making web copies of.
    const finishing = new Set<Promise<void>>();
    let uploaded = 0;

    async function send(i: number, file: File) {
      const type = photoType(file);
      if (!UPLOAD_TYPES.includes(type) && !isHeic(type)) {
        return update(i, { status: "failed", reason: "not a JPG, PNG, WebP, GIF or AVIF" });
      }

      let toSend = file;
      let sendType = type;
      if (isHeic(type) || file.size > MAX_UPLOAD_BYTES) {
        update(i, { status: "preparing" });
        const compressed = preparing.then(() => compressPhoto(file, type));
        preparing = compressed.catch(() => {});
        try {
          const result = await compressed;
          if (result.from) {
            toSend = result.file;
            sendType = result.file.type;
            update(i, {
              size: result.to,
              note: result.converted ? "Converted from HEIC" : `Compressed ${formatMB(result.from)} → ${formatMB(result.to)}`,
            });
          }
        } catch (err) {
          return update(i, { status: "failed", reason: err instanceof CompressError ? err.message : "couldn’t be compressed" });
        }
      }

      const succeeded = () => {
        uploaded++;
        update(i, { status: "done", sent: toSend.size });
      };
      const failed = (err: unknown) => {
        const known = err instanceof UploadError;
        update(i, { status: "failed", reason: known ? err.message : "upload failed", retry: !known || err.retry });
      };

      update(i, { status: "uploading" });
      let stored: string | null;
      try {
        stored = await sendDirect(toSend, sendType, (sent) => update(i, { sent }));
        // No direct uploads (local development): through the app instead.
        if (!stored) {
          const fd = new FormData();
          fd.append("photos", new File([toSend], toSend.name, { type: sendType }));
          const result = await uploadPhotos({}, fd);
          // Its errors are written for a whole batch; only the limit one fits a single photo.
          if (result.error) throw new UploadError(/limit/.test(result.error) ? result.error : "couldn't be read as an image");
          return succeeded();
        }
      } catch (err) {
        return failed(err);
      }

      // The server takes a few seconds to make the web copies. Meanwhile this
      // upload slot moves on to the next photo, unless many are already
      // waiting on the server (a fast connection outpacing it).
      update(i, { status: "processing", sent: toSend.size });
      const finish: Promise<void> = finishDirect(stored)
        .then(succeeded, failed)
        .finally(() => finishing.delete(finish));
      finishing.add(finish);
      while (finishing.size >= MAX_FINISHING) await Promise.race(finishing);
    }

    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        await send(i, files[i]);
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENT_UPLOADS, files.length) }, worker));
      await Promise.all(finishing);
    } finally {
      running.current = false;
      if (inputRef.current) inputRef.current.value = "";
    }
    // Once for the whole batch: shows the new photos under "Recently uploaded".
    if (uploaded) router.refresh();
  }

  // For the drop listener below, which is added once.
  const uploadDropped = useEffectEvent((files: File[]) => upload(files));

  useEffect(() => {
    // A photo dropped beside the box would otherwise open in the tab,
    // leaving the page. Upload it instead.
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (e.defaultPrevented || !e.dataTransfer?.files.length) return;
      e.preventDefault();
      uploadDropped(Array.from(e.dataTransfer.files));
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  // Leaving the page stops the uploads, so ask first.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed");
  const retryable = failed.filter((i) => i.retry);
  const active = items.filter((i) => i.status === "preparing" || i.status === "uploading" || i.status === "processing");
  const total = items.reduce((n, i) => n + i.size, 0);
  const sent = items.reduce((n, i) => n + (i.status === "done" || i.status === "failed" ? i.size : i.sent), 0);
  const percent = total ? Math.floor((sent / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(Array.from(e.dataTransfer.files));
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed px-6 py-8 text-center transition ${
          dragging ? "border-black bg-paper" : "border-rule hover:border-ink-faint"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="font-medium">{busy ? `Uploading… ${percent}%` : "Drop photos here or click to choose"}</span>
        <span className="text-sm text-ink-soft">
          {busy
            ? "Keep this page open until it’s done."
            : "JPG, PNG, WebP, GIF, AVIF or HEIC. Photos over 20 MB are compressed for you."}
        </span>
        <input
          ref={inputRef}
          type="file"
          name="photos"
          accept={accept}
          multiple
          disabled={busy}
          onChange={(e) => upload(Array.from(e.target.files ?? []))}
          className="sr-only"
        />
      </label>

      {items.length > 0 && (
        <div className="space-y-2 text-sm" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden bg-ink/5" aria-hidden="true">
              <div className="h-full bg-ink transition-all" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-ink-soft">
              {done + failed.length} of {items.length}
            </span>
          </div>
          {/* Changes many times a second, so screen readers skip it. */}
          {active.map((i, n) => (
            <p key={n} className="truncate text-ink-soft" aria-hidden="true">
              {i.file.name}:{" "}
              {i.status === "preparing"
                ? "preparing…"
                : i.status === "processing"
                  ? "making web copies…"
                  : `${formatMB(i.sent)} of ${formatMB(i.size)}`}
            </p>
          ))}
          {!busy && done > 0 && <Message ok={`Uploaded ${done} photo${done === 1 ? "" : "s"}.`} />}
          {items.filter((i) => i.note).map((i, n) => (
            <p key={n} className="text-ink-soft">{i.file.name}: {i.note}</p>
          ))}
          {failed.length > 0 && (
            <ul className="text-accent" role="alert">
              {failed.map((f, i) => (
                <li key={i}>Couldn’t upload {f.file.name}: {f.reason?.replace(/\.$/, "")}.</li>
              ))}
            </ul>
          )}
          {!busy && retryable.length > 0 && (
            <Button type="button" onClick={() => upload(retryable.map((f) => f.file))}>
              Try {retryable.length === 1 ? "it" : `those ${retryable.length}`} again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

