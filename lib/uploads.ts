// Photo storage. Everything that reads or writes photo files goes through
// `storage` below: Cloudflare R2 when the R2_* settings are present (in
// production), otherwise the local disk (development and tests).
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { AwsClient } from "aws4fetch";
import type { Photo } from "./db";
import { DATA_DIR } from "./pg";
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

// No prototype, so looking up an extension like "constructor" finds nothing
// instead of one of JavaScript's built-in properties.
export const MIME_BY_EXT: Record<string, string | undefined> = Object.assign(
  Object.create(null),
  Object.fromEntries(Object.entries(IMAGE_TYPES).map(([mime, ext]) => [ext, mime])),
);

// Originals keep their metadata (it's the photographer's own file, used for
// export), so they are never served publicly.
// Lowercased because Windows and macOS disks ignore case, so "x.ORIG.jpg"
// would otherwise open "x.orig.jpg".
export function isPrivateFile(file: string) {
  return file.toLowerCase().includes(".orig.");
}

// One folder or file name, never ".." or "." (which would point at the
// uploads folder or above it).
function segment(name: string) {
  const base = path.basename(name);
  if (!base || base === "." || base === "..") throw new Error("BAD_PATH");
  return base;
}

const userDir = (userId: string) => path.join(UPLOAD_DIR, segment(userId));
const local = (userId: string, file: string) => path.join(userDir(userId), segment(file));

export type Storage = {
  put(userId: string, file: string, data: Buffer): Promise<void>;
  get(userId: string, file: string): Promise<Buffer>; // throws if missing
  remove(userId: string, file: string): Promise<void>;
  removeAll(userId: string): Promise<void>;
  // A short-lived address the browser can upload `file` to directly, for
  // stores that support it (R2). Hosts like Vercel cap request bodies at a
  // few MB, so large photos can't go through the app's own server.
  // The address only accepts exactly `contentType` and `size` bytes.
  uploadUrl?(userId: string, file: string, contentType: string, size: number): Promise<string>;
};

// Local disk, under <DATA_DIR>/uploads/<userId>/. Served by app/api/uploads.
const diskStorage: Storage = {
  async put(userId, file, data) {
    await fs.mkdir(userDir(userId), { recursive: true });
    await fs.writeFile(local(userId, file), data);
  },
  async get(userId, file) {
    return fs.readFile(local(userId, file));
  },
  async remove(userId, file) {
    await fs.rm(local(userId, file), { force: true });
  },
  async removeAll(userId) {
    await fs.rm(userDir(userId), { recursive: true, force: true });
  },
};

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string; // web copies; readable by anyone at publicUrl
  privateBucket: string; // originals; never public
  publicUrl: string; // the public bucket's address, e.g. https://photos.example.com
};

export function r2ConfigFrom(env: Record<string, string | undefined>): R2Config | null {
  const config = {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    publicBucket: env.R2_PUBLIC_BUCKET,
    privateBucket: env.R2_PRIVATE_BUCKET,
    publicUrl: env.R2_PUBLIC_URL?.replace(/\/+$/, ""),
  };
  const missing = Object.entries(config).filter(([, v]) => !v);
  if (missing.length === Object.keys(config).length) return null; // R2 not set up: use the disk
  if (missing.length) {
    throw new Error(`R2 is partly configured; missing ${missing.map(([k]) => k).join(", ")}`);
  }
  return config as R2Config;
}

// Cloudflare R2, through its S3-compatible API. Keys are "<userId>/<file>".
// Originals go to the private bucket, everything else to the public one, so
// an original can't be fetched even by guessing its address.
export function r2Storage(config: R2Config): Storage {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 2, // R2 errors are retried, but not for long: someone is waiting
  });
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const bucketFor = (file: string) => (isPrivateFile(file) ? config.privateBucket : config.publicBucket);
  const objectUrl = (userId: string, file: string) =>
    `${endpoint}/${bucketFor(file)}/${encodeURIComponent(segment(userId))}/${encodeURIComponent(segment(file))}`;

  async function send(url: string, init: RequestInit = {}) {
    const res = await client.fetch(url, init);
    if (!res.ok && !(init.method === "DELETE" && res.status === 404)) {
      throw new Error(`R2 ${init.method ?? "GET"} failed: ${res.status}`);
    }
    return res;
  }

  // Every key in `bucket` under the user's folder, following continuation pages.
  async function list(bucket: string, userId: string) {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const query = new URLSearchParams({ "list-type": "2", prefix: `${segment(userId)}/` });
      if (token) query.set("continuation-token", token);
      const xml = await (await send(`${endpoint}/${bucket}?${query}`)).text();
      for (const [, key] of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(unescapeXml(key));
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? unescapeXml(/<NextContinuationToken>([^<]*)</.exec(xml)?.[1] ?? "")
        : undefined;
    } while (token);
    return keys;
  }

  return {
    async put(userId, file, data) {
      const ext = path.extname(file).slice(1).toLowerCase();
      await send(objectUrl(userId, file), {
        method: "PUT",
        body: new Uint8Array(data),
        headers: {
          "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
          // File names are random and never reused, so browsers and the CDN can keep them.
          ...(isPrivateFile(file) ? {} : { "Cache-Control": "public, max-age=31536000, immutable" }),
        },
      });
    },
    async get(userId, file) {
      return Buffer.from(await (await send(objectUrl(userId, file))).arrayBuffer());
    },
    async remove(userId, file) {
      await send(objectUrl(userId, file), { method: "DELETE" });
    },
    async uploadUrl(userId, file, contentType, size) {
      const url = new URL(objectUrl(userId, file));
      url.searchParams.set("X-Amz-Expires", String(UPLOAD_URL_SECONDS));
      // The type and size are signed, so R2 refuses anything but the photo the
      // browser declared (which directUpload already checked is under the limit).
      const signed = await client.sign(url.toString(), {
        method: "PUT",
        headers: { "Content-Type": contentType, "Content-Length": String(size) },
        aws: { signQuery: true, allHeaders: true },
      });
      return signed.url;
    },
    async removeAll(userId) {
      for (const bucket of [config.publicBucket, config.privateBucket]) {
        const keys = await list(bucket, userId);
        for (let i = 0; i < keys.length; i += 10) {
          await Promise.all(
            keys
              .slice(i, i + 10)
              .map((key) =>
                send(`${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" }),
              ),
          );
        }
      }
    },
  };
}

const UPLOAD_URL_SECONDS = 10 * 60;

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const r2 = r2ConfigFrom(process.env);

// Where photos live: R2 when its settings are present, otherwise the disk.
export const storage: Storage = r2 ? r2Storage(r2) : diskStorage;

export function photoUrl(userId: string, file: string) {
  return r2 ? `${r2.publicUrl}/${userId}/${file}` : `/api/uploads/${userId}/${file}`;
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
  return saveVariants(userId, file, image);
}

// The name the browser uploads an original under: server-chosen, so it can't
// name anything else.
const ORIGINAL_NAME = new RegExp(
  `^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\.orig\\.(${Object.values(IMAGE_TYPES).join("|")})$`,
);

// Picks the name and upload address for a photo the browser will send
// straight to storage. Returns null when the store can't take direct uploads
// (the local disk), and the photo goes through uploadPhotos instead.
export async function directUpload(userId: string, contentType: string, size: number) {
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("TOO_LARGE");
  const ext = IMAGE_TYPES[contentType];
  if (!ext) throw new Error("UNSUPPORTED_TYPE");
  if (size > MAX_PHOTO_BYTES) throw new Error("TOO_LARGE");
  if (!storage.uploadUrl) return null;
  const file = `${randomUUID()}.orig.${ext}`;
  return { file, url: await storage.uploadUrl(userId, file, contentType, size) };
}

// After a direct upload: checks the original that arrived (a real image,
// within the size limit) and makes its web copies. A bad file is deleted.
// Returns the fields for a new Photo record.
export async function finishDirectUpload(userId: string, file: string): Promise<Omit<Photo, "createdAt">> {
  const match = ORIGINAL_NAME.exec(file);
  if (!match) throw new Error("BAD_PATH");
  const data = await storage.get(userId, file).catch(() => {
    throw new Error("NOT_UPLOADED");
  });
  try {
    if (data.length > MAX_PHOTO_BYTES) throw new Error("TOO_LARGE");
    return { id: match[1], ...(await saveVariants(userId, file, await processImage(data))) };
  } catch (err) {
    await storage.remove(userId, file).catch(() => {});
    throw err;
  }
}

async function saveVariants(userId: string, file: string, image: Awaited<ReturnType<typeof processImage>>) {
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
  description: string;
  location: string;
  createdAt: string;
};

// What an <img> needs to show a photo at the right size.
export function photoSource(userId: string, photo: Photo): PhotoSource {
  const base = {
    id: photo.id,
    width: photo.width,
    height: photo.height,
    alt: photo.alt || photo.description || "",
    description: photo.description ?? "",
    location: photo.location ?? "",
    createdAt: photo.createdAt,
  };
  if (!photo.variants?.length) return { ...base, src: photoUrl(userId, photo.file) };
  const urls = photo.variants.map((w) => [w, photoUrl(userId, variantName(baseName(photo.file), w))] as const);
  const fallback = urls.find(([w]) => w >= 1280) ?? urls[urls.length - 1];
  return {
    ...base,
    src: fallback[1],
    srcSet: urls.map(([w, url]) => `${url} ${w}w`).join(", "),
  };
}
