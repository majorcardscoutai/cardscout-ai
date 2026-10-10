import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

/**
 * Runs before every page. Anyone without a valid login cookie is sent to
 * /login. If APP_PASSWORD isn't set, nobody can get in (fail closed).
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
