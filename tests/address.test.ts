// Changing a site's address (the changeAddress action).
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { signup } from "../app/actions/auth.ts";
import { changeAddress } from "../app/actions/site.ts";
import { addReport, findUserById, findUserBySubdomain, reportsForSite, updateUser } from "../lib/db.ts";
import { formOf, fromIp, makeUser, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

const moveTo = (subdomain: string) => changeAddress({}, formOf({ subdomain }));

test("a photographer can move their site to a free address, and the old one stops working", async () => {
  const davi = await makeUser("Davi");
  const old = davi.subdomain;
  await signInAs(davi);

  const result = await moveTo(`${old}-free`);
  assert.match(result.ok!, new RegExp(`${old}-free\\.`));
  assert.equal((await findUserById(davi.id))!.subdomain, `${old}-free`);
  assert.equal((await findUserBySubdomain(`${old}-free`))!.id, davi.id);
  assert.equal(await findUserBySubdomain(old), null);
});

test("an address that's taken, reserved or badly formed can't be used, and nothing changes", async () => {
  const davi = await makeUser("Davi");
  const other = await makeUser("Other");
  await signInAs(davi);

  assert.match((await moveTo(other.subdomain)).error!, /taken/);
  assert.match((await moveTo("support")).error!, /reserved/);
  assert.match((await moveTo("-no")).error!, /3–30 lowercase/);
  assert.match((await moveTo(davi.subdomain)).error!, /already your address/);
  assert.equal((await findUserById(davi.id))!.subdomain, davi.subdomain);
  assert.equal((await findUserById(other.id))!.subdomain, other.subdomain);
});

test("an old address is held from everyone else for a year, but its owner can move back", async () => {
  const davi = await makeUser("Davi");
  const old = davi.subdomain;
  await signInAs(davi);
  await moveTo(`${old}-new`);

  const mallory = await makeUser("Mallory");
  await signInAs(mallory);
  assert.match((await moveTo(old)).error!, /held for a year/);
  fromIp("198.51.100.77");
  const fields = { name: "Mallory", email: "mallory-signup@example.com", password: "a long password", subdomain: old };
  assert.match((await signup({}, formOf(fields))).error!, /held for a year/);

  await signInAs(davi);
  assert.ok((await moveTo(old)).ok);
  assert.equal((await findUserById(davi.id))!.subdomain, old);
  await signInAs(mallory);
  assert.match((await moveTo(`${old}-new`)).error!, /held for a year/, "the address they left is held now");
});

test("reports about a site follow it to its new address", async () => {
  const davi = await makeUser("Davi");
  await addReport({ subdomain: davi.subdomain, reason: "spam", details: "x", reporterEmail: "r@example.com" });
  await signInAs(davi);
  await moveTo(`${davi.subdomain}-new`);
  assert.equal((await reportsForSite(`${davi.subdomain}-new`)).length, 1);
  assert.equal((await reportsForSite(davi.subdomain)).length, 0);
});

test("a suspended site can't change its address", async () => {
  const davi = await makeUser("Davi");
  await updateUser(davi.id, (u) => (u.suspended = { reason: "a test", at: new Date().toISOString() }));
  await signInAs(davi);
  assert.match((await moveTo(`${davi.subdomain}-new`)).error!, /suspended/);
  assert.equal((await findUserById(davi.id))!.subdomain, davi.subdomain);
});

test("an address can only be changed a few times a day", async () => {
  const davi = await makeUser("Davi");
  await signInAs(davi);
  for (let i = 1; i <= 3; i++) assert.ok((await moveTo(`${davi.subdomain}-${i}x`)).ok);
  assert.match((await moveTo(`${davi.subdomain}-4x`)).error!, /Try again tomorrow/);
});
