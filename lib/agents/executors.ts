// The only code that carries out what an agent proposes. Nothing here runs
// unless lib/agents/approvals.ts has a used-up approval to hand it, and only
// that file imports this one (tests/agent-approvals.test.ts checks that).
//
// Each kind of action has a schema, so what was proposed, stored and approved
// is what runs. Sending, posting and booking join this list in later phases.
import { createHash } from "crypto";
import { z } from "zod";
import { conflictSentence } from "../bookings";
import {
  addAgentChatMessage,
  cancelBooking,
  confirmBooking,
  findBooking,
  findMessage,
  mailboxesOf,
  markMessageReplied,
  moveBooking,
  saveMessage,
  type BookingResult,
  type User,
} from "../db";
import { sendAsPhotographer } from "../channels/mail";
import { mailDomain } from "../mailboxes";
import { rateLimit } from "../rate-limit";
import { draftConfirmation } from "./booking";

// A refusal whose message is safe to show the photographer as it is (it holds
// no model text). The gate reports it without logging anything.
export class ExecutorRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutorRefused";
  }
}

type Executor = {
  schema: z.ZodType;
  // What it will do, in plain words, built only from the validated action. This
  // is what the photographer approves; the agent's own summary is just a label.
  describe(action: unknown): string;
  // What to tell the photographer it did. Throwing counts as "it failed".
  run(user: User, action: unknown): Promise<string>;
};

function executor<S extends z.ZodType>(
  schema: S,
  describe: (action: z.output<S>) => string,
  run: (user: User, action: z.output<S>) => Promise<string>,
): Executor {
  return { schema, describe: (action) => describe(schema.parse(action)), run: (user, action) => run(user, schema.parse(action)) };
}

const CHANGED = "That booking changed after this was suggested. Ask again.";
const iso = z.string().max(40).refine((value) => !isNaN(Date.parse(value)));
// Words built by the proposing code from the booking row (a client's name can
// be in them, so they are shown to the photographer and never logged).
const words = (max: number) => z.string().min(1).max(max);

// Loads the booking and refuses if it is gone or changed since it was suggested.
async function unchanged(user: User, bookingId: string, updatedAt: string) {
  const booking = await findBooking(user.id, bookingId);
  if (!booking || booking.updatedAt !== updatedAt) throw new ExecutorRefused(CHANGED);
  return booking;
}

function settled(result: BookingResult, user: User) {
  if (result.ok) return result.booking;
  if (result.reason === "conflict") throw new ExecutorRefused(conflictSentence(result.conflicts[0], user.timeZone ?? "UTC"));
  if (result.reason === "wrong_status") throw new ExecutorRefused("That booking can't be changed any more.");
  throw new ExecutorRefused("That booking no longer exists.");
}

const SENDS_PER_DAY = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const executors: Record<string, Executor> = {
  // Writes a note into the photographer's own agent chat. It reaches nobody
  // else, so the whole approval path can be used before anything can send.
  save_note: executor(
    z.object({ text: z.string().min(1).max(2000) }).strict(),
    (action) => `Save this note in your agent chat: ${action.text}`,
    async (user, action) => {
      await addAgentChatMessage({ userId: user.id, role: "assistant", text: `Saved note: ${action.text}` });
      return "Note saved.";
    },
  ),
  confirm_booking: executor(
    z.object({ bookingId: z.string().max(100), who: words(80), when: words(100), updatedAt: iso }).strict(),
    (action) => `Confirm ${action.who} on ${action.when}.`,
    async (user, action) => {
      await unchanged(user, action.bookingId, action.updatedAt);
      const booking = settled(await confirmBooking(user.id, action.bookingId), user);
      // Wording a message for the photographer to send. A failure here must
      // not undo or fail the confirmation.
      try {
        await draftConfirmation(user, booking);
      } catch {
        // Nothing to do: the booking is confirmed either way.
      }
      return "Booking confirmed.";
    },
  ),
  move_booking: executor(
    z
      .object({
        bookingId: z.string().max(100),
        who: words(80),
        from: words(100),
        to: words(100),
        startsAt: iso,
        endsAt: iso,
        allDay: z.boolean(),
        updatedAt: iso,
      })
      .strict(),
    (action) => `Move ${action.who} from ${action.from} to ${action.to}.`,
    async (user, action) => {
      await unchanged(user, action.bookingId, action.updatedAt);
      const to = { startsAt: new Date(action.startsAt), endsAt: new Date(action.endsAt), allDay: action.allDay };
      settled(await moveBooking(user.id, action.bookingId, to), user);
      return "Booking moved.";
    },
  ),
  cancel_booking: executor(
    z.object({ bookingId: z.string().max(100), who: words(80), when: words(100), updatedAt: iso }).strict(),
    (action) => `Cancel ${action.who} on ${action.when}.`,
    async (user, action) => {
      await unchanged(user, action.bookingId, action.updatedAt);
      settled(await cancelBooking(user.id, action.bookingId), user);
      return "Booking cancelled.";
    },
  ),
  // Sends one email from the photographer's own Folio address to the person who
  // wrote. Everything is checked again here, at the moment of sending, from the
  // database: the message, its label, who it came from and whose address it goes
  // out from. Never retried automatically, because a retry could send twice.
  send_email_reply: executor(
    z
      .object({
        messageId: z.string().min(1).max(100),
        fromAddress: z.string().min(3).max(320),
        to: z.string().min(3).max(320),
        subject: z.string().min(1).max(500),
        body: z.string().min(1).max(20_000),
        notChecked: z.boolean().optional(),
      })
      .strict(),
    (action) => `${action.notChecked ? "This message hasn't been checked for scams yet.\n\n" : ""}Send this email from ${action.fromAddress} to ${action.to}\nSubject: ${action.subject}\n\n${action.body}`,
    async (user, action) => {
      const message = await findMessage(user.id, action.messageId);
      if (!message || message.direction !== "in") throw new ExecutorRefused("That message no longer exists.");
      if (message.label === "LIKELY SCAM") throw new ExecutorRefused("That message was marked as a likely scam, so no reply was sent.");
      const domain = mailDomain();
      if (!domain) throw new ExecutorRefused("Email isn't set up yet.");
      if (!message.fromAddress.trim() || action.to.trim().toLowerCase() !== message.fromAddress.trim().toLowerCase()) {
        throw new ExecutorRefused("That reply isn't addressed to the person who wrote, so it wasn't sent.");
      }
      const own = (await mailboxesOf(user.id)).map((m) => `${m.localPart}@${domain}`);
      if (!own.includes(action.fromAddress.trim().toLowerCase())) {
        throw new ExecutorRefused("That address isn't one of yours, so the email wasn't sent.");
      }
      if (!(await rateLimit(`send:${user.id}`, SENDS_PER_DAY, DAY_MS))) {
        throw new ExecutorRefused(`You've sent ${SENDS_PER_DAY} emails in the last day, which is the limit. Try again later.`);
      }
      const fromName = user.profile.name;
      try {
        await sendAsPhotographer({
          fromName,
          fromAddress: action.fromAddress,
          to: message.fromAddress,
          subject: action.subject,
          text: action.body,
          inReplyTo: message.rfcMessageId,
          // The same words to the same message within a day go out once, even if this ran twice.
          idempotencyKey: `reply-${createHash("sha256").update(`${message.id}\n${action.body}`).digest("hex").slice(0, 48)}`,
        });
      } catch (err) {
        // The name only: nothing the message said is logged.
        console.error("Reply could not be sent", (err as Error).name);
        throw new ExecutorRefused("That email couldn't be sent. Ask for a new draft to try again.");
      }
      // The email is out. A problem recording it must not look like a failed send.
      try {
        await saveMessage({
          userId: user.id,
          channel: message.channel,
          direction: "out",
          threadKey: message.threadKey,
          fromName,
          fromAddress: action.fromAddress,
          toAddress: message.fromAddress,
          subject: action.subject,
          body: action.body,
          read: true,
        });
        await markMessageReplied(user.id, message.id);
      } catch (err) {
        console.error("Sent reply could not be recorded", (err as Error).name);
      }
      return "Email sent.";
    },
  ),
};

export function executorFor(kind: string): Executor | null {
  return Object.hasOwn(executors, kind) ? executors[kind] : null;
}
