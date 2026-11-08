// The Inbox for accounts with the agents on. Rendering isn't practical in
// plain Node, so these check the pure helpers in lib/messages.ts, the data the
// page reads, and the source of the files for the safety rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Message } from "../lib/db.ts";
import { filterThreadsByLabel, latestPerThread, parseInboxLabel, waitingLabel } from "../lib/messages.ts";

let n = 0;
function msg(extra: Partial<Message>): Message {
  n++;
  return {
    id: `m${n}`, userId: "u", channel: "email", direction: "in", threadKey: `t${n}`, providerId: null,
    fromName: "", fromAddress: "a@example.com", toAddress: "", subject: "Hi", body: "Hello", askedDate: "",
    senderCheck: null, rfcMessageId: null, photoId: null, read: false, label: null, kind: null, summary: null,
    suggestedAction: null, processedAt: null, repliedAt: null, createdAt: new Date(2026, 10, n).toISOString(),
    ...extra,
  };
}

test("a thread with several messages shows once, by its latest message, newest thread first", () => {
  const a1 = msg({ threadKey: "a", createdAt: "2026-11-01T10:00:00Z" });
  const b1 = msg({ threadKey: "b", createdAt: "2026-11-02T10:00:00Z" });
  const a2 = msg({ threadKey: "a", direction: "out", createdAt: "2026-11-03T10:00:00Z" });
  const threads = latestPerThread([a1, b1, a2]);
  assert.deepEqual(threads.map((t) => t.threadKey), ["a", "b"]);
  assert.equal(threads[0].latest.id, a2.id);
  assert.equal(threads[0].latestIncoming?.id, a1.id);
  assert.equal(threads[0].count, 2);
});

test("a thread counts as unread while any incoming message in it is unread", () => {
  const read = msg({ threadKey: "a", read: true });
  const unread = msg({ threadKey: "a", read: false });
  const sent = msg({ threadKey: "b", direction: "out", read: false });
  const [a, b] = latestPerThread([read, unread, sent]).sort((x, y) => x.threadKey.localeCompare(y.threadKey));
  assert.equal(a.unread, true);
  assert.equal(b.unread, false);
});

test("filtering by label keeps only threads whose newest incoming message has it", () => {
  const urgent = msg({ threadKey: "u", label: "URGENT" });
  const scam = msg({ threadKey: "s", label: "LIKELY SCAM" });
  const plain = msg({ threadKey: "p" });
  const threads = latestPerThread([urgent, scam, plain]);
  assert.deepEqual(filterThreadsByLabel(threads, "URGENT").map((t) => t.threadKey), ["u"]);
  assert.equal(filterThreadsByLabel(threads, "REPLY SOON").length, 0);
  assert.equal(filterThreadsByLabel(threads, null).length, 3);
});

test("an unknown label in the address is ignored", () => {
  assert.equal(parseInboxLabel("URGENT"), "URGENT");
  assert.equal(parseInboxLabel("LIKELY SCAM"), "LIKELY SCAM");
  assert.equal(parseInboxLabel("<script>"), null);
  assert.equal(parseInboxLabel(undefined), null);
  assert.equal(parseInboxLabel(["URGENT"]), null);
});

test("waitingLabel counts how long an unanswered incoming message has waited", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const at = (iso: string, extra: Partial<Message> = {}) => msg({ createdAt: iso, ...extra });
  assert.equal(waitingLabel(at("2026-11-08T12:00:00Z"), now), "Waiting 2 days");
  assert.equal(waitingLabel(at("2026-11-09T11:00:00Z"), now), "Waiting 1 day");
  assert.equal(waitingLabel(at("2026-11-10T09:00:00Z"), now), "Waiting 3 hours");
  assert.equal(waitingLabel(at("2026-11-10T11:30:00Z"), now), "Waiting less than an hour");
});

test("waitingLabel says nothing for sent or already answered messages", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  assert.equal(waitingLabel(msg({ direction: "out", createdAt: "2026-11-01T00:00:00Z" }), now), null);
  assert.equal(waitingLabel(msg({ createdAt: "2026-11-01T00:00:00Z", repliedAt: "2026-11-02T00:00:00Z" }), now), null);
});

test("the inbox files never use dangerouslySetInnerHTML or turn sender text into a link", () => {
  for (const file of ["agent-inbox.tsx", "thread-actions.tsx"]) {
    const source = readFileSync(new URL(`../app/dashboard/manage/messages/${file}`, import.meta.url), "utf8");
    assert.ok(!source.includes("dangerouslySetInnerHTML"), file);
    assert.ok(!/mailto:|<a\s/.test(source), `${file} has a raw link`);
  }
});

test("the page keeps the old Messages output for accounts with the agents off", () => {
  const source = readFileSync(new URL("../app/dashboard/manage/messages/page.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(agentsEnrolled\(user\)\) return <AgentInbox/);
  assert.match(source, /<Inbox inquiries=\{inquiries\}/);
  assert.match(source, /<EmptyInbox user=\{user\}/);
  // The default export stays sync and reads the session only inside Suspense.
  assert.match(source, /export default function MessagesPage/);
  assert.ok(!/export default async/.test(source));
});

test("the Messages link counts unread messages only when the agents are on", () => {
  const source = readFileSync(new URL("../app/dashboard/manage/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /agentsEnrolled\(user\) \? await unreadMessageCount\(user\.id\) : \(user\.inquiries/);
});
