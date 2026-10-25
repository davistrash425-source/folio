import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createZip, zipChunks } from "../lib/zip.ts";

test("createZip writes an archive other tools can read", async () => {
  const zip = await createZip([
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

test("zipChunks asks for one file at a time and leaves out files that can't be read", async () => {
  let open = 0;
  let mostOpen = 0;
  const file = (name: string, data: Buffer | null) => async () => {
    mostOpen = Math.max(mostOpen, ++open);
    open--;
    return data && { name, data };
  };
  const chunks: Buffer[] = [];
  for await (const chunk of zipChunks([file("a.txt", Buffer.from("a")), file("missing.jpg", null), file("b.txt", Buffer.from("b"))])) {
    chunks.push(chunk);
  }
  const zip = Buffer.concat(chunks);
  assert.equal(zip.readUInt16LE(zip.length - 12), 2, "two entries in the archive");
  assert.equal(zip.includes(Buffer.from("missing.jpg")), false);
  assert.equal(mostOpen, 1);
});
