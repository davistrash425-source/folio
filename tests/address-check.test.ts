// The live address-availability check (app/api/address and lib/address).
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { GET as addressCheck } from "../app/api/address/route.ts";
import { addressStatus } from "../lib/address.ts";
import { deleteUser } from "../lib/db.ts";
import { fromIp, makeUser, resetRequest } from "./helpers.ts";

beforeEach(resetRequest);

const check = (subdomain: string) =>
  addressCheck(new Request(`http://localhost/api/address?subdomain=${encodeURIComponent(subdomain)}`));

test("a free address is available", async () => {
  fromIp("198.51.100.11");
  const res = await check("never-taken-name");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "available" });
});

test("a reserved or badly-formed address is invalid, with the reason", async () => {
  fromIp("198.51.100.12");
  assert.equal((await (await check("support")).json()).status, "invalid");
  assert.equal((await (await check("no")).json()).status, "invalid");
  const bad = await (await check("No way!")).json();
  assert.equal(bad.status, "invalid");
  assert.match(bad.message, /3–30 lowercase/);
});

test("an address someone already has is taken", async () => {
  const davi = await makeUser("Davi");
  fromIp("198.51.100.13");
  const res = await check(davi.subdomain);
  assert.deepEqual(await res.json(), { status: "taken", message: "That site address is taken." });
});

test("an address a closed account gave up is held", async () => {
  const erin = await makeUser("Erin");
  await deleteUser(erin.id);
  fromIp("198.51.100.14");
  const res = await check(erin.subdomain);
  assert.equal((await res.json()).status, "held");
});

test("the live check is rate-limited per address", async () => {
  fromIp("198.51.100.15");
  for (let i = 0; i < 60; i++) await check("hammered-name");
  const res = await check("hammered-name");
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { status: "limited" });
});

test("addressStatus agrees with the route on every outcome", async () => {
  const davi = await makeUser("Davi");
  assert.equal((await addressStatus("brand-new-address")).status, "available");
  assert.equal((await addressStatus(davi.subdomain)).status, "taken");
  assert.equal((await addressStatus("support")).status, "invalid");
  assert.equal((await addressStatus("ab")).status, "invalid");
});
