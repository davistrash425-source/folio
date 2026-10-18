// Loaded before every test file (see "test" in package.json).
import { existsSync, mkdtempSync, rmSync } from "fs";
import { registerHooks } from "module";
import { tmpdir } from "os";
import path from "path";
import { pathToFileURL } from "url";

// Each test process gets its own empty data folder so tests never read or
// change data/.
const dir = mkdtempSync(path.join(tmpdir(), "folio-test-"));
process.env.FOLIO_DATA_DIR = dir;
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));

// Lets plain Node load lib/ the way Next does: "next/cache" (which only works
// inside Next) becomes a stub, and "./db" finds "./db.ts".
const nextCacheStub = pathToFileURL(path.resolve("tests/stubs/next-cache.ts")).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/cache") return { url: nextCacheStub, shortCircuit: true };
    if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL) {
      const ts = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(ts)) return { url: ts.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
