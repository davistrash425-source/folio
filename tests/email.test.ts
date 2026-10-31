// Sending email through Resend (lib/email.ts). The network is faked.
import { afterEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { sendEmail } from "../lib/email.ts";

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

function fakeResend(t: TestContext, status = 200) {
  const sent: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    sent.push({ url, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) });
    return new Response(status === 200 ? '{"id":"1"}' : '{"message":"bad key"}', { status });
  });
  return sent;
}

test("with Resend set up, email is sent through it", async (t) => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Folio <hello@folio.example>";
  const sent = fakeResend(t);
  await sendEmail({ to: "alice@example.com", subject: "Hi", text: "Body", replyTo: "sam@example.com" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "https://api.resend.com/emails");
  assert.equal(sent[0].headers.get("authorization"), "Bearer re_test");
  assert.deepEqual(sent[0].body, {
    from: "Folio <hello@folio.example>",
    to: ["alice@example.com"],
    subject: "Hi",
    text: "Body",
    reply_to: "sam@example.com",
  });
});

test("line breaks are taken out of addresses and the subject before sending", async (t) => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "hello@folio.example";
  const sent = fakeResend(t);
  await sendEmail({ to: "a@example.com\nBcc: x@y.com", subject: "One\r\ntwo", text: "Line one\nline two" });
  assert.deepEqual(sent[0].body.to, ["a@example.com Bcc: x@y.com"]);
  assert.equal(sent[0].body.subject, "One two");
  assert.equal(sent[0].body.text, "Line one\nline two", "the message itself keeps its lines");
  assert.equal("reply_to" in sent[0].body, false);
});

test("if Resend refuses, sending fails loudly", async (t) => {
  process.env.RESEND_API_KEY = "re_bad";
  process.env.EMAIL_FROM = "hello@folio.example";
  fakeResend(t, 401);
  await assert.rejects(sendEmail({ to: "a@example.com", subject: "Hi", text: "x" }), /401 .*bad key/);
});

test("without Resend, development prints the email instead", async (t) => {
  const fetchCalls = fakeResend(t);
  const printed: string[] = [];
  t.mock.method(console, "log", (line: string) => void printed.push(line));
  await sendEmail({ to: "a@example.com", subject: "Hi", text: "x" });
  assert.equal(fetchCalls.length, 0);
  assert.match(printed[0], /To: a@example\.com/);
});

test("the email call carries a timeout so a hung provider can't stall a request", async (t) => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "hello@folio.example";
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit = {}) => {
    signal = init.signal ?? undefined;
    return new Response('{"id":"1"}');
  });
  await sendEmail({ to: "a@example.com", subject: "Hi", text: "x" });
  assert.ok(signal instanceof AbortSignal, "the fetch has an abort signal");
});
