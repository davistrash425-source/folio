import { NextResponse, type NextRequest } from "next/server";
import { ROOT_DOMAIN } from "@/lib/site";

const rootHostname = ROOT_DOMAIN.split(":")[0];

// Serves each photographer's site from its own subdomain:
// alice.yourapp.com/anything → /sites/alice/anything
export function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  if (hostname.endsWith(`.${rootHostname}`)) {
    const subdomain = hostname.slice(0, -(rootHostname.length + 1));
    if (subdomain && subdomain !== "www" && !subdomain.includes(".")) {
      const url = request.nextUrl.clone();
      url.pathname = `/sites/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
