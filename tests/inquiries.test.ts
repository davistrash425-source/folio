// The contact form on a photographer's public site (the sendInquiry action).
// Visitors aren't signed in, and the message lands in someone else's account,
// so it matters that it reaches the right one and nothing else.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { sendInquiry } from "../app/actions/site.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { addInquiry, captureEmails, formOf, fromIp, makeUser, resetRequest, signInAs, signOut } from "./helpers.ts";

beforeEach(resetRequest);

// The contact form as a visitor fills it in.
const message = (extra: Record<string, string> = {}) =>
  formOf({ name: "Sam Client", email: "sam@example.com", date: "June 12", message: "Are you free that day?", ...extra });

// The rate limit counts per address, so each test visits from its own.
let visitor = 0;
const newVisitor = () => fromIp(`198.51.100.${++visitor}`);

const inbox = async (userId: string) => (await findUserById(userId))!.inquiries ?? [];

test("a visitor's message goes to the owner of that site, and no one else", async (t) => {
  const emails = captureEmails(t);
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  await updateUser(alice.id, (u) => (u.profile.contactEmail = "bookings@alice-photo.example"));
  signOut();
  newVisitor();

  assert.deepEqual(await sendInquiry(alice.subdomain, {}, message()), { ok: "Thanks — your message was sent." });

  const [sent, ...others] = await inbox(alice.id);
  assert.equal(others.length, 0);
  assert.equal(sent.name, "Sam Client");
  assert.equal(sent.email, "sam@example.com");
  assert.equal(sent.date, "June 12");
  assert.equal(sent.message, "Are you free that day?");
  assert.equal(sent.read, false);
  assert.ok(Date.parse(sent.createdAt));
  assert.deepEqual(await inbox(bob.id), []);

  const mail = emails.join("\n");
  assert.match(mail, /To: bookings@alice-photo\.example/);
  assert.match(mail, /Reply-To: sam@example\.com/);
  assert.match(mail, /Subject: New inquiry from Sam Client/);
  assert.match(mail, /Are you free that day\?/);
});

test("it goes to the owner even when the visitor is signed in as someone else", async (t) => {
  captureEmails(t);
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  await signInAs(bob);
  newVisitor();

  await sendInquiry(alice.subdomain, {}, message());
  assert.equal((await inbox(alice.id)).length, 1);
  assert.deepEqual(await inbox(bob.id), []);
});

test("with no public contact address, the owner's login email is used", async (t) => {
  const emails = captureEmails(t);
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => (u.profile.contactEmail = ""));
  newVisitor();
  await sendInquiry(alice.subdomain, {}, message());
  assert.match(emails.join("\n"), new RegExp(`To: ${alice.email}`));
});

test("new messages are added at the top", async (t) => {
  captureEmails(t);
  const alice = await makeUser("Alice");
  newVisitor();
  await sendInquiry(alice.subdomain, {}, message({ message: "first" }));
  await sendInquiry(alice.subdomain, {}, message({ message: "second" }));
  assert.deepEqual((await inbox(alice.id)).map((i) => i.message), ["second", "first"]);
});

test("sites that are offline or don't exist take no messages", async (t) => {
  captureEmails(t);
  const offline = await makeUser("Offline", { published: false });
  const online = await makeUser("Online");
  newVisitor();
  const refused = { error: "This site isn't accepting messages." };

  assert.deepEqual(await sendInquiry(offline.subdomain, {}, message()), refused);
  assert.deepEqual(await sendInquiry("no-such-site", {}, message()), refused);
  assert.deepEqual(await inbox(offline.id), []);
  assert.deepEqual(await inbox(online.id), []);
});

test("addresses ignore capital letters", async (t) => {
  captureEmails(t);
  const alice = await makeUser("Alice");
  newVisitor();
  await sendInquiry(alice.subdomain.toUpperCase(), {}, message());
  assert.equal((await inbox(alice.id)).length, 1);
});

test("bots that fill in the hidden field are told it worked, but nothing is saved or sent", async (t) => {
  const emails = captureEmails(t);
  const alice = await makeUser("Alice");
  newVisitor();
  const result = await sendInquiry(alice.subdomain, {}, message({ company: "Buy cheap watches" }));
  assert.deepEqual(result, { ok: "Thanks — your message was sent." });
  assert.deepEqual(await inbox(alice.id), []);
  assert.deepEqual(emails, []);
});

test("a message needs a name, some text and a real email address", async (t) => {
  const emails = captureEmails(t);
  const alice = await makeUser("Alice");
  newVisitor();
  const needsNameAndMessage = { error: "Please add your name and a message." };
  const needsEmail = { error: "Please enter a valid email so they can reply." };

  assert.deepEqual(await sendInquiry(alice.subdomain, {}, message({ name: "  " })), needsNameAndMessage);
  assert.deepEqual(await sendInquiry(alice.subdomain, {}, message({ message: "" })), needsNameAndMessage);
  for (const email of ["", "not-an-email", "a b@example.com", "sam@example", "@example.com"]) {
    assert.deepEqual(await sendInquiry(alice.subdomain, {}, message({ email })), needsEmail, email);
  }
  assert.deepEqual(await inbox(alice.id), []);
  assert.deepEqual(emails, []);
});

test("one visitor can send five messages an hour; the sixth is refused", async (t) => {
  captureEmails(t);
  const alice = await makeUser("Alice");
  newVisitor();
  for (let i = 1; i <= 5; i++) {
    assert.ok((await sendInquiry(alice.subdomain, {}, message({ message: `message ${i}` }))).ok, `message ${i}`);
  }
  assert.deepEqual(await sendInquiry(alice.subdomain, {}, message()), {
    error: "You've sent several messages already. Please try again later.",
  });
  assert.equal((await inbox(alice.id)).length, 5);

  newVisitor(); // somebody else
  assert.ok((await sendInquiry(alice.subdomain, {}, message())).ok);
  assert.equal((await inbox(alice.id)).length, 6);
});

test("long text is cut to the limits", async (t) => {
  captureEmails(t);
  const alice = await makeUser("Alice");
  newVisitor();
  await sendInquiry(alice.subdomain, {}, message({ name: "N".repeat(500), date: "D".repeat(500), message: "M".repeat(10_000) }));
  const [sent] = await inbox(alice.id);
  assert.deepEqual([sent.name.length, sent.date.length, sent.message.length], [80, 80, 4000]);
});

test("an email address too long to be real is refused rather than cut short", async (t) => {
  captureEmails(t);
  const alice = await makeUser("Alice");
  newVisitor();
  const result = await sendInquiry(alice.subdomain, {}, message({ email: `${"e".repeat(300)}@example.com` }));
  assert.equal(result.ok, undefined);
  assert.deepEqual(await inbox(alice.id), []);
});

test("the inbox keeps the newest 500 messages", async (t) => {
  captureEmails(t);
  const alice = await makeUser("Alice");
  for (let i = 0; i < 500; i++) await addInquiry(alice.id, `old ${i}`);
  newVisitor();

  await sendInquiry(alice.subdomain, {}, message({ message: "the newest" }));
  const messages = (await inbox(alice.id)).map((i) => i.message);
  assert.equal(messages.length, 500);
  assert.equal(messages[0], "the newest");
  assert.ok(!messages.includes("old 0"), "the oldest message was dropped");
});

test("a visitor's name can't add extra lines to the email's headers", async (t) => {
  const emails = captureEmails(t);
  const alice = await makeUser("Alice");
  newVisitor();
  await sendInquiry(alice.subdomain, {}, message({ name: "Sam\r\nBcc: victim@example.com\nX-Spam: yes" }));

  const mail = emails.join("\n");
  const headers = mail.split("\n\n")[0].split("\n");
  assert.ok(!headers.some((line) => line.startsWith("Bcc:") || line.startsWith("X-Spam:")), mail);
  assert.match(mail, /Subject: New inquiry from Sam Bcc: victim@example\.com X-Spam: yes/);
});

test("the message is kept even if the email can't be sent", async (t) => {
  const alice = await makeUser("Alice");
  newVisitor();
  const errors: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => void errors.push(args));
  const old = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" }); // there's no email provider connected yet
  t.after(() => {
    if (old === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: old });
  });

  assert.ok((await sendInquiry(alice.subdomain, {}, message())).ok);
  assert.equal((await inbox(alice.id)).length, 1);
  assert.equal(errors.length, 1);
});
