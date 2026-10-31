import { timingSafeEqual } from "crypto";
import { removeOrphanedOriginals, removeOrphanedWebCopies, retryStorageCleanups, sendDraftReminders } from "@/lib/cleanup";

// Vercel Cron calls this once a day (vercel.json) and sends
// `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set. Without that
// secret the route stays closed, so nobody else can trigger it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Not found", { status: 404 });
  }
  // Each job is separate, so one failing doesn't stop the others.
  const run = async <T>(job: () => Promise<T>) => {
    try {
      return await job();
    } catch (err) {
      console.error("Daily job failed", err);
      return { error: (err as Error).message };
    }
  };
  return Response.json({
    closedAccounts: await run(retryStorageCleanups),
    unfinishedUploads: await run(removeOrphanedOriginals),
    draftReminders: await run(sendDraftReminders),
    orphanedWebCopies: await run(removeOrphanedWebCopies),
  });
}
