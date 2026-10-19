// Signing up (the signup action): which addresses can be claimed, and when a
// new site goes live.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { signup } from "../app/actions/auth.ts";
import { sendInquiry } from "../app/actions/site.ts";
import { GET as verifyEmail } from "../app/verify-email/route.ts";
import { deleteUser, findUserByEmail, findUserById } from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { siteData } from "../lib/public-site.ts";
import { validateSubdomain } from "../lib/site.ts";
import { captureEmails, formOf, fromIp, makeUser, redirectedTo, resetRequest } from "./helpers.ts";

beforeEach(resetRequest);

// A sign-up form for someone new, from an address of their own (sign-ups are
// rate limited by address).
let n = 0;
function newcomer() {
  n++;
  fromIp(`198.51.100.${n}`);
  return { name: "Dana", email: `dana${n}@example.com`, password: "a long password", subdomain: `dana-${n}` };
}

test("a new site goes live only once its owner confirms their email", async (t) => {
  const emails = captureEmails(t);
  const fields = newcomer();
  assert.equal(await redirectedTo(signup({}, formOf(fields))), "/dashboard");
  const user = (await findUserByEmail(fields.email))!;
  assert.equal(user.published, true);
  assert.equal(siteData(user), null, "not live before the email is confirmed");

  const link = /https?:\/\/\S+\/verify-email\?token=\S+/.exec(emails.join("\n"))![0];
  assert.equal(await redirectedTo(verifyEmail(new Request(link))), "/dashboard/manage/account?verified=1");
  assert.ok(siteData((await findUserById(user.id))!), "live once confirmed");
});

test("a site that isn't live yet takes no messages", async () => {
  const fran = await makeUser("Fran", { verified: false });
  fromIp("198.51.100.200");
  const result = await sendInquiry(fran.subdomain, {}, formOf({ name: "A client", email: "c@example.com", message: "Hi" }));
  assert.equal(result.error, "This site isn't accepting messages.");
  assert.deepEqual((await findUserById(fran.id))!.inquiries, []);
});

test("a closed account's address is held for a year, so nobody can pose as its owner, then it's free again", async () => {
  const erin = await makeUser("Erin");
  await deleteUser(erin.id);
  const fields = { ...newcomer(), subdomain: erin.subdomain };
  assert.match((await signup({}, formOf(fields))).error!, /held for a year/);

  await (await database()).query(
    "update released_subdomains set released_at = now() - interval '13 months' where subdomain = $1",
    [erin.subdomain],
  );
  assert.equal(await redirectedTo(signup({}, formOf(fields))), "/dashboard");
});

test("Folio's own and official-looking names can't be claimed", () => {
  for (const name of ["abuse", "copyright", "dmca", "folio", "legal", "privacy", "support", "www"]) {
    assert.equal(validateSubdomain(name), "That name is reserved.", name);
  }
  assert.equal(validateSubdomain("jane-doe"), null);
});
