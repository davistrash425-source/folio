"use server";

import { checkAvailability, isValidTimeZone, localDayRange } from "@/lib/bookings";
import { createBookingRequest, findUserBySubdomain } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { agentsAllowed } from "@/lib/plans";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { appUrl, isLive } from "@/lib/site";
import { NOT_HUMAN, TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";

type ActionState = { error?: string; ok?: string };

const THANKS = "Thanks — your request was sent. You'll hear back by email.";

// Today's date (YYYY-MM-DD) in a time zone.
function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// The same calendar date some years on (29 February becomes 1 March).
function yearsAfter(date: string, years: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y + years, m - 1, d)).toISOString().slice(0, 10);
}

function realDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

// A visitor asking for a date, from the "Book a date" section of a public
// site. Modelled on sendInquiry (app/actions/site.ts). It only ever makes a
// pending request: it doesn't hold the date, and it never says who has a date
// that is taken.
export async function submitBookingRequest(
  subdomain: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Bots fill in every field, including this one people never see.
  if (String(formData.get("company") ?? "")) return { ok: THANKS };

  const str = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);
  // One line: the name goes in the notification email's subject, where a line
  // break could add headers (like a hidden Bcc).
  const name = str("name", 80).replace(/\s+/g, " ");
  const email = str("email", 120);
  const date = str("date", 10);
  const message = str("message", 2000).replace(/\r\n?/g, "\n");
  if (!name) return { error: "Please add your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email so they can reply." };
  if (!realDate(date)) return { error: "Please choose a date." };

  const ip = await clientIp();
  if (!(await rateLimit(`booking:${ip}`, 5, 60 * 60 * 1000))) {
    return { error: "You've sent several requests already. Please try again later." };
  }
  if (!(await verifyTurnstile(formData.get(TURNSTILE_FIELD), ip))) return { error: NOT_HUMAN };

  const owner = await findUserBySubdomain(subdomain);
  if (!owner || !isLive(owner) || !agentsAllowed(owner)) return { error: "This site isn't taking bookings." };
  // Across all visitors, so a flood from many addresses can't fill a calendar.
  if (!(await rateLimit(`booking-site:${owner.id}`, 50, 24 * 60 * 60 * 1000))) {
    return { error: "This site has had a lot of requests today. Please try again tomorrow." };
  }

  const timeZone = owner.timeZone && isValidTimeZone(owner.timeZone) ? owner.timeZone : "UTC";
  const today = todayIn(timeZone);
  if (date < today) return { error: "Please choose a date that hasn't passed." };
  if (date > yearsAfter(today, 2)) return { error: "Please choose a date within the next two years." };

  const { start, end } = localDayRange(date, timeZone);
  const { free } = await checkAvailability(owner.id, start, end);
  if (!free) return { error: "That date isn't available. Please choose another." };

  await createBookingRequest({
    userId: owner.id,
    clientName: name,
    clientEmail: email,
    title: `Request from ${name}`,
    notes: message,
    startsAt: start,
    endsAt: end,
    allDay: true,
    source: "site",
  });

  try {
    await sendEmail({
      to: owner.profile.contactEmail || owner.email,
      replyTo: email,
      subject: `New booking request from ${name}`,
      text: `${name} (${email}) asked for ${date} through your Folio site.\n\n${message ? `${message}\n\n` : ""}Nothing is booked yet. Review the request: ${appUrl("/dashboard/manage/calendar")}`,
    });
  } catch {
    // The request is saved in the calendar even if the email fails. Nothing
    // the client wrote is logged.
    console.error("Booking request email failed");
  }
  return { ok: THANKS };
}
