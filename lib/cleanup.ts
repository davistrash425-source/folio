// Housekeeping that runs once a day (app/api/cron/daily) and after an account
// is deleted: finishing file deletions that failed, removing uploads that
// were never finished, and reminding people their site is still a draft.
import {
  accountsToRemindAboutDraft,
  finishStorageCleanup,
  findUserById,
  pendingStorageCleanups,
  updateUser,
} from "./db";
import { sendEmail } from "./email";
import { appUrl } from "./site";
import { storage } from "./uploads";

const DAY = 24 * 60 * 60 * 1000;
// An upload has 10 minutes to finish, and a big batch can take a while, so
// anything this old without a photo record is never going to be claimed.
export const ORPHAN_AFTER_MS = DAY;
export const DRAFT_REMINDER_AFTER_DAYS = 3;
const REMINDERS_PER_RUN = 200;

// Deletes a closed account's files. If storage fails, the account is already
// gone from the database, so this doesn't throw: the account stays in the
// cleanup list and the daily job tries again.
export async function removeAccountFiles(userId: string) {
  try {
    await storage.removeAll(userId);
    await finishStorageCleanup(userId);
    return true;
  } catch (err) {
    console.error(`Couldn't delete the files of closed account ${userId}; will retry`, err);
    return false;
  }
}

export async function retryStorageCleanups() {
  let done = 0;
  const waiting = await pendingStorageCleanups();
  for (const userId of waiting) if (await removeAccountFiles(userId)) done++;
  return { waiting: waiting.length, done };
}

// Originals that arrived in storage but never became a photo (the browser
// closed before finishing, or the start address was used for something else).
export async function removeOrphanedOriginals(now = Date.now()) {
  const old = (await storage.listOriginals()).filter((o) => o.modified < now - ORPHAN_AFTER_MS);
  const photosOf = new Map<string, Set<string> | null>();
  let removed = 0;
  for (const { userId, file } of old) {
    if (!photosOf.has(userId)) {
      const user = await findUserById(userId);
      // An account on legal hold keeps everything, uploads that never finished included.
      photosOf.set(userId, user && !user.legalHold ? new Set(user.photos.map((p) => p.file)) : null);
    }
    const files = photosOf.get(userId);
    // A missing account is the retry list's job (it deletes the whole folder);
    // null here also means "on legal hold, leave it alone".
    if (files === null || files?.has(file)) continue;
    await storage.remove(userId, file);
    removed++;
  }
  return { checked: old.length, removed };
}

// One email, ever, to verified people whose site is still a draft.
export async function sendDraftReminders() {
  let sent = 0;
  for (const id of await accountsToRemindAboutDraft(DRAFT_REMINDER_AFTER_DAYS, REMINDERS_PER_RUN)) {
    const user = await findUserById(id);
    if (!user) continue;
    // Marked first, so a failure sends nothing twice.
    await updateUser(id, (u) => void (u.draftReminderAt = new Date().toISOString()), { publicChange: false });
    try {
      await sendEmail({
        to: user.email,
        subject: "Your Folio site is still a draft",
        text: `Hi ${user.profile.name},

Your Folio site isn't public yet, so nobody can see it. When you're ready, open the Go live page and publish it:

${appUrl("/dashboard/manage/publish")}

This is the only reminder we'll send.`,
      });
      sent++;
    } catch (err) {
      console.error("Draft reminder failed", err);
    }
  }
  return { sent };
}
