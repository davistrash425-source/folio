// Email in and out, through Resend. The only file that calls Resend's receiving
// API or sends mail as a photographer. Folio's own mail stays in lib/email.ts.
//
// Mail arrives from anyone on the internet, so nothing in it is trusted:
// - The webhook is checked against its signature before anything is read.
// - Only metadata comes with the webhook; the body is fetched from Resend.
// - Plain text is all that's kept. HTML is reduced to text and thrown away, so
//   no script, image or link in a message can ever run or load inside Folio.
// - Nothing a sender wrote is logged.
import { createHmac, timingSafeEqual } from "crypto";
import { findMailbox, findUserById } from "../db";
import { saveIncomingMessage } from "../messages";
import { isReservedLocalPart, mailDomain, normalizeLocalPart } from "../mailboxes";
import { agentsAllowed, agentsEnrolled } from "../plans";
import { rateLimit } from "../rate-limit";

const RESEND = "https://api.resend.com";
const TIMEOUT_MS = 10_000;
const REPLAY_WINDOW_SECONDS = 5 * 60;
// Larger than any real message; a body over this is cut (lib/messages.ts caps it again).
const MAX_HTML_CHARS = 500_000;
const MAX_ATTACHMENTS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
// One sender can't fill an inbox or spend an account's AI budget, and no flood
// can use up the sending quota that password resets depend on.
const SAVES_PER_SENDER_PER_DAY = 30;
const SAVES_PER_ACCOUNT_PER_DAY = 500;
const FORWARDS_PER_SENDER_PER_DAY = 10;
const FORWARDS_PER_DAY = 300;

export type WebhookHeaders = { id: string | null; timestamp: string | null; signature: string | null };

// Resend signs webhooks with Svix: an HMAC-SHA256, keyed with the base64 part
// of the `whsec_` secret, over "id.timestamp.body", sent base64 as "v1,<sig>".
// `rawBody` must be exactly what arrived: parsing it first breaks the signature.
export function verifyMailWebhook(rawBody: string, headers: WebhookHeaders, secret: string | undefined, nowSeconds = Date.now() / 1000) {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > REPLAY_WINDOW_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest();
  return headers.signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// What a Resend `from` or `to` holds: `a@b.c` or `Name <a@b.c>`.
// The address comes back empty unless it is exactly one plain address, so a
// list or a line of junk can never become where a reply goes.
export function parseAddress(value: string) {
  const open = value.lastIndexOf("<");
  const close = value.lastIndexOf(">");
  const angled = open !== -1 && close > open;
  const raw = (angled ? value.slice(open + 1, close) : value).trim().toLowerCase();
  const name = angled
    ? value
        .slice(0, open)
        .trim()
        .replace(/^"|"$/g, "")
        .replace(/\\(.)/g, "$1")
        .replace(/\s+/g, " ")
        .trim()
    : "";
  const plain = /^[\x21-\x7e]+@[\x21-\x7e]+\.[\x21-\x7e]+$/.test(raw) && !/[,;<>"()[\]\\]/.test(raw) && raw.indexOf("@") === raw.lastIndexOf("@");
  return { name, address: plain && raw.length <= 320 ? raw : "" };
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const SKIPPED_TAGS = new Set(["script", "style", "head", "title"]);
const BLOCK_TAGS = new Set(["p", "div", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"]);

// Text only, for reading and for the AI. Not a sanitizer for showing HTML:
// the result is plain text and is only ever rendered as plain text.
//
// A strict left-to-right scan on purpose. Anyone can send any HTML, and the
// regular expressions this replaced took minutes on a long run of spaces or
// angle brackets, which would have tied up the server.
export function htmlToText(html: string) {
  const input = html.slice(0, MAX_HTML_CHARS);
  const lower = input.toLowerCase();
  const parts: string[] = [];
  let at = 0;
  while (at < input.length) {
    const open = input.indexOf("<", at);
    if (open === -1) {
      parts.push(input.slice(at));
      break;
    }
    parts.push(input.slice(at, open));
    if (input.startsWith("<!--", open)) {
      const end = input.indexOf("-->", open + 4);
      if (end === -1) break;
      at = end + 3;
      continue;
    }
    const close = input.indexOf(">", open + 1);
    if (close === -1) break;
    const tag = /^(\/?)([a-z0-9]+)/.exec(lower.slice(open + 1, Math.min(close, open + 12)));
    at = close + 1;
    if (!tag) continue;
    const [, closing, name] = tag;
    if (!closing && SKIPPED_TAGS.has(name)) {
      const end = lower.indexOf(`</${name}`, at);
      const after = end === -1 ? -1 : input.indexOf(">", end);
      if (after === -1) break;
      at = after + 1;
    } else if ((!closing && name === "br") || (closing && BLOCK_TAGS.has(name))) {
      parts.push("\n");
    }
  }
  return parts
    .join("")
    .replace(/&(#x?[0-9a-f]{1,8}|[a-z]{1,10});/gi, (whole, entity: string) => {
      if (entity[0] !== "#") return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  headers: Record<string, string> | null;
  message_id: string | null;
  reply_to: string[] | null;
  authentication: { spf: string; dkim: string; dmarc: string } | null;
};

async function resend(path: string) {
  const res = await fetch(`${RESEND}${path}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}`);
  return res.json();
}

const fetchReceivedEmail = (id: string): Promise<ReceivedEmail> => resend(`/emails/receiving/${encodeURIComponent(id)}?html_format=cid`);

async function fetchAttachments(id: string) {
  const list = (await resend(`/emails/receiving/${encodeURIComponent(id)}/attachments?limit=${MAX_ATTACHMENTS}`)) as {
    data: { filename: string; download_url: string }[];
  };
  return list.data;
}

// "support=you@example.com,hello=you@example.com": Folio's own addresses and
// where each goes, since moving folio.cam's mail to Resend ends ImprovMX's job.
function systemForwards() {
  const forwards = new Map<string, string>();
  for (const pair of (process.env.MAIL_SYSTEM_FORWARDS ?? "").split(",")) {
    const [local, target] = pair.split("=").map((part) => part?.trim());
    if (local && target) forwards.set(local.toLowerCase(), target);
  }
  return forwards;
}

// A copy of a message sent to one of Folio's own addresses. It is re-sent from
// that address (a mail server won't accept a stranger's From from us), with the
// real sender as Reply-To so answering goes to them.
async function forwardSystemMail(email: ReceivedEmail, localPart: string, target: string) {
  const domain = mailDomain();
  const sender = parseAddress(email.from);
  const attachments = (await fetchAttachments(email.id)).map((a) => ({ filename: a.filename, path: a.download_url }));
  const text = email.text || htmlToText(email.html ?? "");
  const res = await fetch(`${RESEND}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // A webhook redelivered within 24 hours sends nothing twice.
      "Idempotency-Key": `forward-${email.id}-${localPart}`,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      from: `${localPart}@${domain}`,
      to: [target],
      ...(sender.address ? { reply_to: sender.address } : {}),
      subject: (email.subject || "(no subject)").replace(/[\r\n]+/g, " "),
      text: `Forwarded from ${sender.name ? `${sender.name} <${sender.address || "unknown"}>` : sender.address || "an unknown sender"}, to ${localPart}@${domain}\n\n${text}`,
      ...(attachments.length ? { attachments } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}`);
}

// Sends one email from a photographer's own Folio address. Only
// lib/agents/executors.ts calls this, after the photographer's click.
// Nothing in `text` or `subject` is logged and a failure carries only the status.
export async function sendAsPhotographer(input: {
  fromName: string;
  fromAddress: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  idempotencyKey: string;
}) {
  // No quote or line break can end the name early or start another header.
  const name = input.fromName.replace(/["\\\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  const address = input.fromAddress.replace(/[\r\n<>"]/g, "");
  const reference = input.inReplyTo && !/[\r\n]/.test(input.inReplyTo) ? input.inReplyTo : null;
  const res = await fetch(`${RESEND}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      from: name ? `"${name}" <${address}>` : address,
      to: [input.to.replace(/[\r\n]/g, "")],
      subject: input.subject.replace(/[\r\n]+/g, " "),
      text: input.text,
      ...(reference ? { headers: { "In-Reply-To": reference, References: reference } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}`);
}

export type InboundResult = "saved" | "duplicate" | "forwarded" | "ignored";

// One email.received event. Saved first and read by the AI later, so a model
// outage never loses a message. Throwing makes Resend deliver the event again.
//
// `envelope` is who it was really delivered to; `header` is the To and Cc lines,
// which the sender writes and which only count when the envelope names nobody here.
export async function receiveEmail(emailId: string, envelope: string[], header: string[] = []): Promise<InboundResult> {
  const domain = mailDomain();
  if (!domain) return "ignored";
  const localsOf = (list: string[]) => [
    ...new Set(
      list
        .map((value) => parseAddress(value).address)
        .filter((address) => address.endsWith(`@${domain}`))
        .map((address) => address.slice(0, -domain.length - 1)),
    ),
  ];
  const fromEnvelope = localsOf(envelope);
  const locals = fromEnvelope.length ? fromEnvelope : localsOf(header);

  const forwards = systemForwards();
  let fetched: ReceivedEmail | undefined;
  const load = async () => (fetched ??= await fetchReceivedEmail(emailId));
  const outcomes = new Set<InboundResult>();
  const owners = new Set<string>();

  for (const raw of locals) {
    const local = normalizeLocalPart(raw);
    if (!local) continue;
    if (isReservedLocalPart(local)) {
      // Only reserved names can be forwarded, so a setting can never send a
      // photographer's client mail somewhere else.
      const target = forwards.get(local);
      if (!target) continue;
      const email = await load();
      const key = parseAddress(email.from).address || "unknown";
      if ((await rateLimit(`forward:${key}`, FORWARDS_PER_SENDER_PER_DAY, DAY_MS)) && (await rateLimit("forward-all", FORWARDS_PER_DAY, DAY_MS))) {
        await forwardSystemMail(email, local, target);
        outcomes.add("forwarded");
      } else {
        console.warn("Inbound forward over its limit");
      }
      continue;
    }

    const mailbox = await findMailbox(local);
    if (!mailbox?.user_id) continue;
    const owner = await findUserById(mailbox.user_id);
    // Enrolled, not "allowed": a pause or suspension stops the AI, never the mail.
    if (!owner || !agentsEnrolled(owner) || owners.has(owner.id)) continue;
    owners.add(owner.id);

    const email = await load();
    const sender = parseAddress(email.headers?.from ?? email.headers?.From ?? email.from);
    const senderKey = sender.address || "unknown";
    if (
      !(await rateLimit(`inbound:${owner.id}:${senderKey}`, SAVES_PER_SENDER_PER_DAY, DAY_MS)) ||
      !(await rateLimit(`inbound:${owner.id}`, SAVES_PER_ACCOUNT_PER_DAY, DAY_MS))
    ) {
      console.warn("Inbound mail over its limit");
      continue;
    }
    const dmarc = email.authentication?.dmarc;
    // Mail claiming to come from our own domain has to prove it.
    const claimsToBeUs = sender.address.endsWith(`@${domain}`);
    const { created } = await saveIncomingMessage({
      userId: owner.id,
      channel: "email",
      // Resend's id, not the Message-ID header: a sender writes that header
      // and could reuse one to make someone else's mail look like a duplicate.
      // Per mailbox, so one email to two photographers reaches both.
      providerId: `${email.id}:${local}`,
      fromName: sender.name,
      fromAddress: sender.address,
      toAddress: `${local}@${domain}`,
      subject: email.subject ?? "",
      body: email.text || htmlToText(email.html ?? ""),
      rfcMessageId: email.message_id ? email.message_id.slice(0, 998) : null,
      // Did the From address really send this? A message claiming to be from
      // someone it can't prove is a strong sign of a scam.
      senderCheck: dmarc === "pass" ? "pass" : dmarc === "fail" || claimsToBeUs ? "fail" : "unknown",
      // The AI is what a pause stops. The mail is still saved.
      queueReading: agentsAllowed(owner),
    });
    outcomes.add(created ? "saved" : "duplicate");
  }
  if (outcomes.has("saved")) return "saved";
  if (outcomes.has("forwarded")) return "forwarded";
  if (outcomes.has("duplicate")) return "duplicate";
  if (locals.length) console.warn("Inbound mail matched no mailbox");
  return "ignored";
}
