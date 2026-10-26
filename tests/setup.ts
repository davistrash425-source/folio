// Loaded before every test file (see "test" in package.json).
import { existsSync, mkdtempSync, rmSync } from "fs";
import { registerHooks } from "module";
import { tmpdir } from "os";
import path from "path";
import { pathToFileURL } from "url";

// Each test process gets its own empty data folder so tests never read or
// change data/.
// (scripts/seed-examples.ts borrows this file for the stubs below and sets
// FOLIO_KEEP_DATA_DIR so it writes to the real folder instead.)
if (!process.env.FOLIO_KEEP_DATA_DIR) {
  const dir = mkdtempSync(path.join(tmpdir(), "folio-test-"));
  process.env.FOLIO_DATA_DIR = dir;
  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
}

// Lets plain Node load lib/ the way Next does: Next's own modules (which only
// work inside Next) become the stubs in tests/stubs/, "@/lib/db" means
// "<project>/lib/db.ts" as in tsconfig, and "./db" finds "./db.ts".
const stubs: Record<string, string> = {
  "next/cache": "next-cache.ts",
  "next/headers": "next-headers.ts",
  "next/navigation": "next-navigation.ts",
  "next/server": "next-server.ts",
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (stubs[specifier]) {
      const url = pathToFileURL(path.resolve("tests/stubs", stubs[specifier])).href;
      return { url, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const base = pathToFileURL(path.resolve(specifier.slice(2))).href;
      const found = [base, `${base}.ts`, `${base}/index.ts`].find((c) => c.endsWith(".ts") && existsSync(new URL(c)));
      if (found) return { url: found, shortCircuit: true };
    }
    if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL) {
      const ts = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(ts)) return { url: ts.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
