import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createZip } from "../lib/zip.ts";

test("createZip writes an archive other tools can read", () => {
  const zip = createZip([
    { name: "account.json", data: Buffer.from('{"ok":true}') },
    { name: "photos/001.jpg", data: Buffer.alloc(1000, 7) },
  ]);
  const dir = mkdtempSync(path.join(tmpdir(), "folio-zip-"));
  const file = path.join(dir, "test.zip");
  writeFileSync(file, zip);
  // Python's zipfile checks the CRCs and the central directory.
  const script =
    "import sys,zipfile\n" +
    "z=zipfile.ZipFile(sys.argv[1])\n" +
    "assert z.testzip() is None\n" +
    "print(','.join(z.namelist()))\n" +
    "print(z.read('account.json').decode())";
  const out = execFileSync("python", ["-I", "-c", script, file]).toString();
  assert.match(out, /account\.json,photos\/001\.jpg/);
  assert.match(out, /\{"ok":true\}/);
});
