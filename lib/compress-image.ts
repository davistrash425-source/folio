// Gets photos ready to upload, in the browser: shrinks those too big to upload
// and turns HEIC (which the server can't read) into JPEG. Other photos pass
// through untouched. The maths is plain functions so tests can run it with
// Node; only `compressPhoto` needs a browser.

// Keep in sync with MAX_PHOTO_BYTES in lib/uploads.ts.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// Aim a little under the limit so the upload isn't rejected by a few KB.
const TARGET_BYTES = 18 * 1024 * 1024;

// Browsers can't draw bigger canvases than this. Safari on iPhone stops at
// 16.7 million pixels and then draws nothing at all, with no error, and
// phones run short of memory well before computers do.
export const MAX_EDGE = 8000;
export const MAX_PIXELS = 40_000_000;
export const PHONE_MAX_PIXELS = 4096 * 4096;

// iPhones and iPads (which call themselves Macs, but have touch screens).
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function pixelLimit() {
  return isIOS() || /Android/.test(navigator.userAgent) ? PHONE_MAX_PIXELS : MAX_PIXELS;
}

const QUALITIES = [0.92, 0.85, 0.8];
const SHRINK_STEP = 0.8; // each extra attempt makes the photo 80% as wide
const MIN_EDGE = 1600; // never shrink below what the site can show

// The types the server takes. Keep in sync with IMAGE_TYPES in lib/uploads.ts.
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
};

// What a chosen file really is. Browsers leave the type empty when the
// computer doesn't know the extension (AVIF or HEIC on some Windows PCs), and
// some say "image/jpg" or "image/pjpeg" for JPEGs.
export function photoType(file: { name: string; type: string }) {
  const type = file.type.toLowerCase();
  if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
  if (UPLOAD_TYPES.includes(type) || isHeic(type)) return type;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1].toLowerCase() ?? "";
  return Object.hasOwn(TYPE_BY_EXTENSION, ext) ? TYPE_BY_EXTENSION[ext] : type;
}

// The iPhone's own photo format. Uploading from the Photos library on an
// iPhone hands over a JPEG instead, but a Mac or the Files app gives HEIC.
export function isHeic(type: string) {
  return /^image\/hei[cf](-sequence)?$/.test(type);
}

// The size to draw a photo at so it fits the edge and pixel limits.
// Never makes a photo bigger.
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE, maxPixels = MAX_PIXELS) {
  const scale = Math.min(1, maxEdge / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
  // Rounded down so the limits are never exceeded.
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export type Attempt = { scale: number; quality: number };

// The sizes and qualities to try, best first: quality drops before the photo
// itself shrinks, and it stops shrinking at MIN_EDGE.
export function compressionAttempts(width: number, height: number): Attempt[] {
  const attempts: Attempt[] = QUALITIES.map((quality) => ({ scale: 1, quality }));
  for (let scale = SHRINK_STEP; Math.max(width, height) * scale >= MIN_EDGE; scale *= SHRINK_STEP) {
    attempts.push({ scale, quality: 0.85 });
  }
  return attempts;
}

export function formatMB(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export type CompressResult =
  | { file: File; from: number; to: number; converted: boolean } // `file` is a new file
  | { file: File; from?: undefined }; // ready to upload; unchanged

export class CompressError extends Error {}

// Returns `file` itself when it can be uploaded as it is. `type` is the file's
// real type, from photoType.
export async function compressPhoto(file: File, type = photoType(file)): Promise<CompressResult> {
  const heic = isHeic(type);
  if (!heic && file.size <= MAX_UPLOAD_BYTES) return { file };
  if (type === "image/gif") {
    throw new CompressError("GIFs over 20 MB can’t be compressed without losing the animation");
  }

  let bitmap: ImageBitmap;
  try {
    // Applies the camera's rotation so the result isn't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new CompressError(
      heic
        ? "this browser can’t open HEIC photos — export it as a JPG (in Photos: File › Export), or upload from Safari"
        : "couldn’t be opened to compress — try exporting a smaller JPG",
    );
  }

  try {
    const full = fitWithin(bitmap.width, bitmap.height, MAX_EDGE, pixelLimit());
    for (const { scale, quality } of compressionAttempts(full.width, full.height)) {
      const width = Math.max(1, Math.round(full.width * scale));
      const height = Math.max(1, Math.round(full.height * scale));
      const blob = await encode(bitmap, width, height, quality, type === "image/png");
      if (blob && blob.size <= TARGET_BYTES) {
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
        return { file: new File([blob], name, { type: blob.type }), from: file.size, to: blob.size, converted: heic };
      }
    }
  } finally {
    bitmap.close();
  }
  throw new CompressError("is still too large after compressing — try a smaller export");
}

// PNGs go to WebP, which keeps transparency; browsers that can't write WebP
// fall back to JPEG over white. Everything else becomes JPEG.
async function encode(bitmap: ImageBitmap, width: number, height: number, quality: number, isPng: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

    if (isPng) {
      ctx.drawImage(bitmap, 0, 0, width, height);
      const webp = await toBlob("image/webp");
      if (webp && webp.type === "image/webp") return webp;
    }
    // JPEG has no transparency, which would turn black without a backdrop.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await toBlob("image/jpeg");
  } finally {
    // Safari keeps a canvas's memory until it's garbage collected, and on an
    // iPhone runs out after a few big ones. Shrinking it frees that now.
    canvas.width = canvas.height = 0;
  }
}
