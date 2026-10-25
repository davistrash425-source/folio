// What visitors see on a photographer's address when there's no page to
// show, the contact email they see (or don't), and photo inquiries.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { saveProfile, sendInquiry } from "../app/actions/site.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { loadSite, siteData, siteNotice } from "../lib/public-site.ts";
import { contactHref } from "../lib/site-data.ts";
import { addPhoto, captureEmails, formOf, fromIp, makeUser, resetRequest, signInAs, signOut } from "./helpers.ts";

beforeEach(resetRequest);

let visitor = 0;
const newVisitor = () => fromIp(`203.0.113.${++visitor}`);
const inquiry = (extra: Record<string, string> = {}) =>
  formOf({ name: "Sam Client", email: "sam@example.com", message: "Is this print for sale?", ...extra });

test("an address nobody has is missing", async () => {
  assert.deepEqual(await siteNotice("nobody-has-this"), { status: "missing" });
});

test("a live site's pages show, and an unknown page on it says so in the site's colors", async () => {
  const alice = await makeUser("Alice");
  assert.equal(await siteNotice(alice.subdomain, ""), null);
  const notice = await siteNotice(alice.subdomain, "no-such-page");
  assert.equal(notice?.status, "no-page");
  assert.ok(notice?.status === "no-page" && notice.look.design.colors.background);
  // A not-found page isn't told the path; a live site means the page was missing.
  assert.equal((await siteNotice(alice.subdomain))?.status, "no-page");
});

test("a draft site and one with an unconfirmed email are offline, not missing", async () => {
  const draft = await makeUser("Draft", { published: false });
  const unconfirmed = await makeUser("Unconfirmed", { verified: false });
  for (const user of [draft, unconfirmed]) {
    const notice = await siteNotice(user.subdomain, "");
    assert.equal(notice?.status, "offline", user.subdomain);
    assert.ok(notice?.status === "offline" && notice.look, "drawn in the photographer's colors");
    assert.equal(await loadSite(user.subdomain), null, "and nothing of the site itself");
  }
});

test("a suspended site is offline without any of its look", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => (u.suspended = { at: new Date().toISOString(), reason: "test" }));
  assert.deepEqual(await siteNotice(alice.subdomain, ""), { status: "offline" });
});

test("the contact email stays off a site until the photographer shows it", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => (u.profile.contactEmail = "hello@alice-photo.example"));
  const hidden = siteData((await findUserById(alice.id))!)!;
  assert.equal(hidden.profile.contactEmail, "");
  assert.ok(!JSON.stringify(hidden).includes("hello@alice-photo.example"));
  assert.equal(siteData((await findUserById(alice.id))!, { preview: true })!.profile.contactEmail, "", "the preview matches");

  await signInAs(alice);
  assert.deepEqual(await saveProfile({}, formOf({ name: "Alice", contactEmail: "hello@alice-photo.example", showEmail: "on" })), { ok: "Saved." });
  assert.equal(siteData((await findUserById(alice.id))!)!.profile.contactEmail, "hello@alice-photo.example");

  // Saving without the box ticked hides it again.
  await saveProfile({}, formOf({ name: "Alice", contactEmail: "hello@alice-photo.example" }));
  assert.equal((await findUserById(alice.id))!.profile.showEmail, false);
  assert.equal(siteData((await findUserById(alice.id))!)!.profile.contactEmail, "");
});

test("showing an empty contact email is refused", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  assert.match((await saveProfile({}, formOf({ name: "Alice", contactEmail: "", showEmail: "on" }))).error!, /Add the email/);
  assert.notEqual((await findUserById(alice.id))!.profile.showEmail, true);
});

test("an inquiry about one of the site's photos remembers the photo and names it in the email", async (t) => {
  const emails = captureEmails(t);
  const alice = await makeUser("Alice");
  const { photo } = await addPhoto(alice.id, { description: "Harbour at dawn" });
  signOut();
  newVisitor();
  assert.ok((await sendInquiry(alice.subdomain, {}, inquiry({ photoId: photo.id }))).ok);
  const [sent] = (await findUserById(alice.id))!.inquiries!;
  assert.equal(sent.photoId, photo.id);
  assert.match(emails.join("\n"), /About the photo: Harbour at dawn/);
});

test("an inquiry naming someone else's photo, a taken-down photo or nonsense is sent without it", async (t) => {
  captureEmails(t);
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  const { photo: bobs } = await addPhoto(bob.id);
  const { photo: removed } = await addPhoto(alice.id, { removed: { at: new Date().toISOString(), reportId: "r" } });
  signOut();
  for (const photoId of [bobs.id, removed.id, "x".repeat(500), "../../etc"]) {
    newVisitor();
    assert.ok((await sendInquiry(alice.subdomain, {}, inquiry({ photoId }))).ok, photoId);
  }
  const inbox = (await findUserById(alice.id))!.inquiries!;
  assert.equal(inbox.length, 4);
  assert.ok(inbox.every((q) => q.photoId === undefined));
});

test("the lightbox's Inquire button points at the first page with a contact form, if any", async () => {
  const alice = await makeUser("Alice");
  const site = siteData((await findUserById(alice.id))!)!;
  const withContact = site.design.pages.find((p) => p.sections.some((s) => s.type === "contact" && s.visible));
  assert.equal(contactHref(site), withContact ? `/${withContact.slug}#inquire` : null);

  const noContact = structuredClone(site.design);
  for (const page of noContact.pages) page.sections = page.sections.filter((s) => s.type !== "contact");
  assert.equal(contactHref({ ...site, design: noContact }), null);
  assert.match(contactHref({ ...site, preview: true })!, /^\/site-preview/);
});
