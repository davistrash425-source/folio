// Folio Pro billing through Polar (lib/billing.ts, lib/billing-webhook.ts,
// app/actions/billing.ts, app/api/webhooks/billing). The network is faked.
import { afterEach, beforeEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import * as billingActions from "../app/actions/billing.ts";
import { deleteAccount } from "../app/actions/auth.ts";
import { deleteAccountAsAdmin, letPaymentsDecide, setPlan } from "../app/actions/admin.ts";
import { POST as webhook } from "../app/api/webhooks/billing/route.ts";
import { findUserById } from "../lib/db.ts";
import { photoLimit } from "../lib/plans.ts";
import { addPhoto, captureEmails, formOf, makeUser, redirectedTo, resetRequest, signInAs } from "./helpers.ts";

const SECRET = "whsec_" + Buffer.from("test-secret-bytes").toString("base64");

beforeEach(() => {
  resetRequest();
  process.env.POLAR_ACCESS_TOKEN = "polar_oat_test";
  process.env.POLAR_WEBHOOK_SECRET = SECRET;
  process.env.POLAR_PRODUCT_MONTHLY = "prod-month";
  process.env.POLAR_PRODUCT_YEARLY = "prod-year";
  delete process.env.POLAR_SERVER;
});
afterEach(() => {
  for (const k of ["POLAR_ACCESS_TOKEN", "POLAR_WEBHOOK_SECRET", "POLAR_PRODUCT_MONTHLY", "POLAR_PRODUCT_YEARLY", "POLAR_SERVER", "ADMIN_EMAILS"]) {
    delete process.env[k];
  }
});

// A request signed the way Polar signs webhooks (Standard Webhooks).
function signed(body: string, id = "evt-1", opts: { secret?: string; at?: number } = {}) {
  const timestamp = String(opts.at ?? Math.floor(Date.now() / 1000));
  const key = Buffer.from((opts.secret ?? SECRET).slice("whsec_".length), "base64");
  const sig = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new Request("https://folio.test/api/webhooks/billing", {
    method: "POST",
    headers: { "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,${sig}` },
    body,
  });
}

function event(userId: string, status: string, extra: Record<string, unknown> = {}, type = "subscription.updated") {
  return JSON.stringify({
    type,
    data: {
      id: "sub-1",
      status,
      recurring_interval: "month",
      current_period_end: "2026-12-01T00:00:00Z",
      cancel_at_period_end: false,
      modified_at: "2026-11-01T00:00:00Z",
      customer: { external_id: userId },
      metadata: { userId },
      ...extra,
    },
  });
}

function fakePolar(t: TestContext, reply: () => unknown = () => ({}), status = 201) {
  const sent: { url: string; method: string; body: Record<string, unknown> | null }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit = {}) => {
    sent.push({ url: String(input), method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null });
    return Response.json(reply(), { status });
  });
  return sent;
}

test("a signed active event moves the account to Pro", async () => {
  const u = await makeUser("Proud");
  assert.equal(photoLimit(u), 150);
  const res = await webhook(signed(event(u.id, "active")));
  assert.equal(res.status, 200);
  const after = (await findUserById(u.id))!;
  assert.equal(after.plan, "pro");
  assert.equal(after.billing?.subscriptionId, "sub-1");
  assert.equal(photoLimit(after), 1500);
});

test("an event with a wrong signature is refused and changes nothing", async () => {
  const u = await makeUser("Forged");
  const other = "whsec_" + Buffer.from("other").toString("base64");
  const res = await webhook(signed(event(u.id, "active"), "evt-x", { secret: other }));
  assert.equal(res.status, 400);
  assert.notEqual((await findUserById(u.id))!.plan, "pro");
});

test("an old signed event is refused as a replay", async () => {
  const u = await makeUser("Replay");
  const res = await webhook(signed(event(u.id, "active"), "evt-r", { at: Math.floor(Date.now() / 1000) - 3600 }));
  assert.equal(res.status, 400);
  assert.notEqual((await findUserById(u.id))!.plan, "pro");
});

test("the same event delivered twice is harmless", async () => {
  const u = await makeUser("Twice");
  await webhook(signed(event(u.id, "active"), "evt-same"));
  const res = await webhook(signed(event(u.id, "active"), "evt-same"));
  assert.deepEqual(await res.json(), { outcome: "duplicate" });
  assert.equal((await findUserById(u.id))!.plan, "pro");
});

test("an older event arriving late does not undo a newer one", async () => {
  const u = await makeUser("Late");
  await webhook(signed(event(u.id, "revoked", { modified_at: "2026-11-05T00:00:00Z" }), "evt-new"));
  await webhook(signed(event(u.id, "active", { modified_at: "2026-11-01T00:00:00Z" }), "evt-old"));
  const after = (await findUserById(u.id))!;
  assert.equal(after.plan, "free");
  assert.equal(after.billing?.status, "revoked");
});

test("a late event from an older subscription can't restore Pro after a newer one ended", async () => {
  const u = await makeUser("Switcher");
  await webhook(signed(event(u.id, "active", { id: "sub-new", modified_at: "2026-11-03T00:00:00Z" }), "e1"));
  await webhook(signed(event(u.id, "revoked", { id: "sub-new", modified_at: "2026-11-05T00:00:00Z" }), "e2"));
  const late = await webhook(signed(event(u.id, "active", { id: "sub-old", modified_at: "2026-11-01T00:00:00Z" }), "e3"));
  assert.deepEqual(await late.json(), { outcome: "stale" });
  const after = (await findUserById(u.id))!;
  assert.equal(after.plan, "free");
  assert.equal(after.billing?.subscriptionId, "sub-new");
});

test("a cancelled but paid-up subscription keeps Pro, and ending it goes back to Free with an email", async (t) => {
  const u = await makeUser("Leaver");
  await webhook(signed(event(u.id, "active"), "e1"));
  await webhook(signed(event(u.id, "active", { cancel_at_period_end: true, modified_at: "2026-11-02T00:00:00Z" }, "subscription.canceled"), "e2"));
  const stillPro = (await findUserById(u.id))!;
  assert.equal(stillPro.plan, "pro");
  assert.equal(stillPro.billing?.cancelAtPeriodEnd, true);

  const sent = captureEmails(t);
  await webhook(signed(event(u.id, "revoked", { modified_at: "2026-12-01T00:00:00Z" }, "subscription.revoked"), "e3"));
  assert.equal((await findUserById(u.id))!.plan, "free");
  assert.match(sent.join("\n"), /Pro plan has ended/);
});

test("a failed payment keeps Pro while Polar retries", async () => {
  const u = await makeUser("Latepayer");
  await webhook(signed(event(u.id, "past_due"), "e1"));
  assert.equal((await findUserById(u.id))!.plan, "pro");
});

test("downgrading keeps every photo", async () => {
  const u = await makeUser("Keeper");
  await webhook(signed(event(u.id, "active"), "e1"));
  await addPhoto(u.id);
  await webhook(signed(event(u.id, "revoked", { modified_at: "2026-12-01T00:00:00Z" }), "e2"));
  const after = (await findUserById(u.id))!;
  assert.equal(after.plan, "free");
  assert.equal(after.photos.length, 1);
});

test("a plan an admin set by hand is never changed by payments", async () => {
  const admin = await makeUser("Boss");
  const friend = await makeUser("Friend");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  await redirectedTo(setPlan(formOf({ userId: friend.id, plan: "pro" })));
  await webhook(signed(event(friend.id, "revoked"), "e1"));
  const after = (await findUserById(friend.id))!;
  assert.equal(after.plan, "pro");
  assert.equal(after.planSource, "manual");
});

test("after an admin lets payments decide, the last subscription state sets the plan and later events change it", async () => {
  const admin = await makeUser("Boss");
  const buyer = await makeUser("Buyer");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  await redirectedTo(setPlan(formOf({ userId: buyer.id, plan: "free" })));
  await webhook(signed(event(buyer.id, "active"), "e1"));
  assert.equal((await findUserById(buyer.id))!.plan, "free", "the hand-set plan still stands");

  await redirectedTo(letPaymentsDecide(formOf({ userId: buyer.id })));
  let after = (await findUserById(buyer.id))!;
  assert.equal(after.plan, "pro");
  assert.equal(after.planSource, "billing");

  await webhook(signed(event(buyer.id, "revoked", { modified_at: "2026-12-01T00:00:00Z" }), "e2"));
  after = (await findUserById(buyer.id))!;
  assert.equal(after.plan, "free");
});

test("letting payments decide with no subscription puts the account on Free", async () => {
  const admin = await makeUser("Boss");
  const friend = await makeUser("Friend");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  await redirectedTo(setPlan(formOf({ userId: friend.id, plan: "pro" })));
  await redirectedTo(letPaymentsDecide(formOf({ userId: friend.id })));
  const after = (await findUserById(friend.id))!;
  assert.equal(after.plan, "free");
  assert.equal(after.planSource, "billing");
});

test("events for an unknown account or a non-subscription event are answered 200 and ignored", async () => {
  const res = await webhook(signed(event("no-such-user", "active"), "e1"));
  assert.deepEqual(await res.json(), { outcome: "unknown account" });
  const other = await webhook(signed(JSON.stringify({ type: "order.created", data: {} }), "e2"));
  assert.deepEqual(await other.json(), { outcome: "ignored" });
});

test("the account comes from the account id, never the email in the payload", async () => {
  const victim = await makeUser("Victim");
  const attacker = await makeUser("Attacker");
  await webhook(signed(event(attacker.id, "active", { customer: { external_id: attacker.id, email: victim.email } }), "e1"));
  assert.notEqual((await findUserById(victim.id))!.plan, "pro");
  assert.equal((await findUserById(attacker.id))!.plan, "pro");
});

test("checkout sends the account id to Polar and goes to its page", async (t) => {
  const u = await makeUser("Buyer");
  await signInAs(u);
  const sent = fakePolar(t, () => ({ url: "https://sandbox.polar.sh/checkout/abc" }));
  assert.equal(await redirectedTo(billingActions.startCheckout("year")), "https://sandbox.polar.sh/checkout/abc");
  assert.match(sent[0].url, /^https:\/\/sandbox-api\.polar\.sh\/v1\/checkouts/);
  assert.deepEqual(sent[0].body?.products, ["prod-year"]);
  assert.equal(sent[0].body?.external_customer_id, u.id);
  assert.deepEqual(sent[0].body?.metadata, { userId: u.id });
});

test("checkout is closed until Polar is set up", async (t) => {
  delete process.env.POLAR_ACCESS_TOKEN;
  const u = await makeUser("Early");
  await signInAs(u);
  const sent = fakePolar(t);
  const result = await billingActions.startCheckout("month");
  assert.match(result.error ?? "", /open yet/);
  assert.equal(sent.length, 0);
});

test("an account that already subscribed goes to the billing page, not a second checkout", async (t) => {
  const u = await makeUser("Already");
  await webhook(signed(event(u.id, "active"), "e1"));
  await signInAs(u);
  const sent = fakePolar(t, () => ({ customer_portal_url: "https://sandbox.polar.sh/portal/x" }));
  assert.equal(await redirectedTo(billingActions.startCheckout("month")), "https://sandbox.polar.sh/portal/x");
  assert.match(sent[0].url, /customer-sessions/);
});

test("the billing page only ever opens for the signed-in account's own id", async (t) => {
  const a = await makeUser("Alice");
  const b = await makeUser("Bob");
  await webhook(signed(event(b.id, "active"), "e1"));
  await signInAs(a);
  const sent = fakePolar(t, () => ({ customer_portal_url: "https://x.test" }));
  assert.match((await billingActions.openBillingPortal()).error ?? "", /no subscription/);
  assert.equal(sent.length, 0);
  await signInAs(b);
  await redirectedTo(billingActions.openBillingPortal());
  assert.equal(sent[0].body?.external_customer_id, b.id);
});

test("deleting an account ends its subscription first", async (t) => {
  const u = await makeUser("Gone", { password: "correct horse battery" });
  await webhook(signed(event(u.id, "active"), "e1"));
  await signInAs(u);
  const sent = fakePolar(t);
  await redirectedTo(deleteAccount({}, formOf({ password: "correct horse battery" })));
  assert.equal(sent[0].method, "DELETE");
  assert.match(sent[0].url, /\/subscriptions\/sub-1$/);
  assert.equal(await findUserById(u.id), null);
});

test("if Polar can't end the subscription, deleting the account is refused and nothing is deleted", async (t) => {
  const u = await makeUser("Stuck", { password: "correct horse battery" });
  await webhook(signed(event(u.id, "active"), "e1"));
  await signInAs(u);
  t.mock.method(console, "error", () => {});
  const sent = fakePolar(t, () => ({ detail: "try later" }), 500);
  const res = await deleteAccount({}, formOf({ password: "correct horse battery" }));
  assert.equal(sent[0].method, "DELETE");
  assert.match(res.error ?? "", /not deleted/);
  const after = await findUserById(u.id);
  assert.ok(after, "the account still exists");
  assert.equal(after.plan, "pro", "and is still on Pro");
});

test("if Polar says the subscription is already gone, deleting the account goes ahead", async (t) => {
  const u = await makeUser("Ended", { password: "correct horse battery" });
  await webhook(signed(event(u.id, "active"), "e1"));
  await signInAs(u);
  fakePolar(t, () => ({ detail: "Not Found" }), 404);
  await redirectedTo(deleteAccount({}, formOf({ password: "correct horse battery" })));
  assert.equal(await findUserById(u.id), null);
});

test("an admin's delete is refused the same way when Polar can't end the subscription", async (t) => {
  const admin = await makeUser("Boss");
  const u = await makeUser("Stuck2");
  await webhook(signed(event(u.id, "active"), "e1"));
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  t.mock.method(console, "error", () => {});
  fakePolar(t, () => ({ detail: "try later" }), 500);
  const to = await redirectedTo(deleteAccountAsAdmin(formOf({ userId: u.id, confirm: u.subdomain })));
  assert.match(decodeURIComponent(to!.split("?done=")[1]), /nothing was deleted/);
  assert.ok(await findUserById(u.id));
});
