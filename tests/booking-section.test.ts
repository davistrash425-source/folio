// The public "Book a date" section: the design type, who sees it, and the
// request form (submitBookingRequest in app/actions/booking-request.ts).
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { setAgentsAccess } from "../app/actions/admin.ts";
import { submitBookingRequest } from "../app/actions/booking-request.ts";
import { localDayRange } from "../lib/bookings.ts";
import { addConfirmedBooking, listAllBookings, updateUser } from "../lib/db.ts";
import {
  LOOKS,
  PAGE_TEMPLATES,
  THEMES,
  designSchema,
  newPage,
  newSection,
  presetDesign,
  readDesign,
  type PageTemplate,
  type SiteDesign,
} from "../lib/design.ts";
import { siteData } from "../lib/public-site.ts";
import { revalidated } from "./stubs/next-cache.ts";
import { captureEmails, formOf, fromIp, makeUser, redirectedTo, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.AGENTS_PAUSED;
});

// The rate limit counts per address, so each test visits from its own.
let visitor = 0;
const newVisitor = () => fromIp(`192.0.2.${++visitor}`);

const withAgents = async (name: string, extra: (u: Awaited<ReturnType<typeof makeUser>>) => void = () => {}) => {
  const user = await makeUser(name);
  return updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "test" };
    extra(u);
  });
};

// A date `days` ahead, as YYYY-MM-DD in UTC (always at least a day from today in any zone).
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const ask = (extra: Record<string, string> = {}) =>
  formOf({ name: "Sam Client", email: "sam@example.com", date: inDays(10), message: "A small wedding.", ...extra });

const sections = (d: SiteDesign) => d.pages.flatMap((p) => p.sections);

// ── The design type ─────────────────────────────────────────────────────

test("an old design with no booking section loads unchanged", () => {
  const saved = presetDesign("classic", "sepia");
  const loaded = readDesign(JSON.parse(JSON.stringify(saved)), "classic");
  assert.deepEqual(loaded, saved);
  assert.ok(!sections(loaded).some((s) => s.type === "booking"));
});

test("no preset or page template has a booking section", () => {
  for (const theme of THEMES) {
    for (const look of LOOKS) {
      assert.ok(!sections(presetDesign(theme, look)).some((s) => s.type === "booking"), `${theme} ${look}`);
    }
  }
  let n = 0;
  for (const template of Object.keys(PAGE_TEMPLATES) as PageTemplate[]) {
    const page = newPage(template, template, () => `id${++n}`);
    assert.ok(!page.sections.some((s) => s.type === "booking"), template);
  }
});

test("a design with a booking section validates and keeps it", () => {
  const design = presetDesign();
  design.pages[0].sections.push(newSection("booking", () => "book1"));
  const parsed = designSchema.safeParse(design);
  assert.ok(parsed.success, parsed.success ? "" : parsed.error.message);
  assert.deepEqual(parsed.data.pages[0].sections.at(-1), { id: "book1", type: "booking", visible: true, title: "" });
  assert.ok(sections(readDesign(JSON.parse(JSON.stringify(design)), "classic")).some((s) => s.type === "booking"));
});

// ── Who sees it ─────────────────────────────────────────────────────────

test("bookings are open only with the agents on", async () => {
  const off = await makeUser("Off");
  assert.equal(siteData(off)?.bookingsOpen, false);
  const on = await withAgents("On");
  assert.equal(siteData(on)?.bookingsOpen, true);
});

test("bookings close when the agents are paused or the site is suspended", async () => {
  const on = await withAgents("On");
  process.env.AGENTS_PAUSED = "1";
  assert.equal(siteData(on)?.bookingsOpen, false);
  delete process.env.AGENTS_PAUSED;
  const suspended = await withAgents("Held", (u) => {
    u.suspended = { at: new Date().toISOString(), reason: "test" };
  });
  assert.equal(siteData(suspended), null, "visitors see nothing at all");
  assert.equal(siteData(suspended, { preview: true })?.bookingsOpen, false);
});

test("switching the agents on or off refreshes the site's cache tag", async () => {
  const admin = await makeUser("Boss");
  const friend = await makeUser("Friend");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  for (const enabled of ["on", "off"]) {
    revalidated.length = 0;
    await redirectedTo(setAgentsAccess(formOf({ userId: friend.id, enabled })));
    assert.ok(revalidated.includes(`tag:site:${friend.subdomain}`), `agents ${enabled}`);
  }
});

// ── The request form ────────────────────────────────────────────────────

test("a request becomes an all-day request on that date in the photographer's zone", async (t) => {
  captureEmails(t);
  const zone = "Pacific/Auckland";
  const alice = await withAgents("Alice", (u) => (u.timeZone = zone));
  newVisitor();
  const date = inDays(10);
  const result = await submitBookingRequest(alice.subdomain, {}, ask({ date, message: "Line one\r\nLine two" }));
  assert.ok(result.ok, result.error);

  const [booking, ...rest] = await listAllBookings(alice.id);
  assert.equal(rest.length, 0);
  const day = localDayRange(date, zone);
  assert.equal(booking.startsAt, day.start.toISOString());
  assert.equal(booking.endsAt, day.end.toISOString());
  assert.equal(booking.allDay, true);
  assert.equal(booking.status, "requested");
  assert.equal(booking.source, "site");
  assert.equal(booking.kind, "booking");
  assert.equal(booking.title, "Request from Sam Client");
  assert.equal(booking.clientName, "Sam Client");
  assert.equal(booking.clientEmail, "sam@example.com");
  assert.equal(booking.notes, "Line one\nLine two");
});

test("a filled-in hidden field does nothing", async () => {
  const alice = await withAgents("Alice");
  newVisitor();
  const result = await submitBookingRequest(alice.subdomain, {}, ask({ company: "Spam Inc" }));
  assert.ok(result.ok);
  assert.deepEqual(await listAllBookings(alice.id), []);
});

test("a date that has passed is refused", async () => {
  const alice = await withAgents("Alice");
  newVisitor();
  const result = await submitBookingRequest(alice.subdomain, {}, ask({ date: inDays(-2) }));
  assert.match(result.error ?? "", /hasn't passed/);
  assert.deepEqual(await listAllBookings(alice.id), []);
});

test("a date more than two years away is refused", async () => {
  const alice = await withAgents("Alice");
  newVisitor();
  const result = await submitBookingRequest(alice.subdomain, {}, ask({ date: inDays(365 * 2 + 5) }));
  assert.match(result.error ?? "", /two years/);
  assert.deepEqual(await listAllBookings(alice.id), []);
  assert.ok((await submitBookingRequest(alice.subdomain, {}, ask({ date: inDays(365 * 2 - 5) }))).ok);
});

test("something that isn't a date, or has no name or email, is refused", async () => {
  const alice = await withAgents("Alice");
  newVisitor();
  for (const bad of [{ date: "tomorrow" }, { date: "2030-02-31" }, { name: " " }, { email: "nope" }] as Record<string, string>[]) {
    assert.ok((await submitBookingRequest(alice.subdomain, {}, ask(bad))).error, JSON.stringify(bad));
  }
  assert.deepEqual(await listAllBookings(alice.id), []);
});

test("an account without the agents refuses, and so does a site that isn't live", async () => {
  const plain = await makeUser("Plain");
  const draft = await withAgents("Draft");
  await updateUser(draft.id, (u) => (u.published = false));
  const paused = await withAgents("Paused");
  newVisitor();
  for (const owner of [plain, draft]) {
    const result = await submitBookingRequest(owner.subdomain, {}, ask());
    assert.equal(result.error, "This site isn't taking bookings.", owner.subdomain);
    assert.deepEqual(await listAllBookings(owner.id), []);
  }
  process.env.AGENTS_PAUSED = "1";
  assert.equal((await submitBookingRequest(paused.subdomain, {}, ask())).error, "This site isn't taking bookings.");
  assert.equal((await submitBookingRequest("nobody-has-this", {}, ask())).error, "This site isn't taking bookings.");
  assert.deepEqual(await listAllBookings(paused.id), []);
});

test("a taken date is refused without saying who has it", async (t) => {
  captureEmails(t);
  const zone = "America/Los_Angeles";
  const alice = await withAgents("Alice", (u) => (u.timeZone = zone));
  const date = inDays(12);
  const day = localDayRange(date, zone);
  await addConfirmedBooking({
    userId: alice.id,
    kind: "booking",
    clientName: "Zelda Secretname",
    clientEmail: "zelda@example.com",
    title: "Zelda Secretname wedding",
    notes: "",
    startsAt: day.start,
    endsAt: day.end,
    allDay: true,
    source: "manual",
  });
  newVisitor();
  const result = await submitBookingRequest(alice.subdomain, {}, ask({ date }));
  assert.deepEqual(result, { error: "That date isn't available. Please choose another." });
  assert.ok(!JSON.stringify(result).includes("Zelda"));
  assert.equal((await listAllBookings(alice.id)).filter((b) => b.status === "requested").length, 0);
});

test("a date with only a pending request is still open", async (t) => {
  captureEmails(t);
  const alice = await withAgents("Alice");
  const date = inDays(15);
  newVisitor();
  assert.ok((await submitBookingRequest(alice.subdomain, {}, ask({ date, name: "First Person" }))).ok);
  assert.ok((await submitBookingRequest(alice.subdomain, {}, ask({ date, name: "Second Person" }))).ok);
  assert.equal((await listAllBookings(alice.id)).length, 2);
});

test("the sixth request in an hour from one address is turned away", async (t) => {
  captureEmails(t);
  const alice = await withAgents("Alice");
  newVisitor();
  for (let i = 0; i < 5; i++) assert.ok((await submitBookingRequest(alice.subdomain, {}, ask())).ok, `request ${i + 1}`);
  const sixth = await submitBookingRequest(alice.subdomain, {}, ask());
  assert.match(sixth.error ?? "", /several requests/);
  assert.equal((await listAllBookings(alice.id)).length, 5);
});

test("the photographer is emailed, with the client as the reply address", async (t) => {
  const emails = captureEmails(t);
  const alice = await withAgents("Alice", (u) => (u.profile.contactEmail = "studio@alice-photo.example"));
  newVisitor();
  const date = inDays(20);
  assert.ok((await submitBookingRequest(alice.subdomain, {}, ask({ date }))).ok);
  const mail = emails.join("\n");
  assert.match(mail, /To: studio@alice-photo\.example/);
  assert.match(mail, /Reply-To: sam@example\.com/);
  assert.match(mail, /Subject: New booking request from Sam Client/);
  assert.match(mail, new RegExp(date));
  assert.match(mail, /A small wedding\./);
  assert.match(mail, /\/dashboard\/manage\/calendar/);
});

test("the request is kept, and the client's words aren't logged, if the email can't be sent", async (t) => {
  const alice = await withAgents("Alice");
  newVisitor();
  const errors: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => void errors.push(args));
  const old = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" }); // there's no email provider connected
  t.after(() => {
    if (old === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: old });
  });

  const result = await submitBookingRequest(alice.subdomain, {}, ask({ message: "Private wedding details" }));
  assert.ok(result.ok);
  assert.equal((await listAllBookings(alice.id)).length, 1);
  assert.equal(errors.length, 1);
  const logged = JSON.stringify(errors);
  assert.ok(!logged.includes("Private wedding details") && !logged.includes("Sam Client") && !logged.includes("sam@example.com"));
});
