// The only code that carries out what an agent proposes. Nothing here runs
// unless lib/agents/approvals.ts has a used-up approval to hand it, and only
// that file imports this one (tests/agent-approvals.test.ts checks that).
//
// Each kind of action has a schema, so what was proposed, stored and approved
// is what runs. Sending, posting and booking join this list in later phases.
import { z } from "zod";
import { conflictSentence } from "../bookings";
import { addAgentChatMessage, cancelBooking, confirmBooking, findBooking, moveBooking, type BookingResult, type User } from "../db";
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
};

export function executorFor(kind: string): Executor | null {
  return Object.hasOwn(executors, kind) ? executors[kind] : null;
}
