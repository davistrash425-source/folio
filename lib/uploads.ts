// Photo storage. Everything that touches the disk goes through `storage`
// below, so moving to S3 / R2 / Vercel Blob means replacing that one object
// (and photoUrl) rather than changing the rest of the app.
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { DATA_DIR, type Photo } from "./db";
import { processImage, variantName } from "./images";

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const MIME_BY_EXT = Object.fromEntries(
  Object.entries(IMAGE_TYPES).map(([mime, ext]) => [ext, mime]),
);

// Originals keep their metadata (it's the photographer's own file, used for
// export), so they are never served publicly.
export function isPrivateFile(file: string) {
  return file.includes(".orig.");
}

const local = (userId: string, file: string) =>
  path.join(UPLOAD_DIR, path.basename(userId), path.basename(file));

export const storage = {
  async put(userId: string, file: string, data: Buffer) {
    await fs.mkdir(path.join(UPLOAD_DIR, path.basename(userId)), { recursive: true });
    await fs.writeFile(local(userId, file), data);
  },
  async get(userId: string, file: string) {
    return fs.readFile(local(userId, file));
  },
  async remove(userId: string, file: string) {
    await fs.rm(local(userId, file), { force: true });
  },
  async removeAll(userId: string) {
    await fs.rm(path.join(UPLOAD_DIR, path.basename(userId)), { recursive: true, force: true });
  },
};

export function photoUrl(userId: string, file: string) {
  return `/api/uploads/${userId}/${file}`;
}

function baseName(file: string) {
  return file.replace(/\.orig\.[a-z]+$|\.[a-z]+$/, "");
}

// Saves the original and its web-sized copies. Returns the fields for a new
// Photo record.
export async function savePhoto(userId: string, file: File): Promise<Omit<Photo, "createdAt">> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("UNSUPPORTED_TYPE");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("TOO_LARGE");
  const id = randomUUID();
  const data = Buffer.from(await file.arrayBuffer());
  return { id, ...(await storePhoto(userId, `${id}.orig.${ext}`, data)) };
}

// Stores an image under `file` along with its resized copies.
export async function storePhoto(userId: string, file: string, data: Buffer) {
  const image = await processImage(data); // throws on files that aren't images
  await storage.put(userId, file, data);
  await Promise.all(
    image.variants.map((v) => storage.put(userId, variantName(baseName(file), v.width), v.data)),
  );
  return {
    file,
    width: image.width,
    height: image.height,
    variants: image.variants.map((v) => v.width),
  };
}

export async function deletePhotoFiles(userId: string, photo: Photo) {
  await Promise.all([
    storage.remove(userId, photo.file),
    ...(photo.variants ?? []).map((w) => storage.remove(userId, variantName(baseName(photo.file), w))),
  ]);
}

export type PhotoSource = {
  id: string;
  src: string;
  srcSet?: string;
  width?: number;
  height?: number;
  alt: string;
};

// What an <img> needs to show a photo at the right size.
export function photoSource(userId: string, photo: Photo): PhotoSource {
  const base = { id: photo.id, width: photo.width, height: photo.height, alt: photo.alt ?? "" };
  if (!photo.variants?.length) return { ...base, src: photoUrl(userId, photo.file) };
  const urls = photo.variants.map((w) => [w, photoUrl(userId, variantName(baseName(photo.file), w))] as const);
  const fallback = urls.find(([w]) => w >= 1280) ?? urls[urls.length - 1];
  return {
    ...base,
    src: fallback[1],
    srcSet: urls.map(([w, url]) => `${url} ${w}w`).join(", "),
  };
}
