import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

/**
 * Runs before every page. Anyone without a valid login cookie is sent to
 * /login. If APP_PASSWORD isn't set, nobody can get in (fail closed).
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  // The scheduled scan endpoint has its own secret check (CRON_SECRET).
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  const password = process.env.APP_PASSWORD;
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (password && cookie && cookie === (await sessionToken(password))) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next.js internals and static files.
  // The app manifest, service worker, icons and public media (sign-in page video) load without a login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|sw.js|icon-192.png|icon-512.png|apple-touch-icon.png|media/).*)"],
};
