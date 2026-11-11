// The account export (/api/export) streams every original, so it's capped.
// A file of its own: the rate limits are counted in this process's memory, so
// the other export tests must not spend this account's allowance.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { EXPORTS_PER_HOUR, GET as exportAccount } from "../app/api/export/route.ts";
import { makeUser, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

test("the export is capped, so one account can't stream it over and over", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  for (let i = 0; i < EXPORTS_PER_HOUR; i++) assert.equal((await exportAccount()).status, 200, `export ${i + 1}`);
  const refused = await exportAccount();
  assert.equal(refused.status, 429);
  assert.match(await refused.text(), /a few times an hour/);

  // Another account from the same address isn't held up (the per-visitor
  // limit is looser than the per-account one).
  const bob = await makeUser("Bob");
  await signInAs(bob);
  assert.equal((await exportAccount()).status, 200);
});
