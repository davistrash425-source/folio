import { currentUser, impersonationBlock } from "@/lib/auth";
import { storage } from "@/lib/uploads";
import { zipChunks } from "@/lib/zip";

// Downloads everything in the account: profile, albums, inquiries and the
// original photo files.
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  // An admin viewing the account as its owner can't download its data.
  if (await impersonationBlock()) return new Response("Not available while viewing this account as an admin", { status: 403 });

  const account: Partial<typeof user> = { ...user };
  delete account.passwordHash;
  delete account.adminNotes; // Folio's private notes about the account, not the photographer's data
  // One photo at a time, so a big account never has to fit in memory at once.
  const files = [
    async () => ({ name: "account.json", data: Buffer.from(JSON.stringify(account, null, 2)) }),
    ...user.photos.map((p, i) => async () => {
      const ext = p.file.split(".").pop();
      const name = `photos/${String(i + 1).padStart(3, "0")}-${p.id}.${ext}`;
      const data: Buffer | null = await storage.get(user.id, p.file).catch(() => null);
      return data && { name, data };
    }),
  ];
  const chunks = zipChunks(files);
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await chunks.next();
      if (done) controller.close();
      else controller.enqueue(new Uint8Array(value));
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="folio-${user.subdomain}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
