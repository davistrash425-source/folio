// Bookings: exact availability, clashes, who can touch what, and time zones.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { GET as exportAccount } from "../app/api/export/route.ts";
import { checkAvailability, conflictSentence, formatInZone, isValidTimeZone, localDayRange, localToUtc, validRange } from "../lib/bookings.ts";
import {
  addConfirmedBooking,
  bookingRequestsOverlapping,
  bookingsBlocking,
  cancelBooking,
  confirmBooking,
  createBookingRequest,
  deleteOrphanedAgentRows,
  deleteUser,
  findBooking,
  listAllBookings,
  listBookings,
  moveBooking,
  updateUser,
  type Booking,
  type BookingResult,
} from "../lib/db.ts";
import { databaseText, makeUser, readZip, resetRequest, signInAs } from "./helpers.ts";

afterEach(() => resetRequest());

const at = (s: string) => new Date(`2026-06-06T${s}:00Z`);
const times = (from: string, to: string) => ({ startsAt: at(from), endsAt: at(to), allDay: false });
const fields = { clientName: "Maya", clientEmail: "maya@example.com", notes: "", source: "manual" as const };

async function confirmed(userId: string, from: string, to: string, title = "A shoot", kind: "booking" | "hold" = "booking") {
  const result = await addConfirmedBooking({ userId, kind, title, ...fields, ...times(from, to) });
  assert.ok(result.ok, "the booking should have been added");
  return (result as { ok: true; booking: Booking }).booking;
}

function request(userId: string, from: string, to: string, title = "A request") {
  return createBookingRequest({ userId, title, ...fields, ...times(from, to) });
}

function reason(result: BookingResult) {
  return result.ok ? "ok" : result.reason;
}

test("a shoot that overlaps an existing one in any shape is a clash", async () => {
  const alice = await makeUser("Alice");
  await confirmed(alice.id, "10:00", "14:00");
  for (const [from, to] of [
    ["11:00", "12:00"], // inside
    ["09:00", "16:00"], // around
    ["09:00", "11:00"], // starts before
    ["13:00", "15:00"], // ends after
    ["10:00", "14:00"], // exact
  ]) {
    const result = await addConfirmedBooking({ userId: alice.id, kind: "booking", title: "x", ...fields, ...times(from, to) });
    assert.equal(reason(result), "conflict", `${from}-${to}`);
  }
});

test("a shoot ending at 14:00 doesn't clash with one starting at 14:00", async () => {
  const alice = await makeUser("Alice");
  await confirmed(alice.id, "10:00", "14:00");
  await confirmed(alice.id, "14:00", "16:00");
  await confirmed(alice.id, "08:00", "10:00");
  assert.equal((await bookingsBlocking(alice.id, at("14:00"), at("15:00"))).length, 1);
  assert.equal((await checkAvailability(alice.id, at("16:00"), at("17:00"))).free, true);
});

test("a request doesn't block the date, but is listed as pending on it", async () => {
  const alice = await makeUser("Alice");
  const pending = await request(alice.id, "10:00", "14:00");
  const availability = await checkAvailability(alice.id, at("11:00"), at("12:00"));
  assert.equal(availability.free, true);
  assert.deepEqual(availability.conflicts, []);
  assert.deepEqual(availability.requests.map((r) => r.id), [pending.id]);
  assert.equal((await bookingRequestsOverlapping(alice.id, at("11:00"), at("12:00"))).length, 1);
  assert.equal((await bookingRequestsOverlapping(alice.id, at("11:00"), at("12:00"), pending.id)).length, 0);
  await confirmed(alice.id, "11:00", "12:00");
});

test("a hold blocks the date like a booking", async () => {
  const alice = await makeUser("Alice");
  await confirmed(alice.id, "10:00", "14:00", "Keep free", "hold");
  const availability = await checkAvailability(alice.id, at("12:00"), at("13:00"));
  assert.equal(availability.free, false);
  assert.equal(availability.conflicts[0].kind, "hold");
});

test("a cancelled booking doesn't block the date", async () => {
  const alice = await makeUser("Alice");
  const booking = await confirmed(alice.id, "10:00", "14:00");
  assert.equal((await checkAvailability(alice.id, at("12:00"), at("13:00"))).free, false);
  assert.equal(reason(await cancelBooking(alice.id, booking.id)), "ok");
  assert.equal((await checkAvailability(alice.id, at("12:00"), at("13:00"))).free, true);
  await confirmed(alice.id, "12:00", "13:00");
});

test("moving a shoot onto a confirmed booking returns a conflict naming it and changes nothing", async () => {
  const alice = await makeUser("Alice");
  const wedding = await confirmed(alice.id, "10:00", "14:00", "Sarah and Tom's wedding");
  const shoot = await confirmed(alice.id, "15:00", "16:00", "Maya's shoot");
  const before = await databaseText();
  const result = await moveBooking(alice.id, shoot.id, times("12:00", "13:00"));
  assert.ok(!result.ok && result.reason === "conflict");
  assert.deepEqual(result.conflicts.map((c) => c.id), [wedding.id]);
  assert.ok(conflictSentence(result.conflicts[0], "UTC").includes("Sarah and Tom's wedding"));
  assert.equal(await databaseText(), before);
});

test("moving Maya's shoot onto a wedding day returns a conflict naming that booking", async () => {
  const alice = await makeUser("Alice");
  await confirmed(alice.id, "09:00", "18:00", "Sarah and Tom's wedding");
  const other = await addConfirmedBooking({
    userId: alice.id, kind: "booking", title: "Maya's shoot", ...fields,
    startsAt: new Date("2026-06-07T10:00:00Z"), endsAt: new Date("2026-06-07T11:00:00Z"), allDay: false,
  });
  assert.ok(other.ok);
  const result = await moveBooking(alice.id, other.booking.id, { startsAt: at("12:00"), endsAt: at("13:00"), allDay: false });
  assert.ok(!result.ok && result.reason === "conflict");
  assert.equal(
    conflictSentence(result.conflicts[0], "America/New_York"),
    `Clashes with "Sarah and Tom's wedding" (Sat, Jun 6, 2026, 5:00 AM)`,
  );
});

test("a conflict sentence falls back to the client's name, then to another booking", () => {
  const base = { id: "x", kind: "booking" as const, startsAt: "2026-06-06T18:00:00.000Z", endsAt: "2026-06-06T19:00:00.000Z", allDay: false, status: "confirmed" as const };
  assert.equal(conflictSentence({ ...base, title: "", clientName: "Maya" }, "UTC"), `Clashes with "Maya" (Sat, Jun 6, 2026, 6:00 PM)`);
  assert.equal(conflictSentence({ ...base, title: "", clientName: "" }, "UTC"), "Clashes with another booking (Sat, Jun 6, 2026, 6:00 PM)");
});

test("a booking moved within its own time isn't a clash with itself", async () => {
  const alice = await makeUser("Alice");
  const booking = await confirmed(alice.id, "10:00", "14:00");
  const result = await moveBooking(alice.id, booking.id, times("11:00", "15:00"));
  assert.ok(result.ok);
  assert.equal(result.booking.status, "moved");
  assert.equal(result.booking.startsAt, at("11:00").toISOString());
  assert.equal((await checkAvailability(alice.id, at("10:00"), at("14:00"), booking.id)).free, true);
});

test("moving a request needs no clash check and it stays a request", async () => {
  const alice = await makeUser("Alice");
  await confirmed(alice.id, "10:00", "14:00");
  const pending = await request(alice.id, "15:00", "16:00");
  const result = await moveBooking(alice.id, pending.id, times("11:00", "12:00"));
  assert.ok(result.ok);
  assert.equal(result.booking.status, "requested");
});

test("confirming a request that now clashes fails and leaves it a request", async () => {
  const alice = await makeUser("Alice");
  const pending = await request(alice.id, "10:00", "14:00");
  const other = await confirmed(alice.id, "13:00", "15:00", "Taken");
  const result = await confirmBooking(alice.id, pending.id);
  assert.ok(!result.ok && result.reason === "conflict");
  assert.deepEqual(result.conflicts.map((c) => c.id), [other.id]);
  assert.equal((await findBooking(alice.id, pending.id))!.status, "requested");
});

test("two confirmations for one date at the same moment: exactly one succeeds", async () => {
  const alice = await makeUser("Alice");
  const first = await request(alice.id, "10:00", "14:00");
  const second = await request(alice.id, "12:00", "16:00");
  const results = await Promise.all([confirmBooking(alice.id, first.id), confirmBooking(alice.id, second.id)]);
  assert.deepEqual(results.map(reason).sort(), ["conflict", "ok"]);
  const direct = await Promise.all([
    addConfirmedBooking({ userId: alice.id, kind: "booking", title: "a", ...fields, ...times("18:00", "19:00") }),
    addConfirmedBooking({ userId: alice.id, kind: "booking", title: "b", ...fields, ...times("18:30", "19:30") }),
  ]);
  assert.deepEqual(direct.map(reason).sort(), ["conflict", "ok"]);
});

test("wrong status and missing bookings give their own results", async () => {
  const alice = await makeUser("Alice");
  const booking = await confirmed(alice.id, "10:00", "11:00");
  assert.equal(reason(await confirmBooking(alice.id, booking.id)), "wrong_status");
  assert.equal(reason(await cancelBooking(alice.id, booking.id)), "ok");
  assert.equal(reason(await cancelBooking(alice.id, booking.id)), "wrong_status");
  assert.equal(reason(await moveBooking(alice.id, booking.id, times("12:00", "13:00"))), "wrong_status");
  assert.equal(reason(await confirmBooking(alice.id, "nope")), "not_found");
  assert.equal(reason(await moveBooking(alice.id, "nope", times("12:00", "13:00"))), "not_found");
  assert.equal(reason(await cancelBooking(alice.id, "nope")), "not_found");
  assert.equal(await findBooking(alice.id, "nope"), null);
});

test("listing returns anything overlapping the range in order, cancelled included", async () => {
  const alice = await makeUser("Alice");
  const late = await confirmed(alice.id, "15:00", "16:00");
  const early = await confirmed(alice.id, "08:00", "09:00");
  const gone = await confirmed(alice.id, "09:30", "10:30");
  await cancelBooking(alice.id, gone.id);
  await confirmed(alice.id, "20:00", "21:00");
  const listed = await listBookings(alice.id, { from: at("08:30"), to: at("15:30") });
  assert.deepEqual(listed.map((b) => b.id), [early.id, gone.id, late.id]);
  assert.equal(listed[1].status, "cancelled");
});

test("one account can't find, list, move, confirm or cancel another's booking, and its bookings don't block", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bobby");
  const booking = await confirmed(alice.id, "10:00", "14:00");
  const pending = await request(alice.id, "15:00", "16:00");
  const before = await databaseText();
  assert.equal(await findBooking(bob.id, booking.id), null);
  assert.deepEqual(await listBookings(bob.id, { from: at("00:00"), to: at("23:59") }), []);
  assert.equal(reason(await moveBooking(bob.id, booking.id, times("11:00", "12:00"))), "not_found");
  assert.equal(reason(await confirmBooking(bob.id, pending.id)), "not_found");
  assert.equal(reason(await cancelBooking(bob.id, booking.id)), "not_found");
  assert.equal(await databaseText(), before);
  assert.equal((await checkAvailability(bob.id, at("11:00"), at("12:00"))).free, true);
  assert.deepEqual((await checkAvailability(bob.id, at("15:00"), at("16:00"))).requests, []);
  await confirmed(bob.id, "10:00", "14:00");
});

test("deleting an account removes its bookings, and a legal hold keeps them", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bobby");
  const held = await makeUser("Carol");
  await confirmed(alice.id, "10:00", "11:00");
  await confirmed(bob.id, "10:00", "11:00");
  await confirmed(held.id, "10:00", "11:00");
  await updateUser(held.id, (u) => (u.legalHold = { at: new Date().toISOString(), note: "case" }));
  await deleteUser(alice.id);
  await assert.rejects(deleteUser(held.id), /LEGAL_HOLD/);
  assert.equal((await listAllBookings(alice.id)).length, 0);
  assert.equal((await listAllBookings(bob.id)).length, 1);
  assert.equal((await listAllBookings(held.id)).length, 1);
});

test("a booking written after its account was deleted is swept up", async () => {
  const alice = await makeUser("Alice");
  await deleteUser(alice.id);
  await request(alice.id, "10:00", "11:00");
  assert.equal(await deleteOrphanedAgentRows(), 1);
  assert.equal((await listAllBookings(alice.id)).length, 0);
});

test("the export has bookings.json with every booking of the account, cancelled too", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bobby");
  const gone = await confirmed(alice.id, "10:00", "11:00", "Cancelled one");
  await cancelBooking(alice.id, gone.id);
  await request(alice.id, "12:00", "13:00", "Still a request");
  await confirmed(bob.id, "10:00", "11:00", "Bob's private shoot");
  await signInAs(alice);
  const files = readZip(Buffer.from(await (await exportAccount()).arrayBuffer()));
  const text = files.get("bookings.json")!.toString();
  const list = JSON.parse(text) as Booking[];
  assert.deepEqual(list.map((b) => b.title).sort(), ["Cancelled one", "Still a request"]);
  assert.ok(!text.includes("Bob's private shoot"));
});

test("an invalid time zone is rejected", () => {
  assert.equal(isValidTimeZone("America/New_York"), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Mars/Olympus"), false);
  assert.equal(isValidTimeZone(""), false);
});

test("local times convert to UTC on ordinary days in New York and Lisbon", () => {
  assert.equal(localToUtc("2026-06-06", "14:00", "America/New_York").toISOString(), "2026-06-06T18:00:00.000Z");
  assert.equal(localToUtc("2026-01-15", "14:00", "America/New_York").toISOString(), "2026-01-15T19:00:00.000Z");
  assert.equal(localToUtc("2026-06-06", "14:00", "Europe/Lisbon").toISOString(), "2026-06-06T13:00:00.000Z");
  assert.equal(localToUtc("2026-01-15", "14:00", "Europe/Lisbon").toISOString(), "2026-01-15T14:00:00.000Z");
  assert.equal(formatInZone(localToUtc("2026-06-06", "14:00", "America/New_York"), "America/New_York"), "Sat, Jun 6, 2026, 2:00 PM");
});

test("a skipped local hour moves forward to the first valid instant", () => {
  // New York, 8 March 2026: 02:00 to 03:00 doesn't exist.
  assert.equal(localToUtc("2026-03-08", "01:59", "America/New_York").toISOString(), "2026-03-08T06:59:00.000Z");
  assert.equal(localToUtc("2026-03-08", "02:00", "America/New_York").toISOString(), "2026-03-08T07:00:00.000Z");
  assert.equal(localToUtc("2026-03-08", "02:30", "America/New_York").toISOString(), "2026-03-08T07:00:00.000Z");
  assert.equal(localToUtc("2026-03-08", "03:00", "America/New_York").toISOString(), "2026-03-08T07:00:00.000Z");
  // Lisbon, 29 March 2026: 01:00 to 02:00 doesn't exist.
  assert.equal(localToUtc("2026-03-29", "01:30", "Europe/Lisbon").toISOString(), "2026-03-29T01:00:00.000Z");
  assert.equal(localToUtc("2026-03-29", "02:00", "Europe/Lisbon").toISOString(), "2026-03-29T01:00:00.000Z");
});

test("a repeated local hour uses the earlier instant", () => {
  // New York, 1 November 2026: 01:00 to 02:00 happens twice.
  assert.equal(localToUtc("2026-11-01", "01:30", "America/New_York").toISOString(), "2026-11-01T05:30:00.000Z");
  assert.equal(localToUtc("2026-11-01", "00:30", "America/New_York").toISOString(), "2026-11-01T04:30:00.000Z");
  assert.equal(localToUtc("2026-11-01", "02:00", "America/New_York").toISOString(), "2026-11-01T07:00:00.000Z");
  // Lisbon, 25 October 2026: 01:00 to 02:00 happens twice.
  assert.equal(localToUtc("2026-10-25", "01:30", "Europe/Lisbon").toISOString(), "2026-10-25T00:30:00.000Z");
});

test("a local day is 23 hours when clocks go forward and 25 when they go back", () => {
  const hours = (date: string, zone: string) => {
    const { start, end } = localDayRange(date, zone);
    return (end.getTime() - start.getTime()) / 3_600_000;
  };
  assert.equal(hours("2026-06-06", "America/New_York"), 24);
  assert.equal(hours("2026-03-08", "America/New_York"), 23);
  assert.equal(hours("2026-11-01", "America/New_York"), 25);
  assert.equal(hours("2026-03-29", "Europe/Lisbon"), 23);
  assert.equal(hours("2026-10-25", "Europe/Lisbon"), 25);
  assert.equal(localDayRange("2026-03-08", "America/New_York").start.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(localDayRange("2026-12-31", "UTC").end.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("a range must end after it starts, be real dates, and be at most 31 days", () => {
  const day = 86_400_000;
  const start = new Date("2026-06-01T00:00:00Z");
  assert.equal(validRange(start, new Date(start.getTime() + 3600_000)), null);
  assert.equal(validRange(start, new Date(start.getTime() + 31 * day)), null);
  assert.ok(validRange(start, new Date(start.getTime() + 31 * day + 1)));
  assert.ok(validRange(start, start));
  assert.ok(validRange(start, new Date(start.getTime() - 1)));
  assert.ok(validRange(new Date("nope"), start));
  assert.ok(validRange(start, new Date("nope")));
});
