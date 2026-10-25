// What search engines see: robots.txt and the sitemap answer for whichever
// host asked, the app itself or one photographer's site.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";
import { updateUser } from "../lib/db.ts";
import { siteSubdomain } from "../lib/site.ts";
import { addAlbum, addPhoto, makeUser, resetRequest } from "./helpers.ts";
import { requestHeaders } from "./stubs/next-headers.ts";

beforeEach(resetRequest);
const visit = (host: string) => requestHeaders.set("host", host);

test("siteSubdomain finds the site a host points at, and nothing else", () => {
  assert.equal(siteSubdomain("alice.localhost:3000"), "alice");
  assert.equal(siteSubdomain("Alice.LOCALHOST"), "alice");
  for (const host of ["localhost:3000", "www.localhost:3000", "a.b.localhost:3000", "alice.example.com", ""]) {
    assert.equal(siteSubdomain(host), null, host);
  }
});

test("the app's robots.txt keeps private and duplicate addresses out of search", async () => {
  visit("localhost:3000");
  const r = await robots();
  const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
  for (const path of ["/dashboard", "/api/", "/site-preview", "/sites/"]) assert.ok([rules.disallow].flat().includes(path), path);
  assert.equal(r.sitemap, "http://localhost:3000/sitemap.xml");
});

test("a site's robots.txt allows everything except client galleries and points at its own sitemap", async () => {
  visit("alice.localhost:3000");
  const r = await robots();
  const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
  assert.equal(rules.disallow, "/g/");
  assert.equal(r.sitemap, "http://alice.localhost:3000/sitemap.xml");
});

test("a site's sitemap lists its pages and visible albums, at its own address", async () => {
  const alice = await makeUser("Alice");
  const { photo } = await addPhoto(alice.id);
  await addAlbum(alice.id, "Weddings", [photo.id]);
  await addAlbum(alice.id, "About", [photo.id]); // hidden behind the About page
  await addAlbum(alice.id, "Empty"); // nothing to show
  visit(`${alice.subdomain}.localhost:3000`);
  const urls = (await sitemap()).map((e) => e.url).sort();
  const base = `http://${alice.subdomain}.localhost:3000`;
  assert.deepEqual(urls, [base, `${base}/about`, `${base}/weddings`].sort());
});

test("offline and missing sites have empty sitemaps", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => (u.published = false));
  visit(`${alice.subdomain}.localhost:3000`);
  assert.deepEqual(await sitemap(), []);
  visit("nobody-here.localhost:3000");
  assert.deepEqual(await sitemap(), []);
});

test("the app's sitemap lists its public pages", async () => {
  visit("localhost:3000");
  assert.deepEqual(
    (await sitemap()).map((e) => e.url),
    ["http://localhost:3000/", "http://localhost:3000/signup", "http://localhost:3000/login"],
  );
});
