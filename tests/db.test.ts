import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";
import path from "path";
import { DATA_DIR, addToken, takeToken } from "../lib/db.ts";

test("tests use their own data folder, not data/", () => {
  assert.equal(DATA_DIR, process.env.FOLIO_DATA_DIR);
  assert.notEqual(DATA_DIR, path.resolve("data"));
});

test("a token can be taken once, and expired tokens are refused", async () => {
  const later = new Date(Date.now() + 60_000).toISOString();
  await addToken({ hash: "fresh", userId: "u1", kind: "reset", expiresAt: later });
  assert.ok(existsSync(path.join(DATA_DIR, "db.json")));

  assert.equal((await takeToken("fresh", "reset"))?.userId, "u1");
  assert.equal(await takeToken("fresh", "reset"), null);
  assert.equal(await takeToken("fresh", "verify"), null);

  const earlier = new Date(Date.now() - 1).toISOString();
  await addToken({ hash: "stale", userId: "u2", kind: "verify", expiresAt: earlier });
  assert.equal(await takeToken("stale", "verify"), null);
});
