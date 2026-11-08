import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as adminActions from "../app/actions/admin.ts";
import {
  addBooking,
  cancelBookingAction,
  confirmBookingAction,
  moveBookingAction,
  setTimeZone,
} from "../app/actions/bookings.ts";
import { createBookingRequest, findBooking, findUserById, listAllBookings, updateUser } from "../lib/db.ts";
import { revalidated } from "./stubs/next-cache.ts";
import { formOf, makeUser, redirectedTo, resetRequest, signInAs } from "./helpers.ts";

afterEach(() => {
  resetRequest();
  delete process.env.ADMIN_EMAILS;
});

async function photographer(name = "Alice", timeZone = "America/New_York") {
  const user = await makeUser(name);
  return updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "test" };
    u.timeZone = timeZone;
  });
}

const timed = (extra: Record<string, string> = {}) =>
  formOf({ kind: "booking", title: "Wedding", clientName: "Sam", date: "2030-06-01", startTime: "14:00", endTime: "16:00", ...extra });

const request = (userId: string) =>
  createBookingRequest({
    userId,
    clientName: "Kim",
    clientEmail: "kim@example.com",
    title: "Portraits",
    notes: "",
    startsAt: new Date("2030-07-01T15:00:00Z"),
    endsAt: new Date("2030-07-01T16:00:00Z"),
    allDay: false,
    source: "site",
  });

const zoneOf = async (id: string) => (await findUserById(id))?.timeZone;

test("every calendar action refuses when Folio AGENTS is off", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const b = await request(alice.id);
  const refused = [
    await addBooking({}, timed()),
    await confirmBookingAction(b.id),
    await cancelBookingAction(b.id),
    await moveBookingAction(b.id, timed()),
    await setTimeZone({}, formOf({ timeZone: "Europe/Paris" })),
  ];
  for (const r of refused) assert.equal(r.error, "Folio AGENTS isn't available on this account.");
  assert.equal((await findBooking(alice.id, b.id))?.status, "requested");
  assert.equal((await listAllBookings(alice.id)).length, 1);
  assert.equal(await zoneOf(alice.id), undefined);
});

test("staff viewing an account as its owner can't change its calendar", async () => {
  const admin = await makeUser("Boss");
  const alice = await photographer();
  const b = await request(alice.id);
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  await redirectedTo(adminActions.startImpersonation(formOf({ userId: alice.id, reason: "Helping with a support ticket" })));
  const results = [
    await addBooking({}, timed()),
    await confirmBookingAction(b.id),
    await cancelBookingAction(b.id),
    await moveBookingAction(b.id, timed()),
    await setTimeZone({}, formOf({ timeZone: "Europe/Paris" })),
  ];
  for (const r of results) assert.ok(r.error);
  assert.equal((await findBooking(alice.id, b.id))?.status, "requested");
  assert.equal((await listAllBookings(alice.id)).length, 1);
  assert.equal(await zoneOf(alice.id), "America/New_York");
});

test("one photographer can't confirm, move or cancel another's booking", async () => {
  const alice = await photographer();
  const bob = await photographer("Bobby");
  const b = await request(alice.id);
  await signInAs(bob);
  assert.ok((await confirmBookingAction(b.id)).error);
  assert.ok((await moveBookingAction(b.id, timed())).error);
  assert.ok((await cancelBookingAction(b.id)).error);
  assert.equal((await findBooking(alice.id, b.id))?.status, "requested");
});

test("adding a timed and an all-day booking uses the account's time zone", async () => {
  const alice = await photographer();
  await signInAs(alice);
  assert.deepEqual(await addBooking({}, timed()), { ok: "Booking added." });
  assert.deepEqual(await addBooking({}, timed({ title: "Day off", date: "2030-06-02", allDay: "on" })), { ok: "Booking added." });
  const [wedding, day] = await listAllBookings(alice.id);
  // 14:00 and 16:00 in New York in June are 18:00 and 20:00 UTC.
  assert.equal(wedding.startsAt, "2030-06-01T18:00:00.000Z");
  assert.equal(wedding.endsAt, "2030-06-01T20:00:00.000Z");
  assert.equal(wedding.status, "confirmed");
  assert.equal(day.allDay, true);
  assert.equal(day.startsAt, "2030-06-02T04:00:00.000Z");
  assert.equal(day.endsAt, "2030-06-03T04:00:00.000Z");
});

test("a booking that clashes names the other booking and adds nothing", async () => {
  const alice = await photographer();
  await signInAs(alice);
  await addBooking({}, timed());
  const r = await addBooking({}, timed({ title: "Other", startTime: "15:00", endTime: "17:00" }));
  assert.match(r.error ?? "", /Clashes with "Wedding"/);
  assert.equal((await listAllBookings(alice.id)).length, 1);
});

test("a hold blocks a later booking", async () => {
  const alice = await photographer();
  await signInAs(alice);
  assert.deepEqual(await addBooking({}, timed({ kind: "hold", title: "Keep free" })), { ok: "Hold added." });
  const r = await addBooking({}, timed({ title: "Late", startTime: "14:30", endTime: "15:30" }));
  assert.match(r.error ?? "", /Clashes with "Keep free"/);
});

test("a bad date, a bad time and an end before the start are refused", async () => {
  const alice = await photographer();
  await signInAs(alice);
  assert.ok((await addBooking({}, timed({ date: "2030-02-30" }))).error);
  assert.ok((await addBooking({}, timed({ date: "June 1" }))).error);
  assert.ok((await addBooking({}, timed({ startTime: "25:00" }))).error);
  assert.ok((await addBooking({}, timed({ endTime: "4pm" }))).error);
  assert.equal((await addBooking({}, timed({ startTime: "16:00", endTime: "14:00" }))).error, "The end has to be after the start.");
  assert.ok((await addBooking({}, timed({ clientEmail: "not an email" }))).error);
  assert.equal((await listAllBookings(alice.id)).length, 0);
});

test("setTimeZone refuses a junk zone, and a good one doesn't refresh the public site", async () => {
  const alice = await photographer();
  await signInAs(alice);
  assert.ok((await setTimeZone({}, formOf({ timeZone: "Mars/Olympus" }))).error);
  assert.equal(await zoneOf(alice.id), "America/New_York");
  revalidated.length = 0;
  assert.deepEqual(await setTimeZone({}, formOf({ timeZone: "Europe/Paris" })), { ok: "Time zone saved." });
  assert.equal(await zoneOf(alice.id), "Europe/Paris");
  assert.ok(!revalidated.some((r) => r.startsWith("tag:site:")));
});

test("confirming a request and cancelling a booking change their status", async () => {
  const alice = await photographer();
  await signInAs(alice);
  const b = await request(alice.id);
  assert.deepEqual(await confirmBookingAction(b.id), { ok: "Confirmed." });
  assert.equal((await findBooking(alice.id, b.id))?.status, "confirmed");
  assert.deepEqual(await cancelBookingAction(b.id), { ok: "Cancelled." });
  assert.equal((await findBooking(alice.id, b.id))?.status, "cancelled");
  assert.ok((await confirmBookingAction(b.id)).error);
});

test("moving a booking changes its time and a clash is refused", async () => {
  const alice = await photographer();
  await signInAs(alice);
  await addBooking({}, timed());
  await addBooking({}, timed({ title: "Second", startTime: "18:00", endTime: "19:00" }));
  const [first, second] = await listAllBookings(alice.id);
  assert.match((await moveBookingAction(second.id, timed({ startTime: "15:00", endTime: "17:00" }))).error ?? "", /Clashes with "Wedding"/);
  assert.deepEqual(await moveBookingAction(second.id, timed({ startTime: "20:00", endTime: "21:00" })), { ok: "Moved." });
  const moved = await findBooking(alice.id, second.id);
  assert.equal(moved?.status, "moved");
  assert.equal(moved?.startsAt, "2030-06-02T00:00:00.000Z");
  assert.equal((await findBooking(alice.id, first.id))?.startsAt, "2030-06-01T18:00:00.000Z");
});
