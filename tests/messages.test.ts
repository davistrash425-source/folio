// The message store for accounts with the agents on (lib/messages.ts and the
// messages functions in lib/db.ts), and how the contact form and the admin
// switch use it. Accounts with the agents off keep User.inquiries.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { setAgentsAccess } from "../app/actions/admin.ts";
import { sendInquiry } from "../app/actions/site.ts";
import { GET as exportAccount } from "../app/api/export/route.ts";
import {
  deleteMessage,
  deleteOrphanedAgentRows,
  deleteUser,
  findMessage,
  findUserById,
  listAllMessages,
  listMessages,
  listThread,
  markMessageReplied,
  recordMessageReading,
  saveMessage,
  setMessageRead,
  unreadMessageCount,
  updateUser,
} from "../lib/db.ts";
import { copyInquiriesToMessages, saveIncomingMessage, threadKeyFor } from "../lib/messages.ts";
import { addInquiry, captureEmails, formOf, fromIp, makeUser, readZip, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

async function withAgents(name = "Alice") {
  const user = await makeUser(name);
  return updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "staff@example.com" };
  });
}

const incoming = (userId: string, extra: Partial<Parameters<typeof saveIncomingMessage>[0]> = {}) =>
  saveIncomingMessage({ userId, channel: "email", fromAddress: "sam@example.com", subject: "Wedding", body: "Hello", ...extra });

const form = (extra: Record<string, string> = {}) =>
  formOf({ name: "Sam Client", email: "sam@example.com", date: "June 12", message: "Are you free that day?", ...extra });

let visitor = 0;
const newVisitor = () => fromIp(`203.0.113.${++visitor}`);

test("the same message delivered twice is saved once and the second time reports it was not created", async () => {
  const alice = await withAgents();
  const first = await incoming(alice.id, { providerId: "mail-1" });
  const second = await incoming(alice.id, { providerId: "mail-1" });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.message.id, first.message.id);
  assert.equal((await listAllMessages(alice.id)).length, 1);
});

test("messages without a provider id are always saved", async () => {
  const alice = await withAgents();
  await incoming(alice.id);
  await incoming(alice.id);
  assert.equal((await listAllMessages(alice.id)).length, 2);
});

test("one account can't find, list, change or delete another account's messages", async () => {
  const alice = await withAgents("Alice");
  const bob = await withAgents("Bob");
  const { message } = await incoming(alice.id, { providerId: "a-1" });

  assert.equal(await findMessage(bob.id, message.id), null);
  assert.deepEqual(await listMessages(bob.id), []);
  assert.deepEqual(await listThread(bob.id, message.threadKey), []);
  assert.deepEqual(await listAllMessages(bob.id), []);

  await setMessageRead(bob.id, message.id, true);
  await recordMessageReading(bob.id, message.id, { label: "URGENT", kind: "other", summary: "s", suggestedAction: "a" });
  await markMessageReplied(bob.id, message.id);
  await deleteMessage(bob.id, message.id);

  const still = (await findMessage(alice.id, message.id))!;
  assert.equal(still.read, false);
  assert.equal(still.label, null);
  assert.equal(still.processedAt, null);
  assert.equal(still.repliedAt, null);
  assert.equal(await unreadMessageCount(bob.id), 0);
  assert.equal(await unreadMessageCount(alice.id), 1);
});

test("an account can read, label, mark and delete its own messages", async () => {
  const alice = await withAgents();
  const { message } = await incoming(alice.id);
  await setMessageRead(alice.id, message.id, true);
  assert.equal(await unreadMessageCount(alice.id), 0);
  await recordMessageReading(alice.id, message.id, { label: "URGENT", kind: "booking_request", summary: "Wants June 12", suggestedAction: "Reply" });
  await markMessageReplied(alice.id, message.id);
  const read = (await findMessage(alice.id, message.id))!;
  assert.equal(read.label, "URGENT");
  assert.equal(read.kind, "booking_request");
  assert.ok(read.processedAt && read.repliedAt);
  assert.equal((await listMessages(alice.id, { label: "URGENT" })).length, 1);
  assert.equal((await listMessages(alice.id, { label: "LIKELY SCAM" })).length, 0);
  await deleteMessage(alice.id, message.id);
  assert.equal(await findMessage(alice.id, message.id), null);
});

test("thread keys group Re and Fwd variants of a subject and separate different senders", () => {
  const key = threadKeyFor("Sam@Example.com", "Wedding");
  assert.equal(threadKeyFor("sam@example.com", "Re: Wedding"), key);
  assert.equal(threadKeyFor("sam@example.com", "  RE: re:  FWD: fw: wedding "), key);
  assert.equal(threadKeyFor("sam@example.com", "Fw:  Wedding"), key);
  assert.notEqual(threadKeyFor("kim@example.com", "Wedding"), key);
  assert.notEqual(threadKeyFor("sam@example.com", "Engagement"), key);
  assert.equal(threadKeyFor("sam@example.com", ""), "sam@example.com|");
});

test("a thread lists its messages oldest first", async () => {
  const alice = await withAgents();
  await incoming(alice.id, { subject: "Re: Wedding", body: "second", createdAt: "2026-05-02T10:00:00Z" });
  await incoming(alice.id, { subject: "Wedding", body: "first", createdAt: "2026-05-01T10:00:00Z" });
  await incoming(alice.id, { fromAddress: "kim@example.com", subject: "Wedding", body: "other sender" });
  const thread = await listThread(alice.id, threadKeyFor("sam@example.com", "Wedding"));
  assert.deepEqual(thread.map((m) => m.body), ["first", "second"]);
});

test("long fields are cut to their limits and line endings are normalised", async () => {
  const alice = await withAgents();
  const { message } = await saveIncomingMessage({
    userId: alice.id,
    channel: "email",
    fromName: "n".repeat(300),
    fromAddress: "a".repeat(400),
    toAddress: "t".repeat(400),
    subject: "s".repeat(600),
    body: "line one\r\nline two\r" + "b".repeat(60_000),
  });
  assert.equal(message.fromName.length, 200);
  assert.equal(message.fromAddress.length, 320);
  assert.equal(message.toAddress.length, 320);
  assert.equal(message.subject.length, 500);
  assert.equal(message.body.length, 50_000);
  assert.ok(message.body.startsWith("line one\nline two\n"));
  assert.equal(message.direction, "in");
});

test("an account with the agents on gets a site message in messages, not in inquiries, and the owner is still emailed", async (t) => {
  const emails = captureEmails(t);
  const alice = await withAgents();
  signOut();
  newVisitor();

  assert.deepEqual(await sendInquiry(alice.subdomain, {}, form()), { ok: "Thanks — your message was sent." });

  const [m, ...others] = await listAllMessages(alice.id);
  assert.equal(others.length, 0);
  assert.equal(m.channel, "site_form");
  assert.equal(m.direction, "in");
  assert.equal(m.fromName, "Sam Client");
  assert.equal(m.fromAddress, "sam@example.com");
  assert.equal(m.subject, "Message from your site");
  assert.equal(m.body, "Are you free that day?");
  assert.equal(m.askedDate, "June 12");
  assert.equal(m.read, false);
  assert.deepEqual((await findUserById(alice.id))!.inquiries ?? [], []);

  const mail = emails.join("\n");
  assert.match(mail, /Subject: New inquiry from Sam Client/);
  assert.match(mail, /Are you free that day\?/);
  assert.match(mail, /\/dashboard\/manage\/messages/);
});

test("an account with the agents off still gets inquiries and no messages", async (t) => {
  const emails = captureEmails(t);
  const alice = await makeUser("Alice");
  signOut();
  newVisitor();

  await sendInquiry(alice.subdomain, {}, form());

  const inquiries = (await findUserById(alice.id))!.inquiries ?? [];
  assert.equal(inquiries.length, 1);
  assert.equal(inquiries[0].message, "Are you free that day?");
  assert.deepEqual(await listAllMessages(alice.id), []);
  assert.match(emails.join("\n"), /Subject: New inquiry from Sam Client/);
});

test("copying inquiries keeps their read state and dates, and running it twice adds nothing", async () => {
  const alice = await makeUser("Alice");
  await addInquiry(alice.id, "Are you free in May?");
  await updateUser(alice.id, (u) => {
    u.inquiries![0].read = true;
    u.inquiries![0].createdAt = "2026-03-04T05:06:07.000Z";
    u.inquiries![0].date = "May 9";
    u.inquiries![0].photoId = "photo-1";
  });
  await addInquiry(alice.id, "Second one");

  const user = (await findUserById(alice.id))!;
  await copyInquiriesToMessages(user);
  await copyInquiriesToMessages((await findUserById(alice.id))!);

  const messages = await listAllMessages(alice.id);
  assert.equal(messages.length, 2);
  const copied = messages.find((m) => m.body === "Are you free in May?")!;
  assert.equal(copied.read, true);
  assert.equal(copied.createdAt, "2026-03-04T05:06:07.000Z");
  assert.equal(copied.askedDate, "May 9");
  assert.equal(copied.photoId, "photo-1");
  assert.equal(copied.channel, "site_form");
  assert.equal(copied.fromName, "A client");
  assert.equal(copied.fromAddress, "client@example.com");
  assert.equal(messages.find((m) => m.body === "Second one")!.read, false);
  assert.equal((await findUserById(alice.id))!.inquiries!.length, 2, "the inquiries are not removed");
});

test("switching the agents on copies the account's inquiries into messages", async () => {
  const boss = await makeUser("Boss");
  const alice = await makeUser("Alice");
  await addInquiry(alice.id, "Before the agents");
  process.env.ADMIN_EMAILS = boss.email;
  await signInAs(boss);

  await redirectedTo(setAgentsAccess(formOf({ userId: alice.id, enabled: "on" })));

  const messages = await listAllMessages(alice.id);
  assert.deepEqual(messages.map((m) => m.body), ["Before the agents"]);
});

test("deleting an account removes its messages, but a legal hold keeps them", async () => {
  const alice = await withAgents("Alice");
  const bob = await withAgents("Bob");
  await incoming(alice.id);
  await incoming(bob.id);

  await updateUser(bob.id, (u) => {
    u.legalHold = { at: new Date().toISOString(), note: "case" };
  });
  await assert.rejects(deleteUser(bob.id), /LEGAL_HOLD/);
  assert.equal((await listAllMessages(bob.id)).length, 1);

  await deleteUser(alice.id);
  assert.equal((await listAllMessages(alice.id)).length, 0);
  assert.equal((await listAllMessages(bob.id)).length, 1);
});

test("a message written after its account was deleted is swept up, and other accounts' stay", async () => {
  const alice = await withAgents("Alice");
  const bob = await withAgents("Bob");
  await incoming(bob.id);
  await deleteUser(alice.id);
  await saveMessage({ userId: alice.id, channel: "email", direction: "in", threadKey: "k", body: "too late" });
  assert.ok((await deleteOrphanedAgentRows()) >= 1);
  assert.equal((await listAllMessages(alice.id)).length, 0);
  assert.equal((await listAllMessages(bob.id)).length, 1);
});

test("the export holds the account's messages in messages.json", async () => {
  const alice = await withAgents();
  const bob = await withAgents("Bob");
  await incoming(alice.id, { body: "my own words" });
  await incoming(bob.id, { body: "someone else's words" });
  await signInAs(alice);
  const files = readZip(Buffer.from(await (await exportAccount()).arrayBuffer()));
  const text = files.get("messages.json")!.toString();
  assert.ok(text.includes("my own words"));
  assert.ok(!text.includes("someone else's words"));
});
