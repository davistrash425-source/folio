import { defineConfig } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

// Browser tests: sign-up through publishing, in a real browser against the
// dev server with a throwaway data folder. Run with `npm run test:e2e`.
const port = 3100;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "folio-e2e-"));
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}/login`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: { FOLIO_DATA_DIR: dataDir, NEXT_PUBLIC_ROOT_DOMAIN: `localhost:${port}` },
  },
});
