import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_EDGE, MAX_PIXELS, compressionAttempts, fitWithin, formatMB } from "../lib/compress-image.ts";

test("photos within the limits are left the same size", () => {
  assert.deepEqual(fitWithin(6000, 4000), { width: 6000, height: 4000 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
});

test("huge photos shrink to fit the edge and pixel limits, keeping proportions", () => {
  const wide = fitWithin(16000, 8000); // 128 MP panorama
  assert.ok(Math.max(wide.width, wide.height) <= MAX_EDGE);
  assert.ok(wide.width * wide.height <= MAX_PIXELS);
  assert.ok(Math.abs(wide.width / wide.height - 2) < 0.01);

  const square = fitWithin(9000, 9000); // under the edge limit but 81 MP
  assert.ok(square.width * square.height <= MAX_PIXELS);
  assert.equal(square.width, square.height);
});

test("compression tries lower quality before shrinking, and stops at a sensible size", () => {
  const attempts = compressionAttempts(8000, 6000);
  assert.deepEqual(attempts.slice(0, 3).map((a) => a.scale), [1, 1, 1]);
  assert.ok(attempts[0].quality > attempts[2].quality);
  const scales = attempts.map((a) => a.scale);
  assert.deepEqual([...scales].sort((a, b) => b - a), scales, "scales only go down");
  assert.ok(8000 * scales[scales.length - 1] >= 1600, "never below 1600px");
  assert.ok(attempts.length > 3, "can shrink when quality isn't enough");

  // A photo already small can still lose quality, but has nothing to shrink to.
  assert.equal(compressionAttempts(1500, 1000).length, 3);
});

test("sizes are shown in MB", () => {
  assert.equal(formatMB(34 * 1024 * 1024), "34 MB");
  assert.equal(formatMB(5.5 * 1024 * 1024), "5.5 MB");
});
