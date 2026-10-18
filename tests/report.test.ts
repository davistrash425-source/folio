// Reporting a site (the reportSite action). Anyone can do it, so it must be
// hard to abuse and must never lose a report.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { reportSite } from "../app/actions/report.ts";
import { database } from "../lib/pg.ts";
import { captureEmails, formOf, fromIp, makeUser, resetRequest } from "./helpers.ts";

beforeEach(resetRequest);
afterEach(() => delete process.env.REPORTS_EMAIL);

let visitor = 0;
const newVisitor = () => fromIp(`192.0.2.${++visitor}`);
const report = (fields: Record<string, string> = {}) =>
  formOf({ site: "", reason: "copyright", details: "My photo, used without asking", email: "owner@example.com", ...fields });
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
    { reason: "copyright", details: "My photo, used without asking", reporter_email: "owner@example.com" },
  ]);
  assert.equal(emails.length, 1);
  assert.match(emails[0], /To: abuse@folio\.example\nReply-To: owner@example\.com\nSubject: Report about .*used without permission/);
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
