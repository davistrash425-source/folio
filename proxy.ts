import { NextResponse, type NextRequest } from "next/server";
import { siteSubdomain } from "@/lib/site";

// robots.txt and the sitemap answer for whichever host asked (app/robots.ts,
// app/sitemap.ts), so they aren't sent on to the site.
const PER_HOST_FILES = new Set(["/robots.txt", "/sitemap.xml"]);

// Serves each photographer's site from its own subdomain:
// alice.yourapp.com/anything → /sites/alice/anything
export function proxy(request: NextRequest) {
  const subdomain = siteSubdomain(request.headers.get("host") ?? "");
  if (subdomain && !PER_HOST_FILES.has(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_photos|_next/static|_next/image|favicon.ico).*)"],
};
