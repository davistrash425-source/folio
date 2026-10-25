// Folio's admin tools (app/actions/admin.ts): taking photos down after a
// complaint, putting them back, suspending sites and freezing accounts. Only
// the accounts in ADMIN_EMAILS may use them.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import * as adminActions from "../app/actions/admin.ts";
import { POST as startPhotoUpload } from "../app/api/photos/start/route.ts";
import { deleteAccount } from "../app/actions/auth.ts";
import { deletePhoto, sendInquiry, uploadPhotos } from "../app/actions/site.ts";
import { isAdmin } from "../lib/admin.ts";
import { addReport, adminActionsFor, findReport, findUserById, photosWithoutRights, updateUser, type Photo } from "../lib/db.ts";
import { siteData } from "../lib/public-site.ts";
import type { CopyrightNotice } from "../lib/reports.ts";
import { variantName } from "../lib/images.ts";
import { storage } from "../lib/uploads.ts";
import sharp from "sharp";
import {
  addAlbum,
  addPhoto,
  captureEmails,
  databaseText,
  filesOf,
  formOf,
  formWith,
  fromIp,
  jpegFile,
  makeUser,
  postJson,
  redirectedTo,
  resetRequest,
  signInAs,
  signOut,
} from "./helpers.ts";
import { NotFoundError } from "./stubs/next-navigation.ts";

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_VIEWER_EMAILS;
  delete process.env.REPORTS_EMAIL;
});

// A form with repeated fields, like the photo checkboxes.
function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
}

const notice: CopyrightNotice = {
  name: "Jane Doe",
  organization: "",
  role: "owner",
  ownerName: "",
  address: "1 Main St, Springfield",
  phone: "555-0100",
  email: "jane@example.com",
  work: "My photo of the Lisbon tram",
  urls: ["https://alice.example/"],
  signature: "Jane Doe",
};
const copyrightNotice = (subdomain: string) =>
  addReport({ subdomain, reason: "copyright", details: "See notice", reporterEmail: notice.email, notice });

// An admin signed in, and Alice with two photos in an album.
async function world() {
  const admin = await makeUser("Admin");
  process.env.ADMIN_EMAILS = ` someone@else.example , ${admin.email.toUpperCase()} `;
  const alice = await makeUser("Alice");
  const one = (await addPhoto(alice.id, { description: "one" })).photo;
  const two = (await addPhoto(alice.id, { description: "two" })).photo;
  await addAlbum(alice.id, "Weddings", [one.id, two.id]);
  await signInAs(admin);
  return { admin, alice, one, two };
}

const doneMessage = (url: string | null) => decodeURIComponent(url?.split("?done=")[1] ?? "");
const webCopies = (photo: Photo) => (photo.variants ?? []).map((w) => variantName(photo.id, w));

test("ADMIN_EMAILS lists admins by login email, in any case", () => {
  process.env.ADMIN_EMAILS = "a@example.com, B@Example.com";
  assert.ok(isAdmin({ email: "b@example.com" }));
  assert.ok(isAdmin({ email: "A@EXAMPLE.COM" }));
  assert.ok(!isAdmin({ email: "c@example.com" }));
  delete process.env.ADMIN_EMAILS;
  assert.ok(!isAdmin({ email: "a@example.com" }), "nobody is an admin when it's unset");
});

test("only admins can use the admin actions: others are sent to log in or told it doesn't exist", async () => {
  const { alice, one } = await world();
  const reportId = await copyrightNotice(alice.subdomain);
  const calls: Record<string, () => Promise<unknown>> = {
    takeDownPhotos: () => adminActions.takeDownPhotos(form({ userId: alice.id, photo: one.id, reportId, notify: "yes" })),
    restorePhotos: () => adminActions.restorePhotos(form({ userId: alice.id, photo: one.id })),
    suspendSite: () => adminActions.suspendSite(form({ userId: alice.id, reason: "hacked" })),
    unsuspendSite: () => adminActions.unsuspendSite(form({ userId: alice.id })),
    placeLegalHold: () => adminActions.placeLegalHold(form({ userId: alice.id })),
    releaseLegalHold: () => adminActions.releaseLegalHold(form({ userId: alice.id })),
    closeReport: () => adminActions.closeReport(form({ reportId, note: "hacked" })),
    reopenReport: () => adminActions.reopenReport(form({ reportId })),
    setPlan: () => adminActions.setPlan(form({ userId: alice.id, plan: "pro" })),
    addRightsToOlderPhotos: () => adminActions.addRightsToOlderPhotos(),
    addAdminNote: () => adminActions.addAdminNote(form({ userId: alice.id, text: "hacked" })),
    signOutAccountEverywhere: () => adminActions.signOutAccountEverywhere(form({ userId: alice.id })),
    verifyAccountEmail: () => adminActions.verifyAccountEmail(form({ userId: alice.id })),
    resendAccountVerification: () => adminActions.resendAccountVerification(form({ userId: alice.id })),
    deleteAccountAsAdmin: () => adminActions.deleteAccountAsAdmin(form({ userId: alice.id, confirm: alice.subdomain })),
    startImpersonation: () => adminActions.startImpersonation(form({ userId: alice.id, reason: "just looking around" })),
    stopImpersonation: () => adminActions.stopImpersonation(),
  };
  assert.deepEqual(Object.keys(adminActions).sort(), Object.keys(calls).sort(), "every admin action is checked here");

  const before = await databaseText();
  const files = filesOf(alice.id);
  for (const [name, call] of Object.entries(calls)) {
    signOut();
    assert.equal(await redirectedTo(call()), "/login", `${name}, signed out`);
    await signInAs(alice); // signed in, but not an admin
    await assert.rejects(call(), NotFoundError, `${name}, signed in as a photographer`);
  }
  assert.equal(await databaseText(), before);
  assert.deepEqual(filesOf(alice.id), files);
  assert.equal((await findReport(reportId))?.status, "open");
  assert.deepEqual(await adminActionsFor(alice.id), []);
});

test("taking photos down after a copyright notice hides them, deletes their web copies, records a strike and emails the notice", async (t) => {
  const { admin, alice, one, two } = await world();
  const reportId = await copyrightNotice(alice.subdomain);
  const emails = captureEmails(t);
  process.env.REPORTS_EMAIL = "reports@folio.example";

  const to = await redirectedTo(adminActions.takeDownPhotos(form({ userId: alice.id, photo: one.id, reportId, notify: "yes" })));
  assert.equal(to?.split("?")[0], `/admin/sites/${alice.subdomain}`);
  assert.equal(doneMessage(to), "Took down 1 photo. Strike 1 of 3. They were emailed.");

  const after = (await findUserById(alice.id))!;
  assert.equal(after.photos.find((p) => p.id === one.id)?.removed?.reportId, reportId);
  assert.deepEqual(after.strikes?.map((s) => s.reportId), [reportId]);
  const site = siteData(after)!;
  assert.deepEqual(site.photos.map((p) => p.id), [two.id], "gone from the site");
  assert.deepEqual(site.albums[0].photoIds, [two.id], "and from its album");

  const files = filesOf(alice.id);
  assert.ok(files.includes(one.file), "the private original is kept");
  for (const copy of webCopies(one)) assert.ok(!files.includes(copy), `${copy} deleted`);
  for (const copy of webCopies(two)) assert.ok(files.includes(copy), `${copy} untouched`);

  const report = (await findReport(reportId))!;
  assert.equal(report.status, "closed");
  assert.equal(report.note, "Took down 1 photo.");

  assert.equal(emails.length, 1);
  const [email] = emails;
  assert.match(email, new RegExp(`To: ${alice.email}\\nReply-To: reports@folio\\.example\\nSubject: .*copyright notice`));
  assert.match(email, /From: Jane Doe/);
  assert.match(email, /My photo of the Lisbon tram/);
  assert.match(email, /under penalty of perjury/);
  assert.doesNotMatch(email, /1 Main St|555-0100/, "the sender's address and phone aren't shared");

  const [logged] = await adminActionsFor(alice.id);
  assert.equal(logged.adminEmail, admin.email);
  assert.equal(logged.reportId, reportId);
  assert.equal(logged.detail, "Took down 1 photo. Strike 1.");
});

test("putting photos back after a counter-notice remakes their web copies, shows them again and removes the strike", async (t) => {
  const { alice, one, two } = await world();
  const reportId = await copyrightNotice(alice.subdomain);
  await redirectedTo(adminActions.takeDownPhotos(form({ userId: alice.id, photo: [one.id, two.id], reportId })));
  const emails = captureEmails(t);

  const to = await redirectedTo(
    adminActions.restorePhotos(form({ userId: alice.id, photo: [one.id], disputed: "yes", notify: "yes" })),
  );
  assert.equal(doneMessage(to), "Put back 1 photo. They were emailed.");
  const after = (await findUserById(alice.id))!;
  assert.equal(after.photos.find((p) => p.id === one.id)?.removed, undefined);
  assert.ok(after.photos.find((p) => p.id === two.id)?.removed, "the other photo stays down");
  assert.deepEqual(after.strikes, []);
  assert.deepEqual(siteData(after)!.photos.map((p) => p.id), [one.id]);
  for (const copy of webCopies(one)) assert.ok(filesOf(alice.id).includes(copy), `${copy} made again`);
  assert.match(emails[0], /Subject: Your photos are back/);
});

test("a notice is one strike however many photos it covers; takedowns without a report add none; the third strike says to suspend", async (t) => {
  const { alice, one, two } = await world();
  const three = (await addPhoto(alice.id)).photo;
  const four = (await addPhoto(alice.id)).photo;
  const five = (await addPhoto(alice.id)).photo;
  const first = await copyrightNotice(alice.subdomain);
  const emails = captureEmails(t);

  await redirectedTo(adminActions.takeDownPhotos(form({ userId: alice.id, photo: one.id, reportId: first })));
  const again = await redirectedTo(adminActions.takeDownPhotos(form({ userId: alice.id, photo: two.id, reportId: first })));
  assert.equal(doneMessage(again), "Took down 1 photo.");
  const ruleBreak = await redirectedTo(
    adminActions.takeDownPhotos(form({ userId: alice.id, photo: three.id, note: "it shows violence", notify: "yes" })),
  );
  assert.equal(doneMessage(ruleBreak), "Took down 1 photo. They were emailed.");
  assert.match(emails.at(-1)!, /because it shows violence/);
  assert.doesNotMatch(emails.at(-1)!, /counter-notice/);
  assert.equal((await findUserById(alice.id))!.strikes?.length, 1);

  await redirectedTo(
    adminActions.takeDownPhotos(form({ userId: alice.id, photo: four.id, reportId: await copyrightNotice(alice.subdomain) })),
  );
  const third = await redirectedTo(
    adminActions.takeDownPhotos(form({ userId: alice.id, photo: five.id, reportId: await copyrightNotice(alice.subdomain) })),
  );
  assert.match(doneMessage(third), /Strike 3 of 3\. That's the limit: suspend the site/);
});

test("a report about another site can't be used, and photos already down aren't taken down twice", async () => {
  const { alice, one } = await world();
  const bob = await makeUser("Bob");
  const bobsReport = await copyrightNotice(bob.subdomain);
  const wrong = await redirectedTo(adminActions.takeDownPhotos(form({ userId: alice.id, photo: one.id, reportId: bobsReport })));
  assert.equal(doneMessage(wrong), "That report isn't about this site.");
  assert.equal((await findUserById(alice.id))!.photos.find((p) => p.id === one.id)?.removed, undefined);

  await redirectedTo(adminActions.takeDownPhotos(form({ userId: alice.id, photo: one.id })));
  const twice = await redirectedTo(adminActions.takeDownPhotos(form({ userId: alice.id, photo: one.id })));
  assert.equal(doneMessage(twice), "Nothing changed: choose photos that are on the site.");
});

test("a suspended site is hidden, takes no messages or uploads, and comes back when the suspension is lifted", async (t) => {
  const { alice } = await world();
  const emails = captureEmails(t);
  const to = await redirectedTo(adminActions.suspendSite(form({ userId: alice.id, reason: "it was used for a scam", notify: "yes" })));
  assert.equal(doneMessage(to), "Suspended the site. They were emailed.");
  assert.match(emails[0], /Subject: Your Folio site is offline/);
  assert.match(emails[0], /because it was used for a scam/);

  const suspended = (await findUserById(alice.id))!;
  assert.equal(siteData(suspended), null, "visitors see nothing");
  assert.ok(siteData(suspended, { preview: true }), "the owner's preview still works");
  fromIp("192.0.2.80");
  assert.match((await sendInquiry(alice.subdomain, {}, formOf({ name: "A", email: "a@example.com", message: "Hi" }))).error!, /isn't accepting/);
  await signInAs(alice);
  assert.match((await uploadPhotos({}, formWith(await jpegFile()))).error!, /suspended/);
  assert.match((await (await postJson(startPhotoUpload, { type: "image/jpeg", size: 1000 })).json()).error, /suspended/);

  await signInAs(await makeAdmin());
  await redirectedTo(adminActions.unsuspendSite(form({ userId: alice.id })));
  assert.ok(siteData((await findUserById(alice.id))!), "live again");
  assert.equal(emails.length, 1, "no email when notify is unticked");
});

async function makeAdmin() {
  const admin = await makeUser("Admin");
  process.env.ADMIN_EMAILS = admin.email;
  return admin;
}

test("an account on legal hold can't delete its photos or itself, and its owner isn't told", async (t) => {
  const admin = await makeAdmin();
  const alice = await makeUser("Alice", { password: "correct horse battery" });
  const { photo } = await addPhoto(alice.id);
  const emails = captureEmails(t);
  await signInAs(admin);
  const to = await redirectedTo(adminActions.placeLegalHold(form({ userId: alice.id, note: "NCMEC report 1", notify: "yes" })));
  assert.match(doneMessage(to), /Froze the account/);
  assert.equal(emails.length, 0);

  await signInAs(alice);
  const files = filesOf(alice.id);
  await deletePhoto(photo.id);
  assert.equal((await findUserById(alice.id))!.photos.length, 1);
  assert.deepEqual(filesOf(alice.id), files);
  assert.match((await deleteAccount({}, formOf({ password: "correct horse battery" }))).error!, /can't be deleted right now/);
  assert.ok(await findUserById(alice.id));

  await signInAs(admin);
  await redirectedTo(adminActions.releaseLegalHold(form({ userId: alice.id })));
  await signInAs(alice);
  await deletePhoto(photo.id);
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
  assert.deepEqual(
    (await adminActionsFor(alice.id)).map((a) => a.detail),
    ["Released the legal hold.", "Placed a legal hold: NCMEC report 1."],
  );
});

test("closing a report keeps the admin's note; reopening it keeps the note too; both are logged", async () => {
  const { alice } = await world();
  const reportId = await copyrightNotice(alice.subdomain);
  const closed = await redirectedTo(adminActions.closeReport(form({ reportId, note: "Not on the site any more" })));
  assert.equal(closed, `/admin/reports/${reportId}?done=Closed.`);
  let report = (await findReport(reportId))!;
  assert.equal(report.status, "closed");
  assert.equal(report.note, "Not on the site any more");
  assert.ok(report.closedAt);

  await redirectedTo(adminActions.reopenReport(form({ reportId })));
  report = (await findReport(reportId))!;
  assert.equal(report.status, "open");
  assert.equal(report.note, "Not on the site any more");
  assert.equal(report.closedAt, undefined);
  assert.deepEqual(
    (await adminActionsFor(alice.id)).map((a) => a.action),
    ["reopen-report", "close-report"],
  );
});

test("older photos get their photographer's name and notice, dated with their upload year; taken-down ones stay down", async () => {
  const { alice, one, two } = await world();
  await updateUser(alice.id, (u) => {
    u.photos.find((p) => p.id === one.id)!.createdAt = "2024-05-01T10:00:00.000Z";
  });
  const before = await photosWithoutRights(); // other tests' photos are in this database too
  await redirectedTo(adminActions.takeDownPhotos(form({ userId: alice.id, photo: two.id })));
  assert.equal(await photosWithoutRights(), before - 1, "a taken-down photo has no web copies to fix");

  const to = await redirectedTo(adminActions.addRightsToOlderPhotos());
  assert.equal(to?.split("?")[0], "/admin");
  assert.equal(doneMessage(to), `Added copyright details to ${before - 1} photos. All done.`);
  const after = (await findUserById(alice.id))!;
  assert.equal(after.photos.find((p) => p.id === one.id)?.copyright, "© 2024 Alice. All rights reserved.");
  const copy = await storage.get(alice.id, variantName(one.id, one.variants![0]));
  assert.match((await sharp(copy).metadata()).xmp?.toString("utf8") ?? "", /© 2024 Alice/);
  for (const name of webCopies(two)) assert.ok(!filesOf(alice.id).includes(name), `${name} still deleted`);
  assert.equal(await photosWithoutRights(), 0);
});
