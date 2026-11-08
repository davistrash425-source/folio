// Time zones and availability for bookings. Reads the database, never writes
// to it. Availability is exact: it comes from these functions and SQL, never
// from an AI.
import { bookingRequestsOverlapping, bookingsBlocking, type Booking } from "./db";

export function isValidTimeZone(timeZone: string) {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// The zone's offset from UTC at an instant, in milliseconds.
function offsetAt(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

// The UTC instant for a wall-clock time in a zone. A local time that doesn't
// exist (clocks jumped forward) moves forward to the first valid instant; one
// that happens twice (clocks went back) uses the earlier instant.
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Offsets on either side of the wall time (no zone changes by more than a
  // day), then every candidate instant whose local reading is the wall time.
  const before = offsetAt(wall - 86_400_000, timeZone);
  const after = offsetAt(wall + 86_400_000, timeZone);
  const matches = [...new Set([before, after])]
    .map((offset) => wall - offset)
    .filter((instant) => offsetAt(instant, timeZone) === wall - instant)
    .sort((a, b) => a - b);
  if (matches.length) return new Date(matches[0]);
  // Skipped: find the moment the clocks jumped (offset changes between the
  // two candidates), which is the first valid instant after the gap.
  let lo = wall - after;
  let hi = wall - before;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (offsetAt(mid, timeZone) === after) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}

function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// Local midnight to the next local midnight (23 or 25 hours on change days).
export function localDayRange(date: string, timeZone: string) {
  return { start: localToUtc(date, "00:00", timeZone), end: localToUtc(nextDay(date), "00:00", timeZone) };
}

// e.g. "Sat, Jun 6, 2026, 2:00 PM"
export function formatInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const MAX_RANGE_MS = 31 * 86_400_000;

// An error message, or null when the range is fine.
export function validRange(start: Date, end: Date) {
  if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return "The dates aren't valid.";
  }
  if (end.getTime() <= start.getTime()) return "The end has to be after the start.";
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) return "A range can be at most 31 days long.";
  return null;
}

export type BookingSummary = Pick<Booking, "id" | "kind" | "title" | "clientName" | "startsAt" | "endsAt" | "allDay" | "status">;

const summary = (b: Booking): BookingSummary => ({
  id: b.id,
  kind: b.kind,
  title: b.title,
  clientName: b.clientName,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  allDay: b.allDay,
  status: b.status,
});

// Whether the range is free. Only confirmed or moved bookings (and holds)
// count; pending requests are listed separately and never make it busy.
export async function checkAvailability(userId: string, startsAt: Date, endsAt: Date, excludeId?: string) {
  const [conflicts, requests] = await Promise.all([
    bookingsBlocking(userId, startsAt, endsAt, excludeId),
    bookingRequestsOverlapping(userId, startsAt, endsAt, excludeId),
  ]);
  return { free: conflicts.length === 0, conflicts: conflicts.map(summary), requests: requests.map(summary) };
}

export function conflictSentence(conflict: BookingSummary, timeZone: string) {
  const name = conflict.title || conflict.clientName;
  const what = name ? `"${name}"` : "another booking";
  const start = new Date(conflict.startsAt);
  // An all-day booking starts at midnight, which would read like a real time.
  const when = conflict.allDay
    ? new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(start)
    : formatInZone(start, timeZone);
  return `Clashes with ${what} (${when})`;
}
