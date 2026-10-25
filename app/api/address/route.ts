import { addressStatus } from "@/lib/address";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Live availability check for a site address, used while people type on the
// landing page and the sign-up form. Rate-limited so it can't be used to
// enumerate which addresses exist.
export async function GET(req: Request) {
  const subdomain = new URL(req.url).searchParams.get("subdomain") ?? "";
  if (!(await rateLimit(`address:${await clientIp()}`, 60, 60 * 1000))) {
    return Response.json({ status: "limited" }, { status: 429 });
  }
  return Response.json(await addressStatus(subdomain));
}
