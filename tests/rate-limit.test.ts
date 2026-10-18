import { beforeEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { clientIp, rateLimit } from "../lib/rate-limit.ts";
import { requestHeaders } from "./stubs/next-headers.ts";

const MINUTE = 60 * 1000;
let n = 0;
const freshKey = () => `test-${++n}`;

beforeEach(() => {
  for (const name of [...requestHeaders.keys()]) requestHeaders.delete(name);
});

test("allows `limit` attempts, then refuses", async () => {
  const key = freshKey();
  for (let i = 1; i <= 5; i++) assert.equal(await rateLimit(key, 5, MINUTE), true, `attempt ${i}`);
  assert.equal(await rateLimit(key, 5, MINUTE), false);
});

test("attempts are allowed again once the window has passed", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const key = freshKey();
  for (let i = 0; i < 3; i++) await rateLimit(key, 3, MINUTE);
  assert.equal(await rateLimit(key, 3, MINUTE), false);
  t.mock.timers.tick(MINUTE + 1);
  assert.equal(await rateLimit(key, 3, MINUTE), true);
});

test("the window slides: old attempts drop off one at a time", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const key = freshKey();
  await rateLimit(key, 2, MINUTE); // at 0s
  t.mock.timers.tick(30_000);
  await rateLimit(key, 2, MINUTE); // at 30s
  t.mock.timers.tick(31_000); // the first attempt is now out of the window
  assert.equal(await rateLimit(key, 2, MINUTE), true);
  assert.equal(await rateLimit(key, 2, MINUTE), false);
});

test("refused attempts still count, so hammering stays blocked", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const key = freshKey();
  for (let i = 0; i < 2; i++) await rateLimit(key, 2, MINUTE);
  for (let i = 0; i < 10; i++) {
    t.mock.timers.tick(10_000);
    assert.equal(await rateLimit(key, 2, MINUTE), false, `attempt at ${(i + 1) * 10}s`);
  }
});

test("different keys have separate limits", async () => {
  const a = freshKey();
  const b = freshKey();
  await rateLimit(a, 1, MINUTE);
  assert.equal(await rateLimit(a, 1, MINUTE), false);
  assert.equal(await rateLimit(b, 1, MINUTE), true);
});

test("clientIp uses the first forwarded address, then x-real-ip, then 'local'", async () => {
  assert.equal(await clientIp(), "local");
  requestHeaders.set("x-real-ip", "198.51.100.7");
  assert.equal(await clientIp(), "198.51.100.7");
  requestHeaders.set("x-forwarded-for", " 203.0.113.9 , 10.0.0.1");
  assert.equal(await clientIp(), "203.0.113.9");
});

// ── Shared counting in Upstash Redis (the network is faked) ────────────────

function fakeUpstash(t: TestContext, reply: (count: number) => Response) {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com/";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  t.after(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
  const sent: { url: string; auth: string | null; commands: string[][] }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    sent.push({ url, auth: new Headers(init.headers).get("authorization"), commands: JSON.parse(String(init.body)) });
    return reply(sent.length);
  });
  return sent;
}

const upstashCount = (count: number) =>
  Response.json([{ result: 0 }, { result: 1 }, { result: count }, { result: 1 }]);

test("with Upstash set up, attempts are counted there, in one transaction", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const sent = fakeUpstash(t, upstashCount);
  const key = freshKey();
  assert.equal(await rateLimit(key, 2, MINUTE), true);
  assert.equal(await rateLimit(key, 2, MINUTE), true);
  assert.equal(await rateLimit(key, 2, MINUTE), false, "the third attempt in the window is refused");

  assert.equal(sent[0].url, "https://redis.example.com/multi-exec");
  assert.equal(sent[0].auth, "Bearer tok");
  const [trim, add, count, expire] = sent[0].commands;
  assert.deepEqual(trim, ["ZREMRANGEBYSCORE", `rl:${key}`, "0", String(1_000_000 - MINUTE)]);
  assert.deepEqual(add.slice(0, 3), ["ZADD", `rl:${key}`, "1000000"]);
  assert.notEqual(sent[0].commands[1][3], sent[1].commands[1][3], "two attempts in the same millisecond both count");
  assert.deepEqual(count, ["ZCARD", `rl:${key}`]);
  assert.deepEqual(expire, ["PEXPIRE", `rl:${key}`, String(MINUTE)]);
});

test("if Upstash is down, this server's own count takes over instead of locking people out", async (t) => {
  fakeUpstash(t, () => new Response("unavailable", { status: 503 }));
  t.mock.method(console, "error", () => {});
  const key = freshKey();
  assert.equal(await rateLimit(key, 1, MINUTE), true);
  assert.equal(await rateLimit(key, 1, MINUTE), false, "still limited, in memory");
});
