import { redirect } from "next/navigation";
import { updateUser } from "@/lib/db";
import { redeemToken } from "@/lib/tokens";

// The link in the verification email lands here.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const userId = await redeemToken(token, "verify");
  if (!userId) redirect("/dashboard?verified=expired");
  await updateUser(userId, (u) => {
    u.emailVerified = true;
  });
  redirect("/dashboard?verified=1");
}
