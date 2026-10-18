// Checks a running server. Start it first (npm run dev), then:
//   npm run test:smoke            (or BASE_URL=https://yourapp.com npm run test:smoke)
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "http";

const base = new URL(process.env.BASE_URL ?? "http://localhost:3000");

// Sends a custom Host header so subdomains work without DNS.
function get(pathname: string, host = base.host, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.get(
      { hostname: base.hostname, port: base.port, path: pathname, headers: { host, ...headers } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("error", reject);
  });
}

for (const page of ["/", "/login", "/signup", "/forgot-password"]) {
  test(`${page} loads`, async () => {
    assert.equal((await get(page)).status, 200);
  });
}

test("dashboard sends signed-out visitors to log in", async () => {
  const res = await get("/dashboard");
  // Either a redirect status or a streamed redirect to /login.
  assert.ok(res.status === 307 || res.body.includes("/login"), `got ${res.status}`);
});

test("unknown subdomain shows the not-found page", async () => {
  const res = await get("/", `no-such-site-${Date.now()}.${base.host}`);
  assert.match(res.body, /doesn.t exist yet/);
});

test("original uploads are never served, however the name is written", async () => {
  for (const file of ["abc.orig.jpg", "abc.ORIG.jpg", "abc.Orig.png"]) {
    assert.equal((await get(`/api/uploads/someone/${file}`)).status, 404, file);
  }
});

test("the account export refuses visitors who aren't signed in", async () => {
  const res = await get("/api/export");
  assert.equal(res.status, 401);
  assert.equal(res.body, "Not signed in");
});

test("the account export refuses a forged login cookie", async () => {
  const res = await get("/api/export", base.host, { cookie: "session=someone.99999999999999.forged-signature" });
  assert.equal(res.status, 401);
});

test("photo addresses can't be bent to reach other files", async () => {
  for (const pathname of [
    "/api/uploads/%2e%2e/photo.jpg",
    "/api/uploads/%2e%2e%2f%2e%2e/photo.jpg",
    "/api/uploads/someone/%2e%2e%2fphoto.jpg",
    "/api/uploads/someone/..%5cphoto.jpg",
    "/api/uploads/someone/photo.constructor",
    "/api/uploads/someone/photo.jpg",
  ]) {
    assert.equal((await get(pathname)).status, 404, pathname);
  }
});
