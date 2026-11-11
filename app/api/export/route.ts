import { currentUser, impersonationBlock } from "@/lib/auth";
import type { ClientGallery } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { storage } from "@/lib/uploads";
import { zipResponse } from "@/lib/zip";

// A download of the whole account can stream gigabytes, so it's capped per
// account (audit M-6). Someone exporting again after deleting it by mistake
// waits a little while.
const HOUR = 60 * 60 * 1000;
export const EXPORTS_PER_HOUR = 3;
const NOT_NOW = "You can download your account a few times an hour. Please try again shortly.";

// Downloads everything in the account: profile, albums, inquiries and the
// original photo files.
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  // An admin viewing the account as its owner can't download its data.
  if (await impersonationBlock()) return new Response("Not available while viewing this account as an admin", { status: 403 });
  // Per account, so signing in as several accounts can't add up to more.
  if (!(await rateLimit(`export:${user.id}`, EXPORTS_PER_HOUR, HOUR))) {
    return new Response(NOT_NOW, { status: 429, headers: { "retry-after": "600" } });
  }

  const account: Omit<Partial<typeof user>, "galleries"> & { galleries?: Omit<ClientGallery, "passwordHash">[] } = { ...user };
  delete account.passwordHash;
  delete account.adminNotes; // Folio's private notes about the account, not the photographer's data
  delete account.legalHold; // Folio's staff note on a legal hold, not the photographer's data
  delete account.managedBy; // the id of the admin's own account, an internal reference
  // Client galleries without their password hashes, like the account's own.
  account.galleries = user.galleries?.map((g) => {
    const gallery: Partial<ClientGallery> = { ...g };
    delete gallery.passwordHash;
    return gallery as Omit<ClientGallery, "passwordHash">;
  });
  // Photos whose files couldn't be read. Listed in MISSING-FILES.txt, the last
  // entry, so the owner knows the download is incomplete.
  const missing: string[] = [];
  // One photo at a time, so a big account never has to fit in memory at once.
  const files = [
    async () => ({ name: "account.json", data: Buffer.from(JSON.stringify(account, null, 2)) }),
    ...user.photos.map((p, i) => async () => {
      const ext = p.file.split(".").pop();
      const name = `photos/${String(i + 1).padStart(3, "0")}-${p.id}.${ext}`;
      const data: Buffer | null = await storage.get(user.id, p.file).catch(() => null);
      if (!data) missing.push(name);
      return data && { name, data };
    }),
    // Runs after every photo above, so `missing` is complete by now.
    async () =>
      missing.length
        ? {
            name: "MISSING-FILES.txt",
            data: Buffer.from(
              "These photos couldn't be read from storage, so they aren't in this download.\n" +
                "Their details are still in account.json.\n\n" +
                missing.join("\n") +
                "\n",
            ),
          }
        : null,
  ];
  return zipResponse(files, `folio-${user.subdomain}.zip`);
}
