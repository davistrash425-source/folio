// Messages for accounts with the agents on: contact-form messages and (later)
// email, in one store (the `messages` table in lib/db.ts). Accounts with the
// agents off keep User.inquiries and are not touched by anything here.
import { createAgentTask, saveMessage, type Message, type MessageChannel, type MessageLabel, type User } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const READER_AGENT = "agent_02_message_in";
const READINGS_PER_DAY = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

// Same subject, same sender, one thread: "Re: Wedding", "RE: Re: wedding" and
// "Fwd: Wedding" all group together.
export function threadKeyFor(address: string, subject: string) {
  const base = subject
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:re|fwd?)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
  return `${address.trim().toLowerCase()}|${base}`;
}

const LIMITS = { fromName: 200, fromAddress: 320, toAddress: 320, subject: 500, body: 50_000 };
// NUL bytes too: Postgres refuses them, and a retried save would never succeed.
const cap = (text: string | undefined, max: number) => (text ?? "").replace(/\r\n?/g, "\n").replaceAll("\0", "").slice(0, max);

export type IncomingMessage = {
  userId: string;
  channel: MessageChannel;
  providerId?: string | null;
  fromName?: string;
  fromAddress: string;
  toAddress?: string;
  subject?: string;
  body: string;
  askedDate?: string;
  senderCheck?: Message["senderCheck"];
  // The sender's Message-ID header, kept only to thread a reply.
  rfcMessageId?: string | null;
  photoId?: string | null;
  createdAt?: Date | string;
  read?: boolean;
  // Ask the message reader (an AI agent) to label it. Default true.
  queueReading?: boolean;
};

// Every incoming message is saved through here, so a step after saving (a
// reading by an agent, say) has one place to hook in.
export async function saveIncomingMessage(input: IncomingMessage): Promise<{ message: Message; created: boolean }> {
  const fromAddress = cap(input.fromAddress, LIMITS.fromAddress);
  const subject = cap(input.subject, LIMITS.subject);
  const saved = await saveMessage({
    userId: input.userId,
    channel: input.channel,
    direction: "in",
    threadKey: threadKeyFor(fromAddress, subject),
    providerId: input.providerId ?? null,
    fromName: cap(input.fromName, LIMITS.fromName),
    fromAddress,
    toAddress: cap(input.toAddress, LIMITS.toAddress),
    subject,
    body: cap(input.body, LIMITS.body),
    askedDate: input.askedDate ?? "",
    senderCheck: input.senderCheck ?? null,
    rfcMessageId: input.rfcMessageId ? input.rfcMessageId.slice(0, 998) : null,
    photoId: input.photoId ?? null,
    createdAt: input.createdAt,
    read: input.read,
  });
  // The reading is queued only for a message saved just now, and capped per
  // account per day so a flood of mail can't run up AI costs. Over the cap the
  // message is still saved, just not read by the AI. The task holds the
  // message's id and nothing the sender wrote.
  if (saved.created && input.queueReading !== false && (await rateLimit(`read:${input.userId}`, READINGS_PER_DAY, DAY_MS))) {
    await createAgentTask({ userId: input.userId, agent: READER_AGENT, input: { messageId: saved.message.id } });
  }
  return saved;
}

// Used when the agents are switched on: the account's earlier inquiries move
// into the new store. Safe to run twice (each keeps the same provider id), and
// the inquiries themselves stay where they are.
export async function copyInquiriesToMessages(user: Pick<User, "id" | "inquiries">) {
  for (const inquiry of user.inquiries ?? []) {
    await saveIncomingMessage({
      userId: user.id,
      channel: "site_form",
      providerId: `inquiry:${inquiry.id}`,
      fromName: inquiry.name,
      fromAddress: inquiry.email,
      subject: "Message from your site",
      body: inquiry.message,
      askedDate: inquiry.date,
      photoId: inquiry.photoId ?? null,
      createdAt: inquiry.createdAt,
      read: inquiry.read,
      queueReading: false,
    });
  }
}

// ---- Inbox helpers (pure: no database) ----

export const INBOX_LABELS = ["URGENT", "REPLY SOON", "LIKELY SCAM"] as const;

// Reads a ?label= value; anything unknown means "all".
export function parseInboxLabel(value: unknown): MessageLabel | null {
  return typeof value === "string" && (INBOX_LABELS as readonly string[]).includes(value) ? (value as MessageLabel) : null;
}

export type InboxThread = {
  threadKey: string;
  latest: Message;
  // The newest incoming message, which carries the label, summary and sender.
  latestIncoming: Message | null;
  unread: boolean;
  count: number;
};

// One row per thread, shown by its latest message, newest first.
export function latestPerThread(messages: Message[]): InboxThread[] {
  const byThread = new Map<string, Message[]>();
  for (const m of messages) byThread.set(m.threadKey, [...(byThread.get(m.threadKey) ?? []), m]);
  const time = (m: Message) => new Date(m.createdAt).getTime();
  const threads = [...byThread.entries()].map(([threadKey, list]) => {
    const sorted = [...list].sort((a, b) => time(b) - time(a) || (a.id < b.id ? -1 : 1));
    return {
      threadKey,
      latest: sorted[0],
      latestIncoming: sorted.find((m) => m.direction === "in") ?? null,
      unread: list.some((m) => m.direction === "in" && !m.read),
      count: list.length,
    };
  });
  return threads.sort((a, b) => time(b.latest) - time(a.latest) || (a.threadKey < b.threadKey ? -1 : 1));
}

// null keeps every thread.
export function filterThreadsByLabel(threads: InboxThread[], label: MessageLabel | null) {
  return label ? threads.filter((t) => t.latestIncoming?.label === label) : threads;
}

// "Waiting 2 days" for an incoming message nobody has answered; otherwise null.
export function waitingLabel(message: Pick<Message, "direction" | "repliedAt" | "createdAt">, now: Date = new Date()) {
  if (message.direction !== "in" || message.repliedAt) return null;
  const hours = Math.floor((now.getTime() - new Date(message.createdAt).getTime()) / 3_600_000);
  if (hours < 1) return "Waiting less than an hour";
  if (hours < 24) return `Waiting ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  return `Waiting ${days} ${days === 1 ? "day" : "days"}`;
}
