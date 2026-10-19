// Turns the photos in folio-homepage-photos/ (git-ignored originals) into the
// small web copies the landing page shows: 600x400 WebP in public/home/, with
// EXIF and GPS removed, listed in order in app/ui/home-photos.json.
// Photos already on the list keep their name and place; new ones go at the end,
// and ones deleted from the folder come off the list. Run after adding photos:
//   npm run homepage-photos
import { existsSync, promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

type Entry = { name: string; source: string };

const sourceDir = path.resolve("folio-homepage-photos");
const outDir = path.resolve("public/home");
const listFile = path.resolve("app/ui/home-photos.json");

const files = (await fs.readdir(sourceDir)).filter((f) => /\.(jpe?g|png|webp|tiff?|avif)$/i.test(f)).sort();
const old: Entry[] = existsSync(listFile) ? JSON.parse(await fs.readFile(listFile, "utf8")) : [];
const list = old.filter((e) => files.includes(e.source));

for (const source of files) {
  if (list.some((e) => e.source === source)) continue;
  const base = path.parse(source).name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "photo";
  let name = base;
  for (let n = 2; list.some((e) => e.name === name); n++) name = `${base}-${n}`;
  list.push({ name, source });
}

await fs.mkdir(outDir, { recursive: true });
for (const { name, source } of list) {
  const out = path.join(outDir, `${name}.webp`);
  if (existsSync(out)) continue;
  // rotate() applies the camera's orientation; sharp writes no metadata unless asked.
  await sharp(path.join(sourceDir, source))
    .rotate()
    .resize(600, 400, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toFile(out);
  console.log(`added ${name} (${source})`);
}
for (const { name, source } of old) {
  if (list.some((e) => e.name === name)) continue;
  await fs.rm(path.join(outDir, `${name}.webp`), { force: true });
  console.log(`removed ${name} (${source})`);
}

await fs.writeFile(listFile, JSON.stringify(list, null, 2) + "\n");
console.log(`${list.length} photos on the homepage`);
