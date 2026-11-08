// Mail from anyone on the internet arriving at /api/webhooks/mail.
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { afterEach, beforeEach, test, type TestContext } from "node:test";
import { POST } from "../app/api/webhooks/mail/route.ts";
import { htmlToText, parseAddress, verifyMailWebhook } from "../lib/channels/mail.ts";
import { claimMailbox, listMessages, updateUser } from "../lib/db.ts";
import { makeUser } from "./helpers.ts";

const KEY = Buffer.from("a test secret for the webhook");
const SECRET = `whsec_${KEY.toString("base64")}`;
const DOMAIN = "folio.test";

beforeEach(() => {
  process.env.MAIL_DOMAIN = DOMAIN;
  process.env.MAIL_WEBHOOK_SECRET = SECRET;
  process.env.RESEND_API_KEY = "re_test";
  delete process.env.MAIL_SYSTEM_FORWARDS;
});
afterEach(() => {
  delete process.env.MAIL_DOMAIN;
  delete process.env.MAIL_WEBHOOK_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.MAIL_SYSTEM_FORWARDS;
});

const nowSeconds = () => Math.floor(Date.now() / 1000);

function signed(body: string, timestamp = nowSeconds(), key = KEY) {
  const signature = createHmac("sha256", key).update(`msg_1.${timestamp}.${body}`).digest("base64");
  return { "svix-id": "msg_1", "svix-timestamp": String(timestamp), "svix-signature": `v1,${signature}` };
}

function deliver(data: Record<string, unknown>, headers?: Record<string, string>) {
  const body = JSON.stringify({ type: "email.received", created_at: new Date().toISOString(), data });
  return POST(new Request("http://localhost/api/webhooks/mail", { method: "POST", body, headers: headers ?? signed(body) }));
}

async function photographer(name: string) {
  const user = await makeUser(name);
  const updated = await updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "test" };
  });
  await claimMailbox(updated.id, updated.subdomain);
  return updated;
}

type Email = Record<string, unknown>;
const received = (extra: Email = {}): Email => ({
  id: "email_1",
  from: "client@example.com",
  to: [],
  subject: "A wedding in June",
  text: "Are you free?",
  html: "<p>Are you free?</p>",
  headers: { from: "Sam Client <client@example.com>" },
  message_id: "<abc@example.com>",
  reply_to: [],
  authentication: { spf: "pass", dkim: "pass", dmarc: "pass" },
  ...extra,
});

// Stands in for Resend's API, recording what was asked and sent.
function fakeResend(t: TestContext, email: Email, attachments: unknown[] = []) {
  const calls: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("/attachments")) return Response.json({ object: "list", has_more: false, data: attachments });
    if (url.includes("/emails/receiving/")) return Response.json(email);
    return Response.json({ id: "sent_1" });
  });
  return calls;
}

test("a message to a photographer's address lands in their inbox with the sender's name", async (t) => {
  const alice = await photographer("Alice");
  const bob = await photographer("Bobby");
  fakeResend(t, received());
  const res = await deliver({ email_id: "email_1", to: [`${alice.subdomain}@${DOMAIN}`] });
  assert.deepEqual(await res.json(), { result: "saved" });
  const [message, ...rest] = await listMessages(alice.id);
  assert.equal(rest.length, 0);
  assert.equal(message.channel, "email");
  assert.equal(message.fromName, "Sam Client");
  assert.equal(message.fromAddress, "client@example.com");
  assert.equal(message.subject, "A wedding in June");
  assert.equal(message.body, "Are you free?");
  assert.equal(message.senderCheck, "pass");
  assert.deepEqual(await listMessages(bob.id), []);
});

test("mail forwarded from Gmail reaches the Folio address it was delivered for", async (t) => {
  const alice = await photographer("Alice");
  fakeResend(t, received({ id: "email_gmail" }));
  await deliver({ email_id: "email_gmail", to: ["alice@gmail.example"], received_for: [`${alice.subdomain}@${DOMAIN}`] });
  assert.equal((await listMessages(alice.id)).length, 1);
});

test("the same email delivered twice is saved once", async (t) => {
  const alice = await photographer("Alice");
  fakeResend(t, received({ id: "email_twice" }));
  const to = [`${alice.subdomain}@${DOMAIN}`];
  await deliver({ email_id: "email_twice", to });
  assert.deepEqual(await (await deliver({ email_id: "email_twice", to })).json(), { result: "duplicate" });
  assert.equal((await listMessages(alice.id)).length, 1);
});

test("a sender reusing a Message-ID can't make someone else's mail vanish as a duplicate", async (t) => {
  const alice = await photographer("Alice");
  const bob = await photographer("Bobby");
  const shared = { message_id: "<same@attacker.example>" };
  fakeResend(t, received({ id: "email_a", ...shared }));
  await deliver({ email_id: "email_a", to: [`${alice.subdomain}@${DOMAIN}`] });
  t.mock.restoreAll();
  fakeResend(t, received({ id: "email_b", ...shared }));
  await deliver({ email_id: "email_b", to: [`${bob.subdomain}@${DOMAIN}`] });
  assert.equal((await listMessages(alice.id)).length, 1);
  assert.equal((await listMessages(bob.id)).length, 1);
});

test("a forged signature, a stale timestamp, a wrong key and a missing secret are all refused, and Resend isn't asked", async (t) => {
  const alice = await photographer("Alice");
  const calls = fakeResend(t, received());
  const data = { email_id: "email_1", to: [`${alice.subdomain}@${DOMAIN}`] };
  const body = JSON.stringify({ type: "email.received", data });
  const send = (headers: Record<string, string>) => POST(new Request("http://localhost/x", { method: "POST", body, headers }));
  assert.equal((await send({})).status, 401);
  assert.equal((await send(signed(body, nowSeconds(), Buffer.from("not the key")))).status, 401);
  assert.equal((await send(signed(body, nowSeconds() - 3600))).status, 401);
  assert.equal((await send({ ...signed(body), "svix-signature": "v1,AAAA" })).status, 401);
  assert.equal((await send(signed(`${body} `))).status, 401, "a signature for different bytes");
  delete process.env.MAIL_WEBHOOK_SECRET;
  assert.equal((await send(signed(body))).status, 401);
  assert.equal(calls.length, 0);
  assert.deepEqual(await listMessages(alice.id), []);
});

test("the signature check accepts any valid entry among several", () => {
  const body = "{}";
  const timestamp = nowSeconds();
  const good = signed(body, timestamp)["svix-signature"];
  const headers = { id: "msg_1", timestamp: String(timestamp), signature: `v1,AAAA ${good}` };
  assert.equal(verifyMailWebhook(body, headers, SECRET), true);
});

test("HTML mail is kept as plain text, with scripts, styles and links gone", async (t) => {
  const alice = await photographer("Alice");
  const html = `<html><head><style>p{}</style></head><body><p>Hello &amp; welcome</p><script>alert(1)</script><img src="https://evil.example/pixel.gif"><a href="https://evil.example">click</a></body></html>`;
  fakeResend(t, received({ id: "email_html", text: null, html }));
  await deliver({ email_id: "email_html", to: [`${alice.subdomain}@${DOMAIN}`] });
  const [message] = await listMessages(alice.id);
  assert.ok(message.body.startsWith("Hello & welcome"));
  for (const bad of ["alert(1)", "<", "evil.example", "p{}"]) assert.ok(!message.body.includes(bad), bad);
});

test("htmlToText handles entities and line breaks", () => {
  assert.equal(htmlToText("a<br>b&#33; &#x41;&nbsp;c"), "a\nb! A c");
});

test("addresses parse with or without a display name", () => {
  assert.deepEqual(parseAddress('"Sam Client" <SAM@Example.com>'), { name: "Sam Client", address: "sam@example.com" });
  assert.deepEqual(parseAddress("sam@example.com"), { name: "", address: "sam@example.com" });
});

test("a failed sender check is recorded", async (t) => {
  const alice = await photographer("Alice");
  fakeResend(t, received({ id: "email_spoof", authentication: { spf: "fail", dkim: "fail", dmarc: "fail" } }));
  await deliver({ email_id: "email_spoof", to: [`${alice.subdomain}@${DOMAIN}`] });
  assert.equal((await listMessages(alice.id))[0].senderCheck, "fail");
});

test("mail for an unknown name, another domain, a reserved name or an account with the agents off is ignored without fetching it", async (t) => {
  const alice = await makeUser("Alice");
  await claimMailbox(alice.id, alice.subdomain);
  const calls = fakeResend(t, received());
  for (const to of ["nobody-here@folio.test", `${alice.subdomain}@${DOMAIN}`, "someone@elsewhere.example", "postmaster@folio.test"]) {
    assert.deepEqual(await (await deliver({ email_id: `email_${to}`, to: [to] })).json(), { result: "ignored" }, to);
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(await listMessages(alice.id), []);
});

test("everything is off until MAIL_DOMAIN is set", async (t) => {
  const alice = await photographer("Alice");
  delete process.env.MAIL_DOMAIN;
  const calls = fakeResend(t, received());
  assert.deepEqual(await (await deliver({ email_id: "email_1", to: [`${alice.subdomain}@${DOMAIN}`] })).json(), { result: "ignored" });
  assert.equal(calls.length, 0);
});

test("support@ is forwarded to its inbox with the sender as Reply-To, and with attachments", async (t) => {
  process.env.MAIL_SYSTEM_FORWARDS = "support=owner@example.com, hello=owner@example.com";
  const calls = fakeResend(t, received({ id: "email_support" }), [{ filename: "a.pdf", download_url: "https://inbound.example/a.pdf" }]);
  const res = await deliver({ email_id: "email_support", to: [`support@${DOMAIN}`] });
  assert.deepEqual(await res.json(), { result: "forwarded" });
  const send = calls.find((c) => c.url.endsWith("/emails"))!;
  const sent = JSON.parse(String(send.init!.body));
  assert.equal(sent.from, `support@${DOMAIN}`);
  assert.deepEqual(sent.to, ["owner@example.com"]);
  assert.equal(sent.reply_to, "client@example.com");
  assert.ok(sent.text.includes("Are you free?"));
  assert.ok(sent.text.includes("client@example.com"));
  assert.deepEqual(sent.attachments, [{ filename: "a.pdf", path: "https://inbound.example/a.pdf" }]);
  assert.equal((send.init!.headers as Record<string, string>)["Idempotency-Key"], "forward-email_support-support");
});

test("when Resend can't be reached the webhook answers 500 so it is delivered again, logging no content", async (t) => {
  const logged: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => void logged.push(args));
  const alice = await photographer("Alice");
  t.mock.method(globalThis, "fetch", async () => new Response("no", { status: 503 }));
  const res = await deliver({ email_id: "email_down", to: [`${alice.subdomain}@${DOMAIN}`] });
  assert.equal(res.status, 500);
  assert.deepEqual(await listMessages(alice.id), []);
  assert.ok(!JSON.stringify(logged).includes(alice.subdomain));
});

test("other event types are ignored", async () => {
  const body = JSON.stringify({ type: "email.delivered", data: {} });
  const res = await POST(new Request("http://localhost/x", { method: "POST", body, headers: signed(body) }));
  assert.equal(res.status, 200);
});

test("bad JSON with a good signature is a 400", async () => {
  const body = "{not json";
  assert.equal((await POST(new Request("http://localhost/x", { method: "POST", body, headers: signed(body) }))).status, 400);
});
