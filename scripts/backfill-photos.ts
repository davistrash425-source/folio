// Creates resized, metadata-free copies for photos uploaded before lib/images.ts
// existed, and renames their originals so they're no longer served.
// Run once with the dev server stopped:  npm run backfill-photos
import { promises as fs } from "fs";
import path from "path";
import { processImage, variantName } from "../lib/images.ts";

type Photo = { file: string; width?: number; height?: number; variants?: number[] };
type Db = { users: { id: string; photos: Photo[] }[] };

const dataDir = path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "db.json");
const db = JSON.parse(await fs.readFile(dbFile, "utf8")) as Db;
let done = 0;
let failed = 0;

for (const user of db.users) {
  const dir = path.join(dataDir, "uploads", user.id);
  for (const photo of user.photos) {
    if (photo.variants?.length) continue;
    try {
      const data = await fs.readFile(path.join(dir, photo.file));
      const image = await processImage(data);
      const ext = path.extname(photo.file);
      const base = path.basename(photo.file, ext);
      for (const v of image.variants) await fs.writeFile(path.join(dir, variantName(base, v.width)), v.data);
      const original = `${base}.orig${ext}`;
      await fs.rename(path.join(dir, photo.file), path.join(dir, original));
      Object.assign(photo, {
        file: original,
        width: image.width,
        height: image.height,
        variants: image.variants.map((v) => v.width),
      });
      done++;
    } catch (err) {
      failed++;
      console.error(`Skipped ${user.id}/${photo.file}:`, (err as Error).message);
    }
  }
}

await fs.writeFile(dbFile, JSON.stringify(db, null, 2));
console.log(`Processed ${done} photo(s)${failed ? `, ${failed} skipped` : ""}.`);
