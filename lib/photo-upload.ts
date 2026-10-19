// The browser side of sending one photo straight to storage: ask the app for
// an address (app/api/photos/start), send the file there, then have the app
// make its web copies (app/api/photos/finish). Connections drop, phones most
// of all (Safari pauses when the screen locks), so each step is retried.

export class UploadError extends Error {
  readonly retry: boolean; // trying again might work (no connection, a server hiccup)
  constructor(message: string, retry = false) {
    super(message);
    this.retry = retry;
  }
}

// Waits between attempts, so a dropped connection has time to come back.
export const RETRY_DELAYS = [1000, 3000, 10000];

export async function retrying<T>(run: () => Promise<T>, delays = RETRY_DELAYS): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (!(err instanceof UploadError && err.retry) || attempt >= delays.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

// Posts JSON to one of the app's upload routes and returns its answer.
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new UploadError("the connection dropped", true);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const temporary = res.status >= 500 || res.status === 408 || res.status === 429;
    throw new UploadError(data?.error ?? "the server didn’t answer", temporary);
  }
  return data as T;
}

// A connection that sends nothing for this long is dead, even if the browser
// hasn't noticed (Safari on a locked iPhone can wait forever).
const STALL_MS = 45_000;

// PUTs a file to a presigned storage address, reporting bytes sent. Uses
// XMLHttpRequest because fetch can't report upload progress.
export function putFile(url: string, file: Blob, type: string, onProgress: (sent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (error: UploadError) => {
      clearTimeout(timer);
      reject(error);
    };
    const alive = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        xhr.abort();
        fail(new UploadError("the connection stalled", true));
      }, STALL_MS);
    };
    xhr.open("PUT", url);
    // Must match the type the address was signed for.
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => {
      alive();
      onProgress(e.loaded);
    };
    xhr.onload = () => {
      clearTimeout(timer);
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      // 403 is usually an address that expired while waiting; a new one fixes it.
      fail(new UploadError(`storage refused the photo (${xhr.status})`, xhr.status >= 500 || xhr.status === 403));
    };
    xhr.onerror = () => fail(new UploadError("the connection dropped", true));
    alive();
    xhr.send(file);
  });
}

type Start = { error?: string; direct?: { file: string; url: string } };
type Finish = { error?: string; ok?: string };

// Sends one photo straight to storage. Returns false, having sent nothing,
// when storage doesn't take direct uploads (the local disk); the caller then
// sends it through the app instead.
export async function uploadDirect(
  file: Blob,
  type: string,
  on: {
    progress: (sent: number) => void;
    finishing: () => void;
    send?: typeof putFile; // tests swap these
    delays?: number[];
  },
): Promise<boolean> {
  const { send = putFile, delays = RETRY_DELAYS } = on;
  // A retry asks for a new address too, in case the old one expired.
  const name = await retrying(async () => {
    const start = await postJson<Start>("/api/photos/start", { type, size: file.size });
    if (start.error) throw new UploadError(start.error);
    if (!start.direct) return null;
    on.progress(0);
    await send(start.direct.url, file, type, on.progress);
    return start.direct.file;
  }, delays);
  if (!name) return false;
  on.finishing();
  // Finishing the same photo twice adds it once, so this is safe to retry.
  const done = await retrying(() => postJson<Finish>("/api/photos/finish", { file: name }), delays);
  if (done.error) throw new UploadError(done.error);
  return true;
}
