import { timingSafeEqual } from "crypto";
import { runMornings } from "@/lib/agents/morning";
import { runQueuedTasks } from "@/lib/agents/worker";
import { agentsPaused } from "@/lib/plans";

// Vercel Cron calls this every hour (vercel.json) with
// `Authorization: Bearer <CRON_SECRET>`; without that secret the route stays
// closed. Each run finds the photographers whose local time is the morning
// hour, queues their summaries and runs the queue so they arrive straight away.
export const maxDuration = 180;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Not found", { status: 404 });
  }
  // Checked before anything touches the database.
  if (agentsPaused()) return Response.json({ paused: true });
  const mornings = await runMornings();
  return Response.json({ mornings, tasks: await runQueuedTasks() });
}
