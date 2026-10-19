// Reporting a site (the reportSite and reportCopyright actions). Anyone can
// do it, so it must be hard to abuse and must never lose a report.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { reportCopyright, reportSite } from "../app/actions/report.ts";
import { database } from "../lib/pg.ts";
import { captureEmails, formOf, fromIp, makeUser, resetRequest } from "./helpers.ts";

beforeEach(resetRequest);
afterEach(() => delete process.env.REPORTS_EMAIL);

let visitor = 0;
const newVisitor = () => fromIp(`192.0.2.${++visitor}`);
const report = (fields: Record<string, string> = {}) =>
  formOf({ site: "", reason: "harmful", details: "Something nasty on the home page", email: "owner@example.com", ...fields });
const reportsFor = async (subdomain: string) =>
  (await (await database()).query<{ reason: string; details: string; reporter_email: string }>(
    "select reason, details, reporter_email from reports where subdomain = $1",
    [subdomain],
  )).rows;

test("a report is saved, and emailed to REPORTS_EMAIL with a reply-to the reporter", async (t) => {
  const emails = captureEmails(t);
  process.env.REPORTS_EMAIL = "abuse@folio.example";
  const alice = await makeUser("Alice");
  newVisitor();
  assert.match((await reportSite({}, report({ site: alice.subdomain.toUpperCase() }))).ok!, /received your report/);
  assert.deepEqual(await reportsFor(alice.subdomain), [
    { reason: "harmful", details: "Something nasty on the home page", reporter_email: "owner@example.com" },
  ]);
  assert.equal(emails.length, 1);
  assert.match(emails[0], /To: abuse@folio\.example\nReply-To: owner@example\.com\nSubject: Report about .*: Illegal, abusive or harmful content/);
});

test("without REPORTS_EMAIL the report is still saved", async (t) => {
  const emails = captureEmails(t);
  const alice = await makeUser("Alice");
  newVisitor();
  assert.ok((await reportSite({}, report({ site: alice.subdomain }))).ok);
  assert.equal((await reportsFor(alice.subdomain)).length, 1);
  assert.equal(emails.length, 0);
});

test("incomplete reports and unknown sites are refused, and nothing is saved", async () => {
  const alice = await makeUser("Alice");
  newVisitor();
  const site = alice.subdomain;
  assert.deepEqual(await reportSite({}, report({ site, reason: "boredom" })), { error: "Choose what's wrong." });
  assert.deepEqual(await reportSite({}, report({ site, reason: "toString" })), { error: "Choose what's wrong." });
  assert.match((await reportSite({}, report({ site, details: " " }))).error!, /Tell us what's wrong/);
  assert.match((await reportSite({}, report({ site, email: "nope" }))).error!, /valid email/);
  assert.deepEqual(await reportSite({}, report({ site: "no-such-site" })), { error: "We couldn't find that site." });
  assert.equal((await reportsFor(site)).length, 0);
});

test("bots that fill the hidden field are thanked and ignored", async () => {
  const alice = await makeUser("Alice");
  newVisitor();
  assert.ok((await reportSite({}, report({ site: alice.subdomain, company: "Spam Inc" }))).ok);
  assert.equal((await reportsFor(alice.subdomain)).length, 0);
});

test("one visitor can send five reports an hour", async () => {
  const alice = await makeUser("Alice");
  newVisitor();
  for (let i = 0; i < 5; i++) assert.ok((await reportSite({}, report({ site: alice.subdomain }))).ok, `report ${i + 1}`);
  assert.match((await reportSite({}, report({ site: alice.subdomain }))).error!, /several reports/);
  assert.equal((await reportsFor(alice.subdomain)).length, 5);
});

// ── Copyright notices ───────────────────────────────────────────────────

// A notice with every part 17 U.S.C. § 512(c)(3) asks for.
const notice = (fields: Record<string, string> = {}) =>
  formOf({
    site: "",
    urls: "https://alice.example/weddings\n\n  https://alice.example/about  ",
    work: "My photo of the Lisbon tram, published at https://janedoe.example/tram",
    role: "owner",
    name: "Jane Doe",
    organization: "",
    address: "1 Main St\nSpringfield",
    phone: "555-0100",
    email: "jane@example.com",
    goodFaith: "yes",
    accurate: "yes",
    signature: "Jane Doe",
    ...fields,
  });
const noticesFor = async (subdomain: string) =>
  (await (await database()).query<{ reason: string; reporter_email: string; notice: Record<string, unknown> }>(
    "select reason, reporter_email, notice from reports where subdomain = $1",
    [subdomain],
  )).rows;

test("a complete copyright notice is saved with each part, and emailed to REPORTS_EMAIL", async (t) => {
  const emails = captureEmails(t);
  process.env.REPORTS_EMAIL = "abuse@folio.example";
  const alice = await makeUser("Alice");
  newVisitor();
  assert.match((await reportCopyright({}, notice({ site: alice.subdomain }))).ok!, /received your notice/);

  const [saved] = await noticesFor(alice.subdomain);
  assert.equal(saved.reason, "copyright");
  assert.equal(saved.reporter_email, "jane@example.com");
  assert.deepEqual(saved.notice, {
    name: "Jane Doe",
    organization: "",
    role: "owner",
    ownerName: "",
    address: "1 Main St\nSpringfield",
    phone: "555-0100",
    email: "jane@example.com",
    work: "My photo of the Lisbon tram, published at https://janedoe.example/tram",
    urls: ["https://alice.example/weddings", "https://alice.example/about"],
    signature: "Jane Doe",
  });
  assert.equal(emails.length, 1);
  assert.match(emails[0], /To: abuse@folio\.example\nReply-To: jane@example\.com\nSubject: Copyright notice about /);
  assert.match(emails[0], /under penalty of perjury/);
  assert.match(emails[0], /Signature: Jane Doe/);
});

test("a copyright notice missing any part the law requires is refused, keeps what was typed, and saves nothing", async () => {
  const alice = await makeUser("Alice");
  newVisitor();
  const site = alice.subdomain;
  const missing: Record<string, RegExp> = {
    urls: /where your work appears/,
    work: /original work/,
    role: /own the copyright or act for the owner/,
    name: /full name/,
    address: /mailing address/,
    phone: /phone number/,
    email: /valid email/,
    goodFaith: /good faith/,
    accurate: /penalty of perjury/,
    signature: /Sign the notice/,
  };
  for (const [field, message] of Object.entries(missing)) {
    const result = await reportCopyright({}, notice({ site, [field]: "" }));
    assert.match(result.error ?? "", message, field);
    assert.equal(result.fields?.name, field === "name" ? "" : "Jane Doe", `${field}: typed fields kept`);
  }
  assert.match((await reportCopyright({}, notice({ site, role: "agent" }))).error!, /copyright owner you act for/);
  assert.equal((await reportCopyright({}, notice({ site: "no-such-site" }))).error, "We couldn't find that site.");
  assert.equal((await noticesFor(site)).length, 0);
});

test("an agent's notice names the copyright owner they act for", async () => {
  const alice = await makeUser("Alice");
  newVisitor();
  const form = notice({ site: alice.subdomain, role: "agent", ownerName: "Jane Doe", name: "Sam Agent", signature: "Sam Agent" });
  assert.ok((await reportCopyright({}, form)).ok);
  const [saved] = await noticesFor(alice.subdomain);
  assert.equal(saved.notice.role, "agent");
  assert.equal(saved.notice.ownerName, "Jane Doe");
});

test("copyright notices share the report limit, and bots that fill the hidden field are ignored", async () => {
  const alice = await makeUser("Alice");
  newVisitor();
  assert.ok((await reportCopyright({}, notice({ site: alice.subdomain, company: "Spam Inc" }))).ok);
  assert.equal((await noticesFor(alice.subdomain)).length, 0);
  for (let i = 0; i < 4; i++) assert.ok((await reportSite({}, report({ site: alice.subdomain }))).ok);
  assert.ok((await reportCopyright({}, notice({ site: alice.subdomain }))).ok);
  assert.match((await reportCopyright({}, notice({ site: alice.subdomain }))).error!, /several reports/);
});

test("the general form no longer takes copyright complaints, which need the notice form", async () => {
  const alice = await makeUser("Alice");
  newVisitor();
  assert.deepEqual(await reportSite({}, report({ site: alice.subdomain, reason: "copyright" })), {
    error: "Choose what's wrong.",
  });
});
