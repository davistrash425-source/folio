// The one-time copy from the old JSON database into Postgres
// (npm run import-json). It runs as its own process, on its own data folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { PGlite } from "@electric-sql/pglite";

const later = new Date(Date.now() + 60 * 60_000).toISOString();
const earlier = new Date(Date.now() - 60_000).toISOString();
const oldUser = (id: string, email: string, subdomain: string) => ({
  id,
  email,
  subdomain,
  passwordHash: "salt:hash",
  profile: { name: id, bio: "kept", contactEmail: email, phone: "", location: "", social: {} },
  photos: [{ id: `${id}-photo`, file: "x.orig.jpg", createdAt: "" }],
});

function runImport(dir: string) {
  return execFileSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/import-json.ts"],
    { env: { ...process.env, FOLIO_DATA_DIR: dir, DATABASE_URL: "" }, encoding: "utf8" },
  );
}

test("old accounts and unexpired links are copied over, and running it again changes nothing", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "folio-import-"));
  const users = [oldUser("a", "Alice@Example.com", "Alice"), oldUser("b", "bob@example.com", "bob")];
  writeFileSync(
    path.join(dir, "db.json"),
    JSON.stringify({
      users,
      tokens: [
        { hash: "live", userId: "a", kind: "reset", expiresAt: later },
        { hash: "dead", userId: "b", kind: "verify", expiresAt: earlier },
      ],
    }),
  );

  assert.match(runImport(dir), /Imported 2 of 2 accounts and 1 unexpired links/);
  assert.match(runImport(dir), /Imported 0 of 2 accounts/, "second run skips what's there");
  assert.equal(JSON.parse(readFileSync(path.join(dir, "db.json"), "utf8")).users.length, 2, "db.json untouched");

  const db = await PGlite.create(path.join(dir, "pg"));
  try {
    const { rows } = await db.query<{ email: string; subdomain: string; data: { profile: { bio: string } } }>(
      "select email, subdomain, data from users order by id",
    );
    assert.deepEqual(
      rows.map((r) => [r.email, r.subdomain, r.data.profile.bio]),
      [
        ["alice@example.com", "alice", "kept"],
        ["bob@example.com", "bob", "kept"],
      ],
    );
    const tokens = await db.query<{ hash: string }>("select hash from tokens");
    assert.deepEqual(tokens.rows.map((t) => t.hash), ["live"]);
  } finally {
    await db.close();
  }
});

test("with no old database there's nothing to do", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "folio-import-"));
  assert.match(runImport(dir), /Nothing to import/);
});
