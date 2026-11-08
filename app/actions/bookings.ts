"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/actions/site";
import { impersonationBlock, requireUser } from "@/lib/auth";
import { addConfirmedBooking, cancelBooking, confirmBooking, moveBooking, updateUser, type BookingResult, type User } from "@/lib/db";
import { conflictSentence, isValidTimeZone, localDayRange, localToUtc, validRange } from "@/lib/bookings";
import { agentsAllowed } from "@/lib/plans";

// The photographer's own clicks on the Calendar page. They are not agent
// suggestions, so they don't go through approvals.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Browsers count a textarea's line break as one character but submit two.
const text = (formData: FormData, key: string, max: number) =>
  String(formData.get(key) ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

function realDate(date: string) {
  if (!DATE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

// The instants a form describes, or an error.
function readRange(formData: FormData, timeZone: string) {
  const date = text(formData, "date", 10);
  if (!realDate(date)) return { error: "Choose a date." };
  if (formData.get("allDay") === "on" || formData.get("allDay") === "true") {
    const { start, end } = localDayRange(date, timeZone);
    return { startsAt: start, endsAt: end, allDay: true };
  }
  const startTime = text(formData, "startTime", 5);
  const endTime = text(formData, "endTime", 5);
  if (!TIME.test(startTime) || !TIME.test(endTime)) return { error: "Enter the start and end times as hours and minutes." };
  const startsAt = localToUtc(date, startTime, timeZone);
  const endsAt = localToUtc(date, endTime, timeZone);
  const invalid = validRange(startsAt, endsAt);
  if (invalid) return { error: invalid };
  return { startsAt, endsAt, allDay: false };
}

function failure(result: Extract<BookingResult, { ok: false }>, timeZone: string): ActionState {
  if (result.reason === "conflict") return { error: conflictSentence(result.conflicts[0], timeZone) };
  if (result.reason === "wrong_status") return { error: "That booking can't be changed any more." };
  return { error: "That booking wasn't found." };
}

async function guard() {
  // This check first: an impersonation cookie expiring between the two can
  // then only leave the admin's own account, never the target's.
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked } as const;
  const user = await requireUser();
  if (!agentsAllowed(user)) return { error: "Folio AGENTS isn't available on this account." } as const;
  return { user } as const;
}

const zoneOf = (user: User) => user.timeZone ?? "UTC";

export async function addBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const { user } = g;
  const timeZone = zoneOf(user);
  const kind = formData.get("kind") === "hold" ? "hold" : "booking";
  const title = text(formData, "title", 120);
  const clientName = text(formData, "clientName", 120);
  const clientEmail = text(formData, "clientEmail", 200);
  const notes = text(formData, "notes", 2000);
  if (clientEmail && !EMAIL.test(clientEmail)) return { error: "That email address doesn't look right." };
  if (!title && !clientName) return { error: "Give it a title or a client's name." };
  const range = readRange(formData, timeZone);
  if ("error" in range) return { error: range.error };
  const result = await addConfirmedBooking({
    userId: user.id,
    kind,
    title,
    clientName,
    clientEmail,
    notes,
    startsAt: range.startsAt,
    endsAt: range.endsAt,
    allDay: range.allDay,
    source: "manual",
  });
  if (!result.ok) return failure(result, timeZone);
  revalidatePath("/dashboard", "layout");
  return { ok: kind === "hold" ? "Hold added." : "Booking added." };
}

export async function confirmBookingAction(id: string): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const result = await confirmBooking(g.user.id, String(id));
  if (!result.ok) return failure(result, zoneOf(g.user));
  revalidatePath("/dashboard", "layout");
  return { ok: "Confirmed." };
}

export async function cancelBookingAction(id: string): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const result = await cancelBooking(g.user.id, String(id));
  if (!result.ok) return failure(result, zoneOf(g.user));
  revalidatePath("/dashboard", "layout");
  return { ok: "Cancelled." };
}

export async function moveBookingAction(id: string, formData: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const timeZone = zoneOf(g.user);
  const range = readRange(formData, timeZone);
  if ("error" in range) return { error: range.error };
  const result = await moveBooking(g.user.id, String(id), range);
  if (!result.ok) return failure(result, timeZone);
  revalidatePath("/dashboard", "layout");
  return { ok: "Moved." };
}

export async function setTimeZone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const timeZone = text(formData, "timeZone", 100);
  if (!isValidTimeZone(timeZone)) return { error: "That isn't a time zone Folio knows." };
  await updateUser(
    g.user.id,
    (u) => {
      u.timeZone = timeZone;
    },
    { publicChange: false },
  );
  revalidatePath("/dashboard", "layout");
  return { ok: "Time zone saved." };
}
