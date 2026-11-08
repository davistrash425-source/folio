// The Your business page: the facts Folio AGENTS may use in replies. Only for
// accounts with the agents on, only the account's own owner can save, and
// saving leaves the public site alone.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import * as adminActions from "../app/actions/admin.ts";
import { saveBusiness } from "../app/actions/business.ts";
import { GET as exportAccount } from "../app/api/export/route.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { formOf, makeUser, readZip, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";
import { revalidated } from "./stubs/next-cache.ts";

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_VIEWER_EMAILS;
});

const FIELDS = {
  rates: "Portrait session, 1 hour: 250 EUR",
  tone: "Warm and direct",
  rules: "Never confirm a booking without asking me first",
};

// An account with the agents switched on by a Folio admin.
async function agentAccount(name: string) {
  const user = await makeUser(name);
  return updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "staff@example.com" };
  });
}

test("saving stores the rates, tone and rules, with when they were saved", async () => {
  const alice = await agentAccount("Alice");
  await signInAs(alice);

  assert.deepEqual(await saveBusiness({}, formOf(FIELDS)), { ok: "Saved." });

  const saved = (await findUserById(alice.id))!.business!;
  assert.equal(saved.rates, FIELDS.rates);
  assert.equal(saved.tone, FIELDS.tone);
  assert.equal(saved.rules, FIELDS.rules);
  assert.ok(!Number.isNaN(Date.parse(saved.updatedAt)), "the save time is recorded");
});

test("each of the three texts is cut to 4000 characters, and spaces at the ends are trimmed", async () => {
  const alice = await agentAccount("Alice");
  await signInAs(alice);

  await saveBusiness({}, formOf({ rates: `  ${"r".repeat(5000)}  `, tone: "t".repeat(4001), rules: "short" }));

  const saved = (await findUserById(alice.id))!.business!;
  assert.equal(saved.rates.length, 4000);
  assert.equal(saved.tone.length, 4000);
  assert.equal(saved.rules, "short");
  assert.ok(!saved.rates.startsWith(" "));
});

test("an account with the agents off gets an error and nothing is saved", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);

  assert.match((await saveBusiness({}, formOf(FIELDS))).error ?? "", /isn't available on this account/);
  assert.equal((await findUserById(alice.id))!.business, undefined);
});

test("saving doesn't refresh the public site", async () => {
  const alice = await agentAccount("Alice");
  await signInAs(alice);
  const before = revalidated.length;

  await saveBusiness({}, formOf(FIELDS));

  const siteRefreshes = revalidated.slice(before).filter((entry) => entry.includes(`site:${alice.subdomain}`));
  assert.deepEqual(siteRefreshes, []);
});

test("a signed-out visitor is sent to log in and nothing is saved", async () => {
  const alice = await agentAccount("Alice");
  signOut();

  assert.equal(await redirectedTo(saveBusiness({}, formOf(FIELDS))), "/login");
  assert.equal((await findUserById(alice.id))!.business, undefined);
});

test("the three fields are in the account export", async () => {
  const alice = await agentAccount("Alice");
  await signInAs(alice);
  await saveBusiness({}, formOf(FIELDS));

  const files = readZip(Buffer.from(await (await exportAccount()).arrayBuffer()));
  const account = JSON.parse(files.get("account.json")!.toString("utf8"));
  assert.equal(account.business.rates, FIELDS.rates);
  assert.equal(account.business.tone, FIELDS.tone);
  assert.equal(account.business.rules, FIELDS.rules);
});

test("staff viewing the account as its owner can't save", async () => {
  const admin = await makeUser("Boss");
  const alice = await agentAccount("Alice");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  const data = new FormData();
  data.set("userId", alice.id);
  data.set("reason", "Reproducing a problem with replies");
  assert.equal(await redirectedTo(adminActions.startImpersonation(data)), "/dashboard/manage/photos");

  assert.match((await saveBusiness({}, formOf(FIELDS))).error ?? "", /Stop viewing it first/);
  assert.equal((await findUserById(alice.id))!.business, undefined);
});
