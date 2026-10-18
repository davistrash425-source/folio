// Photo storage on Cloudflare R2 (lib/uploads.ts, r2Storage). The network is
// faked: these check what would be sent to R2, not R2 itself.
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { r2ConfigFrom, r2Storage, type R2Config } from "../lib/uploads.ts";

const config: R2Config = {
  accountId: "acct",
  accessKeyId: "key",
  secretAccessKey: "secret",
  publicBucket: "folio-public",
  privateBucket: "folio-private",
  publicUrl: "https://photos.example.com",
};
const endpoint = "https://acct.r2.cloudflarestorage.com";

type Sent = { method: string; url: string; headers: Headers; body: string };

// Records every request; `reply` decides each response.
function fakeR2(t: TestContext, reply: (req: Sent) => Response = () => new Response("")) {
  const sent: Sent[] = [];
  t.mock.method(globalThis, "fetch", async (input: Request) => {
    const req = { method: input.method, url: input.url, headers: input.headers, body: await input.text() };
    sent.push(req);
    return reply(req);
  });
  return sent;
}

test("R2 is used only when every setting is there, and half a setup is an error", () => {
  assert.equal(r2ConfigFrom({}), null);
  const env = {
    R2_ACCOUNT_ID: "acct",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_PUBLIC_BUCKET: "folio-public",
    R2_PRIVATE_BUCKET: "folio-private",
    R2_PUBLIC_URL: "https://photos.example.com/",
  };
  assert.deepEqual(r2ConfigFrom(env), config, "trailing slash dropped from the address");
  assert.throws(() => r2ConfigFrom({ ...env, R2_PRIVATE_BUCKET: "" }), /missing privateBucket/);
});

test("originals go to the private bucket, web copies to the public one", async (t) => {
  const sent = fakeR2(t);
  const storage = r2Storage(config);
  await storage.put("u1", "abc.orig.jpg", Buffer.from("original"));
  await storage.put("u1", "abc-1280.webp", Buffer.from("copy"));

  assert.equal(sent[0].method, "PUT");
  assert.equal(sent[0].url, `${endpoint}/folio-private/u1/abc.orig.jpg`);
  assert.equal(sent[0].body, "original");
  assert.equal(sent[0].headers.get("content-type"), "image/jpeg");
  assert.equal(sent[0].headers.get("cache-control"), null, "originals aren't marked cacheable");
  assert.match(sent[0].headers.get("authorization") ?? "", /^AWS4-HMAC-SHA256 Credential=key\//, "requests are signed");

  assert.equal(sent[1].url, `${endpoint}/folio-public/u1/abc-1280.webp`);
  assert.equal(sent[1].headers.get("content-type"), "image/webp");
  assert.match(sent[1].headers.get("cache-control") ?? "", /immutable/);
});

test("file names can't reach outside the user's own folder", async (t) => {
  const sent = fakeR2(t);
  const storage = r2Storage(config);
  await storage.put("u1", "../u2/abc-640.webp", Buffer.from("x"));
  assert.equal(sent[0].url, `${endpoint}/folio-public/u1/abc-640.webp`);
  await assert.rejects(storage.put("..", "abc-640.webp", Buffer.from("x")), /BAD_PATH/);
});

test("reading a file returns its bytes, and a missing file is an error", async (t) => {
  fakeR2(t, (req) => (req.url.endsWith("/here.webp") ? new Response("bytes") : new Response("", { status: 404 })));
  const storage = r2Storage(config);
  assert.equal((await storage.get("u1", "here.webp")).toString(), "bytes");
  await assert.rejects(storage.get("u1", "gone.webp"), /404/);
});

test("removing a file that's already gone is fine; other failures aren't", async (t) => {
  let status = 404;
  fakeR2(t, () => new Response("", { status }));
  const storage = r2Storage(config);
  await storage.remove("u1", "abc.orig.jpg");
  status = 500;
  await assert.rejects(storage.remove("u1", "abc.orig.jpg"), /500/);
});

test("removing everything deletes the user's files from both buckets, across pages, and nothing else", async (t) => {
  const listing = (keys: string[], next?: string) =>
    new Response(
      `<ListBucketResult>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join("")}` +
        `<IsTruncated>${next ? "true" : "false"}</IsTruncated>` +
        (next ? `<NextContinuationToken>${next}</NextContinuationToken>` : "") +
        `</ListBucketResult>`,
    );
  const sent = fakeR2(t, (req) => {
    if (req.method !== "GET") return new Response("");
    const url = new URL(req.url);
    if (url.pathname === "/folio-public") {
      return url.searchParams.get("continuation-token") === "page2"
        ? listing(["u1/b-640.webp"])
        : listing(["u1/a-640.webp", "u1/a-1280.webp"], "page2");
    }
    return listing(["u1/a.orig.jpg"]);
  });
  await r2Storage(config).removeAll("u1");

  const lists = sent.filter((r) => r.method === "GET").map((r) => new URL(r.url));
  assert.ok(lists.every((u) => u.searchParams.get("prefix") === "u1/"), "only lists the user's own folder");
  const deleted = sent.filter((r) => r.method === "DELETE").map((r) => r.url.slice(endpoint.length)).sort();
  assert.deepEqual(deleted, [
    "/folio-private/u1/a.orig.jpg",
    "/folio-public/u1/a-1280.webp",
    "/folio-public/u1/a-640.webp",
    "/folio-public/u1/b-640.webp",
  ]);
});
