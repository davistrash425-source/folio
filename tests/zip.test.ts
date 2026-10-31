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

test("a >4 GiB entry gets ZIP64 sizes that other tools read, without allocating 4 GiB", async () => {
  const big = 4 * 1024 * 1024 * 1024 + 123;
  const zip = await createZip([{ name: "big.bin", data: Buffer.from("x"), size: big }]);
  const dir = mkdtempSync(path.join(tmpdir(), "folio-zip64-"));
  const file = path.join(dir, "test.zip");
  writeFileSync(file, zip);
  const script =
    "import sys,zipfile\n" +
    "z=zipfile.ZipFile(sys.argv[1])\n" +
    "i=z.getinfo('big.bin')\n" +
    "print(i.file_size)\n" +
    "print(i.compress_size)\n";
  const out = execFileSync("python", ["-I", "-c", script, file]).toString();
  const [fileSize, compressSize] = out.trim().split("\n").map(Number);
  assert.equal(fileSize, big);
  assert.equal(compressSize, big, "stored, so compressed equals uncompressed");
});

test("an archive past 65,535 files gets a ZIP64 directory", async () => {
  const files = Array.from({ length: 0x10000 }, (_, i) => ({ name: `f${i}`, data: Buffer.from([i & 0xff]) }));
  const zip = await createZip(files);
  const dir = mkdtempSync(path.join(tmpdir(), "folio-zip64-count-"));
  const file = path.join(dir, "test.zip");
  writeFileSync(file, zip);
  const script = "import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nprint(len(z.infolist()))\n";
  const out = execFileSync("python", ["-I", "-c", script, file]).toString();
  assert.equal(Number(out.trim()), 0x10000);
});

test("small archives stay in the plain 32-bit format", async () => {
  const zip = await createZip([{ name: "a.txt", data: Buffer.from("hello") }]);
  assert.equal(zip.includes(Buffer.from([0x50, 0x4b, 0x06, 0x06])), false, "no ZIP64 EOCD");
  assert.equal(zip.includes(Buffer.from([0x50, 0x4b, 0x06, 0x07])), false, "no ZIP64 locator");
});
