// Builds an uncompressed .zip in memory. Photos are already compressed, so
// "store" mode loses nothing and needs no dependency.
import { crc32 } from "zlib";

type ZipFile = { name: string; data: Buffer };

// Yields the archive piece by piece, asking for each file only when it is
// about to be written, so only one file is ever held in memory. (No ZIP64:
// the archive can't pass 4 GB or 65,535 files.)
export async function* zipChunks(files: Iterable<() => Promise<ZipFile | null>>): AsyncGenerator<Buffer> {
  const central: Buffer[] = [];
  let offset = 0;
  let count = 0;

  for (const next of files) {
    const file = await next();
    if (!file) continue; // a file that couldn't be read is left out
    count++;
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(0, 10); // time/date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    yield local;
    yield name;
    yield file.data;

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt32LE(0, 12);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(file.data.length, 20);
    entry.writeUInt32LE(file.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + file.data.length;
  }

  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  yield* central;
  yield end;
}

// The whole archive at once, for small sets of files.
export async function createZip(files: ZipFile[]) {
  const chunks: Buffer[] = [];
  for await (const chunk of zipChunks(files.map((file) => async () => file))) chunks.push(chunk);
  return Buffer.concat(chunks);
}
