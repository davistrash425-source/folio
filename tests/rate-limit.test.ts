import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { clientIp, rateLimit } from "../lib/rate-limit.ts";
import { requestHeaders } from "./stubs/next-headers.ts";

const MINUTE = 60 * 1000;
let n = 0;
const freshKey = () => `test-${++n}`;

beforeEach(() => {
  for (const name of [...requestHeaders.keys()]) requestHeaders.delete(name);
});

test("allows `limit` attempts, then refuses", () => {
  const key = freshKey();
  for (let i = 1; i <= 5; i++) assert.equal(rateLimit(key, 5, MINUTE), true, `attempt ${i}`);
  assert.equal(rateLimit(key, 5, MINUTE), false);
});

test("attempts are allowed again once the window has passed", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const key = freshKey();
  for (let i = 0; i < 3; i++) rateLimit(key, 3, MINUTE);
  assert.equal(rateLimit(key, 3, MINUTE), false);
  t.mock.timers.tick(MINUTE + 1);
  assert.equal(rateLimit(key, 3, MINUTE), true);
});

test("the window slides: old attempts drop off one at a time", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const key = freshKey();
  rateLimit(key, 2, MINUTE); // at 0s
  t.mock.timers.tick(30_000);
  rateLimit(key, 2, MINUTE); // at 30s
  t.mock.timers.tick(31_000); // the first attempt is now out of the window
  assert.equal(rateLimit(key, 2, MINUTE), true);
  assert.equal(rateLimit(key, 2, MINUTE), false);
});

test("refused attempts still count, so hammering stays blocked", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const key = freshKey();
  for (let i = 0; i < 2; i++) rateLimit(key, 2, MINUTE);
  for (let i = 0; i < 10; i++) {
    t.mock.timers.tick(10_000);
    assert.equal(rateLimit(key, 2, MINUTE), false, `attempt at ${(i + 1) * 10}s`);
  }
});

test("different keys have separate limits", () => {
  const a = freshKey();
  const b = freshKey();
  rateLimit(a, 1, MINUTE);
  assert.equal(rateLimit(a, 1, MINUTE), false);
  assert.equal(rateLimit(b, 1, MINUTE), true);
});

test("clientIp uses the first forwarded address, then x-real-ip, then 'local'", async () => {
  assert.equal(await clientIp(), "local");
  requestHeaders.set("x-real-ip", "198.51.100.7");
  assert.equal(await clientIp(), "198.51.100.7");
  requestHeaders.set("x-forwarded-for", " 203.0.113.9 , 10.0.0.1");
  assert.equal(await clientIp(), "203.0.113.9");
});
