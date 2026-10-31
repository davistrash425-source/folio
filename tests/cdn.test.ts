// Purging Cloudflare's edge cache for removed photos: lib/cdn.ts, called from
// deleteWebCopies in lib/uploads.ts.
import { beforeEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { deleteWebCopies } from "../lib/uploads.ts";
import { addPhoto, makeUser, resetRequest } from "./helpers.ts";

beforeEach(resetRequest);

function purgeEnv(t: TestContext) {
  process.env.R2_PUBLIC_URL = "https://photos.example.com";
  process.env.CLOUDFLARE_PURGE_TOKEN = "a-token";
  process.env.CLOUDFLARE_PURGE_ZONE_ID = "zone-123";
  t.after(() => {
    delete process.env.R2_PUBLIC_URL;
    delete process.env.CLOUDFLARE_PURGE_TOKEN;
    delete process.env.CLOUDFLARE_PURGE_ZONE_ID;
  });
}

test("deleting a photo's web copies also purges each address from the CDN", async (t) => {
  const alice = await makeUser("Alice");
  const { photo } = await addPhoto(alice.id);
  purgeEnv(t);

  const sent: { url: string; body: string }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | Request, init?: RequestInit) => {
    const r = new Request(input, init);
    sent.push({ url: r.url, body: await r.text() });
    return new Response('{"success":true}');
  });

  const removed = await deleteWebCopies(alice.id, photo);
  assert.equal(removed, (photo.variants ?? []).length);

  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "https://api.cloudflare.com/client/v4/zones/zone-123/purge_cache");
  const { files } = JSON.parse(sent[0].body);
  assert.deepEqual(
    [...files].sort(),
    (photo.variants ?? []).map((w) => `https://photos.example.com/${alice.id}/${photo.id}-${w}.webp`).sort(),
  );
});

test("without the token or public address, nothing is purged", async (t) => {
  const alice = await makeUser("Alice");
  const { photo } = await addPhoto(alice.id);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("");
  });
  await deleteWebCopies(alice.id, photo);
  assert.equal(calls, 0);
});
