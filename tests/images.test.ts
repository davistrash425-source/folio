import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processImage } from "../lib/images.ts";

async function jpeg(width: number, height: number, withGps = false) {
  let img = sharp({ create: { width, height, channels: 3, background: "#888" } });
  if (withGps) {
    img = img.withExif({ IFD0: { Make: "TestCam", Model: "X1" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "38/1 42/1 0/1" } });
  }
  return img.jpeg().toBuffer();
}

test("makes web sizes without upscaling", async () => {
  const big = await processImage(await jpeg(3000, 2000));
  assert.deepEqual(big.variants.map((v) => v.width), [640, 1280, 2048]);
  assert.equal(big.width, 3000);
  assert.equal(big.height, 2000);

  const small = await processImage(await jpeg(900, 600));
  assert.deepEqual(small.variants.map((v) => v.width), [640, 900]);
});

test("served copies carry no EXIF or GPS data", async () => {
  const input = await jpeg(1600, 1200, true);
  assert.ok((await sharp(input).metadata()).exif, "fixture should have EXIF");
  const { variants } = await processImage(input);
  for (const v of variants) {
    const meta = await sharp(v.data).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.exif, undefined);
  }
});

test("applies EXIF orientation", async () => {
  // Orientation 6 = stored landscape, displayed portrait.
  const input = await sharp({ create: { width: 1000, height: 500, channels: 3, background: "#888" } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const out = await processImage(input);
  assert.equal(out.width, 500);
  assert.equal(out.height, 1000);
  const meta = await sharp(out.variants[0].data).metadata();
  assert.ok(meta.height! > meta.width!);
});

test("rejects files that are not images", async () => {
  await assert.rejects(processImage(Buffer.from("not an image")));
});
