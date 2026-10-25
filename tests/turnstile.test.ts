import { beforeEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { signup } from "../app/actions/auth.ts";
import { sendInquiry } from "../app/actions/site.ts";
import { findUserByEmail } from "../lib/db.ts";
import { verifyTurnstile } from "../lib/turnstile.ts";
import { formOf, fromIp, makeUser, resetRequest } from "./helpers.ts";

beforeEach(() => resetRequest());

function turnstileOn(t: TestContext, answer: () => Response) {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site";
  process.env.TURNSTILE_SECRET_KEY = "secret";
  t.after(() => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
  });
  const sent: { url: string; body: Record<string, string> }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    return answer();
  });
  return sent;
}

const person = () => Response.json({ success: true });
const robot = () => Response.json({ success: false, "error-codes": ["invalid-input-response"] });

test("without Turnstile set up, nothing is checked", async () => {
  assert.equal(await verifyTurnstile(null, "local"), true);
});

test("a visitor who passes is let through, and Cloudflare is asked with the secret and address", async (t) => {
  const sent = turnstileOn(t, person);
  assert.equal(await verifyTurnstile("good-token", "203.0.113.5"), true);
  assert.equal(sent[0].url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.deepEqual(sent[0].body, { secret: "secret", response: "good-token", remoteip: "203.0.113.5" });
});

test("a missing or rejected token fails", async (t) => {
  const sent = turnstileOn(t, robot);
  assert.equal(await verifyTurnstile(null, "local"), false);
  assert.equal(await verifyTurnstile("", "local"), false);
  assert.equal(sent.length, 0, "no token means Cloudflare isn't even asked");
  assert.equal(await verifyTurnstile("bad-token", "local"), false);
});

test("if Cloudflare can't be reached, people aren't shut out", async (t) => {
  turnstileOn(t, () => new Response("down", { status: 503 }));
  t.mock.method(console, "error", () => {});
  assert.equal(await verifyTurnstile("token", "local"), true);
});

test("sign-up without a passing check creates no account", async (t) => {
  turnstileOn(t, robot);
  fromIp("203.0.113.40");
  const result = await signup({}, formOf({ name: "Bot", email: "bot@example.com", password: "password123", subdomain: "botsite" }));
  assert.match(result.error!, /person/);
  assert.equal(await findUserByEmail("bot@example.com"), null);
});

test("a contact message without a passing check is refused and saved nowhere", async (t) => {
  turnstileOn(t, robot);
  const owner = await makeUser("Alice");
  fromIp("203.0.113.41");
  const result = await sendInquiry(owner.subdomain, {}, formOf({ name: "Bot", email: "bot@example.com", message: "buy now" }));
  assert.match(result.error!, /person/);
});
