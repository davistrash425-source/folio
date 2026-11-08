import { timingSafeEqual } from "crypto";
import { agentsPaused } from "@/lib/plans";
import { runQueuedTasks } from "@/lib/agents/worker";

// Vercel Cron calls this (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
// Without that secret the route stays closed.
//
// It runs every ten minutes on purpose, not every minute: a query every minute
// would keep the Neon database from ever sleeping, and phase 1 has almost
// nothing queued. Chat runs its own task straight away; this only picks up
// background work and retries.
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
  return Response.json(await runQueuedTasks());
}
