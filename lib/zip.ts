// Builds an uncompressed .zip in memory. Photos are already compressed, so
// "store" mode loses nothing and needs no dependency.
import { crc32 } from "zlib";

// A file to store in the archive. `size` overrides data.length for the ZIP size
// fields, which lets tests build a >4 GiB entry without allocating it.
type ZipFile = { name: string; data: Buffer; size?: number };

const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffffffff;
// "Version needed to extract" (and "made by") once an entry needs ZIP64. 20 is
// plain 2.0; 45 is 4.5, the first version that reads ZIP64 extra fields.
const ZIP64_VERSION = 45;

// A 64-bit little-endian value written from a Number, without BigInt (the build
// targets ES2017). Sizes, offsets and counts are always well under 2^53.
function writeUInt64LE(buf: Buffer, value: number, at: number) {
  buf.writeUInt32LE(value >>> 0, at);
  buf.writeUInt32LE(Math.floor(value / 0x100000000), at + 4);
}

// A 32-bit size/offset field, or 0xFFFFFFFF when the value doesn't fit — the
// sentinel that sends a ZIP64-aware reader to the extra field for the real one.
function writeSize(buf: Buffer, value: number, at: number) {
  buf.writeUInt32LE(value >= UINT32_MAX ? UINT32_MAX : value, at);
}

// The ZIP64 extra field for a local header: just the two 8-byte sizes (an
// entry's offset only ever goes in its central directory record).
function localZip64Extra(size: number) {
  const extra = Buffer.alloc(20);
  extra.writeUInt16LE(0x0001, 0); // ZIP64
  extra.writeUInt16LE(16, 2); // two 8-byte values follow
  writeUInt64LE(extra, size, 4); // uncompressed
  writeUInt64LE(extra, size, 12); // compressed (stored: the same)
  return extra;
}

// The ZIP64 extra field for a central directory record, with whichever of the
// sizes and the offset don't fit in their 32-bit fields.
function centralZip64Extra(size: number, offset: number, size64: boolean, offset64: boolean) {
  const values: number[] = [];
  if (size64) values.push(size, size); // uncompressed, then compressed
  if (offset64) values.push(offset);
  const extra = Buffer.alloc(4 + values.length * 8);
  extra.writeUInt16LE(0x0001, 0);
  extra.writeUInt16LE(values.length * 8, 2);
  for (let i = 0; i < values.length; i++) writeUInt64LE(extra, values[i], 4 + i * 8);
  return extra;
}

// Yields the archive piece by piece, asking for each file only when it is
// about to be written, so only one file is ever held in memory. Sizes, offsets
// and the directory switch to ZIP64 only when they must; a small archive stays
// byte-for-byte the plain format.
export async function* zipChunks(files: Iterable<() => Promise<ZipFile | null>>): AsyncGenerator<Buffer> {
  const central: Buffer[] = [];
  let offset = 0;
  let count = 0;

  for (const next of files) {
    const file = await next();
    if (!file) continue; // a file that couldn't be read is left out
    count++;
    const name = Buffer.from(file.name, "utf8");
    const size = file.size ?? file.data.length;
    const crc = crc32(file.data);
    const size64 = size >= UINT32_MAX;
    const offset64 = offset >= UINT32_MAX;
    const entry64 = size64 || offset64;

    const extraLocal = size64 ? localZip64Extra(size) : Buffer.alloc(0);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(entry64 ? ZIP64_VERSION : 20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(0, 10); // time/date
    local.writeUInt32LE(crc, 14);
    writeSize(local, size, 18); // compressed size
    writeSize(local, size, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extraLocal.length, 28);
    yield local;
    yield name;
    if (extraLocal.length) yield extraLocal;
    yield file.data;

    const extraCentral = entry64 ? centralZip64Extra(size, offset, size64, offset64) : Buffer.alloc(0);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(entry64 ? ZIP64_VERSION : 20, 4); // version made by
    entry.writeUInt16LE(entry64 ? ZIP64_VERSION : 20, 6); // version needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt32LE(0, 12);
    entry.writeUInt32LE(crc, 16);
    writeSize(entry, size, 20); // compressed size
    writeSize(entry, size, 24); // uncompressed size
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(extraCentral.length, 30);
    entry.writeUInt16LE(0, 32); // comment length
    entry.writeUInt16LE(0, 34); // disk number start
    entry.writeUInt16LE(0, 36); // internal attrs
    entry.writeUInt32LE(0, 38); // external attrs
    entry.writeUInt32LE(offset64 ? UINT32_MAX : offset, 42);
    central.push(entry);
    central.push(name);
    if (extraCentral.length) central.push(extraCentral);
    offset += local.length + extraLocal.length + name.length + file.data.length;
  }

  const centralSize = central.reduce((n, b) => n + b.length, 0);
  // The plain EOCD holds the directory only up to these limits; past them a
  // ZIP64 EOCD (and locator) must carry the real values.
  const zip64Directory = count >= UINT16_MAX || centralSize >= UINT32_MAX || offset >= UINT32_MAX;

  yield* central;

  if (zip64Directory) {
    const zip64End = Buffer.alloc(56);
    zip64End.writeUInt32LE(0x06064b50, 0);
    writeUInt64LE(zip64End, 44, 4); // size of this record past the first 12 bytes
    zip64End.writeUInt16LE(ZIP64_VERSION, 12); // version made by
    zip64End.writeUInt16LE(ZIP64_VERSION, 14); // version needed
    zip64End.writeUInt32LE(0, 16); // disk number
    zip64End.writeUInt32LE(0, 20); // disk with the central directory
    writeUInt64LE(zip64End, count, 24); // entries on this disk
    writeUInt64LE(zip64End, count, 32); // total entries
    writeUInt64LE(zip64End, centralSize, 40);
    writeUInt64LE(zip64End, offset, 48);

    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    locator.writeUInt32LE(0, 4); // disk with the ZIP64 EOCD
    writeUInt64LE(locator, offset + centralSize, 8); // where the ZIP64 EOCD starts
    locator.writeUInt32LE(1, 16); // total disks

    yield zip64End;
    yield locator;

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(count >= UINT16_MAX ? UINT16_MAX : count, 8);
    end.writeUInt16LE(count >= UINT16_MAX ? UINT16_MAX : count, 10);
    end.writeUInt32LE(centralSize >= UINT32_MAX ? UINT32_MAX : centralSize, 12);
    end.writeUInt32LE(offset >= UINT32_MAX ? UINT32_MAX : offset, 16);
    yield end;
  } else {
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(count, 8);
    end.writeUInt16LE(count, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    yield end;
  }
}

// The archive as a download that streams while it is built.
export function zipResponse(files: Iterable<() => Promise<ZipFile | null>>, filename: string) {
  const chunks = zipChunks(files);
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await chunks.next();
      if (done) controller.close();
      else controller.enqueue(new Uint8Array(value));
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// The whole archive at once, for small sets of files.
export async function createZip(files: ZipFile[]) {
  const chunks: Buffer[] = [];
  for await (const chunk of zipChunks(files.map((file) => async () => file))) chunks.push(chunk);
  return Buffer.concat(chunks);
}
