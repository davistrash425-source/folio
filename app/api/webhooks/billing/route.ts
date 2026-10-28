import { verifyWebhook } from "@/lib/billing";
import { applyBillingEvent, type PolarEvent } from "@/lib/billing-webhook";

// Polar calls this when a subscription starts, renews, is cancelled or ends.
// Anything without a valid signature is refused. Everything else answers 2xx
// quickly, even for events Folio doesn't use, so Polar doesn't keep retrying.
export async function POST(req: Request) {
  const body = await req.text();
  if (!verifyWebhook(body, req.headers)) return new Response("Bad signature", { status: 400 });
  let event: PolarEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad body", { status: 400 });
  }
  const outcome = await applyBillingEvent(req.headers.get("webhook-id") ?? "", event);
  return Response.json({ outcome });
}
