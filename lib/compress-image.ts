// Shrinks photos that are too big to upload, in the browser, before they are
// sent. Smaller photos pass through untouched. The size maths is plain
// functions so tests can run it with Node; only `compressPhoto` needs a browser.

// Keep in sync with MAX_PHOTO_BYTES in lib/uploads.ts.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// Aim a little under the limit so the upload isn't rejected by a few KB.
const TARGET_BYTES = 18 * 1024 * 1024;

// Phones and older browsers can't draw bigger canvases than this.
export const MAX_EDGE = 8000;
export const MAX_PIXELS = 40_000_000;

const QUALITIES = [0.92, 0.85, 0.8];
const SHRINK_STEP = 0.8; // each extra attempt makes the photo 80% as wide
const MIN_EDGE = 1600; // never shrink below what the site can show

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
  | { file: File; from: number; to: number } // `file` is a new, smaller file
  | { file: File; from?: undefined }; // already small enough; unchanged

export class CompressError extends Error {}

// Returns `file` itself when it is small enough to upload.
export async function compressPhoto(file: File): Promise<CompressResult> {
  if (file.size <= MAX_UPLOAD_BYTES) return { file };
  if (file.type === "image/gif") {
    throw new CompressError("GIFs over 20 MB can’t be compressed without losing the animation");
  }

  let bitmap: ImageBitmap;
  try {
    // Applies the camera's rotation so the result isn't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new CompressError("couldn’t be opened to compress — try exporting a smaller JPG");
  }

  try {
    const full = fitWithin(bitmap.width, bitmap.height);
    for (const { scale, quality } of compressionAttempts(full.width, full.height)) {
      const width = Math.max(1, Math.round(full.width * scale));
      const height = Math.max(1, Math.round(full.height * scale));
      const blob = await encode(bitmap, width, height, quality, file.type === "image/png");
      if (blob && blob.size <= TARGET_BYTES) {
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
        return { file: new File([blob], name, { type: blob.type }), from: file.size, to: blob.size };
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
  return toBlob("image/jpeg");
}
