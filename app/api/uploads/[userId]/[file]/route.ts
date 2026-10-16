import path from "path";
import { MIME_BY_EXT, isPrivateFile, storage } from "@/lib/uploads";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/uploads/[userId]/[file]">,
) {
  const { userId, file } = await ctx.params;
  const mime = MIME_BY_EXT[path.extname(file).slice(1)];
  if (!mime || isPrivateFile(file)) return new Response("Not found", { status: 404 });

  try {
    const data = await storage.get(userId, file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        // File names are random UUIDs and never change, so cache forever.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
