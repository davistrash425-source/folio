import { currentUser, impersonationBlock } from "@/lib/auth";
import { listAgentChat, listAllBookings, listAllMessages, listAgentTasks, listApprovals, type ClientGallery } from "@/lib/db";
import { storage } from "@/lib/uploads";
import { zipResponse } from "@/lib/zip";

const EVERYTHING = 1_000_000;

// Downloads everything in the account: profile, albums, inquiries and the
// original photo files.
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  // An admin viewing the account as its owner can't download its data.
  if (await impersonationBlock()) return new Response("Not available while viewing this account as an admin", { status: 403 });

  const account: Omit<Partial<typeof user>, "galleries"> & { galleries?: Omit<ClientGallery, "passwordHash">[] } = { ...user };
  delete account.passwordHash;
  delete account.adminNotes; // Folio's private notes about the account, not the photographer's data
  delete account.legalHold; // Folio's staff note on a legal hold, not the photographer's data
  delete account.managedBy; // the id of the admin's own account, an internal reference
  delete account.agents; // who at Folio switched the agents on, a staff email
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
    async () => ({
      name: "agents.json",
      data: Buffer.from(
        JSON.stringify(
          {
            chat: await listAgentChat(user.id, EVERYTHING),
            tasks: await listAgentTasks(user.id, EVERYTHING),
            approvals: await listApprovals(user.id, undefined, EVERYTHING),
          },
          null,
          2,
        ),
      ),
    }),
    async () => ({ name: "bookings.json", data: Buffer.from(JSON.stringify(await listAllBookings(user.id), null, 2)) }),
    async () => ({ name: "messages.json", data: Buffer.from(JSON.stringify(await listAllMessages(user.id), null, 2)) }),
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
