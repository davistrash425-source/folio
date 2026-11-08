import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { formatInZone, localDayRange } from "@/lib/bookings";
import { listAllBookings, listBookings, type Booking } from "@/lib/db";
import { agentsAllowed } from "@/lib/plans";
import { Card, Loading, PageHeader } from "../section";
import { AddBookingForm, BookingActions, TimeZoneForm } from "./calendar-forms";

export const metadata = { title: "Calendar — Folio" };

export default function CalendarPage(props: PageProps<"/dashboard/manage/calendar">) {
  return (
    <>
      <PageHeader title="Calendar" subtitle="Bookings, requests and holds. Only confirmed bookings and holds block a date." />
      <Suspense fallback={<Loading />}>
        <Calendar searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateIn = (instant: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(instant);
const timeIn = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);

function parseMonth(value: string | undefined, fallback: string) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? "");
  return m ? { y: Number(m[1]), m: Number(m[2]) } : { y: Number(fallback.slice(0, 4)), m: Number(fallback.slice(5, 7)) };
}

const shift = (y: number, m: number, by: number) => {
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
};
const key = (p: { y: number; m: number }) => `${p.y}-${pad(p.m)}`;

function describe(b: Booking, timeZone: string) {
  const start = new Date(b.startsAt);
  if (b.allDay) return `${formatInZone(start, timeZone).split(",").slice(0, 2).join(",")}, all day`;
  return `${formatInZone(start, timeZone)} to ${timeIn(new Date(b.endsAt), timeZone)}`;
}

const label = (b: Booking) => b.title || b.clientName || (b.kind === "hold" ? "Hold" : "Booking");

async function Calendar({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const user = await requireUser();
  if (!agentsAllowed(user)) notFound();
  const timeZone = user.timeZone ?? "UTC";
  const now = new Date();
  const today = dateIn(now, timeZone);
  const raw = (await searchParams).month;
  const { y, m } = parseMonth(Array.isArray(raw) ? raw[0] : raw, today);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = `${y}-${pad(m)}-01`;
  const last = `${y}-${pad(m)}-${pad(days)}`;
  const monthBookings = (
    await listBookings(user.id, { from: localDayRange(first, timeZone).start, to: localDayRange(last, timeZone).end })
  ).filter((b) => b.status !== "cancelled");
  const byDay = Array.from({ length: days }, (_, i) => {
    const date = `${y}-${pad(m)}-${pad(i + 1)}`;
    const range = localDayRange(date, timeZone);
    const items = monthBookings.filter((b) => new Date(b.startsAt) < range.end && new Date(b.endsAt) > range.start);
    return { date, n: i + 1, items };
  });
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const title = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  const prev = shift(y, m, -1);
  const next = shift(y, m, 1);

  const upcoming = (await listAllBookings(user.id)).filter((b) => b.status !== "cancelled" && new Date(b.endsAt) > now);
  const requests = upcoming.filter((b) => b.status === "requested");
  const booked = upcoming.filter((b) => b.status !== "requested");
  const fields = (b: Booking) => {
    const start = new Date(b.startsAt);
    return { date: dateIn(start, timeZone), startTime: timeIn(start, timeZone), endTime: timeIn(new Date(b.endsAt), timeZone), allDay: b.allDay };
  };

  return (
    <>
      <Card title="Time zone" subtitle="Times on this page, and the agents' answers about availability, use this zone.">
        <TimeZoneForm current={user.timeZone ?? null} />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href={`?month=${key(prev)}`} className="text-sm text-ink-soft hover:text-ink">← Previous</Link>
          <h2 className="font-medium">{title}</h2>
          <Link href={`?month=${key(next)}`} className="text-sm text-ink-soft hover:text-ink">Next →</Link>
        </div>
        {/* A grid from tablets up; on phones, just the days that have something. */}
        <div className="hidden grid-cols-7 gap-px border border-rule bg-rule md:grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="label bg-card px-2 py-1 text-ink-faint">{d}</div>
          ))}
          {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} className="bg-paper" />)}
          {byDay.map((d) => (
            <div
              key={d.date}
              aria-current={d.date === today ? "date" : undefined}
              className={`min-h-20 bg-paper p-1.5 text-xs ${d.date === today ? "outline outline-2 -outline-offset-2 outline-accent" : ""}`}
            >
              <p className={d.date === today ? "font-medium text-accent" : "text-ink-faint"}>{d.n}{d.date === today ? " · today" : ""}</p>
              <ul className="mt-1 space-y-0.5">
                {d.items.map((b) => (
                  <li
                    key={b.id}
                    className={`truncate px-1 ${b.status === "requested" ? "border border-dashed border-ink-faint" : b.kind === "hold" ? "bg-card" : "bg-ink text-paper"}`}
                  >
                    {b.allDay ? "" : `${timeIn(new Date(b.startsAt), timeZone)} `}{label(b)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {Array.from({ length: (7 - ((lead + days) % 7)) % 7 }, (_, i) => <div key={`t${i}`} className="bg-paper" />)}
        </div>
        <ul className="space-y-2 md:hidden">
          {byDay.filter((d) => d.items.length > 0 || d.date === today).map((d) => (
            <li key={d.date} className="border border-rule px-3 py-2 text-sm">
              <p className={d.date === today ? "font-medium text-accent" : "label text-ink-faint"}>{d.date}{d.date === today ? " · today" : ""}</p>
              {d.items.length === 0 && <p className="text-ink-soft">Nothing.</p>}
              {d.items.map((b) => (
                <p key={b.id}>
                  {b.allDay ? "All day" : timeIn(new Date(b.startsAt), timeZone)} {label(b)}
                  {b.status === "requested" ? " (request)" : b.kind === "hold" ? " (hold)" : ""}
                </p>
              ))}
            </li>
          ))}
        </ul>
        {monthBookings.length === 0 && <p className="mt-3 text-sm text-ink-soft">Nothing booked in {title}.</p>}
      </Card>

      <Card title="Waiting for an answer">
        {requests.length === 0 && <p className="text-sm text-ink-soft">No requests are waiting.</p>}
        <ul className="space-y-3">
          {requests.map((b) => (
            <li key={b.id} className="space-y-2 border border-ink px-4 py-3 text-sm">
              <p className="font-medium">{label(b)}</p>
              <p className="text-ink-soft">{describe(b, timeZone)}</p>
              {b.clientName && <p className="text-ink-soft">From {b.clientName}{b.clientEmail ? ` (${b.clientEmail})` : ""}</p>}
              {b.notes && <p className="whitespace-pre-wrap">{b.notes}</p>}
              <BookingActions id={b.id} mode="request" {...fields(b)} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Coming up">
        {booked.length === 0 && <p className="text-sm text-ink-soft">No bookings or holds coming up.</p>}
        <ul className="space-y-3">
          {booked.map((b) => (
            <li key={b.id} className="space-y-2 border border-rule px-4 py-3 text-sm">
              <p className="font-medium">
                {label(b)} <span className="label ml-2 text-ink-faint">{b.kind === "hold" ? "Hold" : b.status === "moved" ? "Moved" : "Confirmed"}</span>
              </p>
              <p className="text-ink-soft">{describe(b, timeZone)}</p>
              {b.clientName && b.title && <p className="text-ink-soft">{b.clientName}</p>}
              {b.notes && <p className="whitespace-pre-wrap">{b.notes}</p>}
              <BookingActions id={b.id} mode="booked" {...fields(b)} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Add a booking or hold" subtitle={`Times are in ${timeZone}. A hold keeps a date free of other bookings without a client.`}>
        <AddBookingForm />
      </Card>
    </>
  );
}
