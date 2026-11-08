import { receiveEmail, verifyMailWebhook } from "@/lib/channels/mail";
import { z } from "zod";

// Resend calls this for every email to a domain it receives for. The raw body
// is read as text first, because the signature covers those exact bytes.
const MAX_BODY_BYTES = 256 * 1024;

const event = z.object({
  type: z.string(),
  data: z
    .object({
      email_id: z.string().max(200),
      to: z.array(z.string().max(400)).max(100),
      cc: z.array(z.string().max(400)).max(100).nullable(),
      // Who it was really delivered for: a photographer forwarding their Gmail
      // here has their Gmail address in `to` and their Folio address only here.
      received_for: z.array(z.string().max(400)).max(100).nullable(),
    })
    .partial(),
});

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return new Response("Too large", { status: 413 });
  const headers = {
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
  };
  // Without a secret the route stays closed, like the billing webhook.
  if (!verifyMailWebhook(rawBody, headers, process.env.MAIL_WEBHOOK_SECRET)) return new Response("Invalid signature", { status: 401 });

  let parsed;
  try {
    parsed = event.safeParse(JSON.parse(rawBody));
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (!parsed.success) return new Response("Bad event", { status: 400 });
  if (parsed.data.type !== "email.received") return new Response("Ignored");
  const { email_id: emailId, to, cc, received_for: receivedFor } = parsed.data.data;
  const header = [...(to ?? []), ...(cc ?? [])];
  if (!emailId || !(receivedFor?.length || header.length)) return new Response("Bad event", { status: 400 });

  try {
    return Response.json({ result: await receiveEmail(emailId, receivedFor ?? [], header) });
  } catch (err) {
    // A 500 makes Resend try again. The name only: a message can quote a sender.
    console.error("Inbound mail failed", (err as Error).name);
    return new Response("Try again", { status: 500 });
  }
}
