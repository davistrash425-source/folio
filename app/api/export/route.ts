import { findUserById } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { storage } from "@/lib/uploads";
import { createZip } from "@/lib/zip";

// Downloads everything in the account: profile, albums, inquiries and the
// original photo files.
export async function GET() {
  const userId = await getSessionUserId();
  const user = userId ? await findUserById(userId) : null;
  if (!user) return new Response("Not signed in", { status: 401 });

  const account: Partial<typeof user> = { ...user };
  delete account.passwordHash;
  const photos = await Promise.all(
    user.photos.map(async (p, i) => {
      const ext = p.file.split(".").pop();
      const name = `photos/${String(i + 1).padStart(3, "0")}-${p.id}.${ext}`;
      const data: Buffer | null = await storage.get(user.id, p.file).catch(() => null);
      return data && { name, data };
    }),
  );
  const zip = createZip([
    { name: "account.json", data: Buffer.from(JSON.stringify(account, null, 2)) },
    ...photos.filter((p) => p !== null),
  ]);

  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="folio-${user.subdomain}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
