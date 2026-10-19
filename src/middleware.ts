import { NextResponse, type NextRequest } from "next/server";
import { AT_COOKIE, RT_COOKIE, refreshSession, sessionCookieOptions, userForToken } from "@/lib/supabase-auth";

/** Pages anyone can open without signing in. */
const PUBLIC_PATHS = new Set(["/login", "/login/forgot", "/auth/reset"]);

/**
 * Runs before every page. Signed in = a valid account session (Supabase). Everyone else is sent to
 * /login. If accounts aren't set up, nobody can get in (fail closed).
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  // The scheduled scan endpoint has its own secret check (CRON_SECRET).
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  // Account session.
  const at = req.cookies.get(AT_COOKIE)?.value;
  const rt = req.cookies.get(RT_COOKIE)?.value;
  if (at && (await userForToken(at))) return NextResponse.next();
  if (rt) {
    const r = await refreshSession(rt);
    if (r.ok) {
      // Pass the new tokens on to this request's page and save them in the browser.
      const headers = new Headers(req.headers ?? undefined);
      const others = (headers.get("cookie") ?? "")
        .split(/;\s*/)
        .filter((c) => c && !c.startsWith(`${AT_COOKIE}=`) && !c.startsWith(`${RT_COOKIE}=`));
      headers.set("cookie", [...others, `${AT_COOKIE}=${r.data.accessToken}`, `${RT_COOKIE}=${r.data.refreshToken}`].join("; "));
      const res = NextResponse.next({ request: { headers } });
      res.cookies.set(AT_COOKIE, r.data.accessToken, sessionCookieOptions());
      res.cookies.set(RT_COOKIE, r.data.refreshToken, sessionCookieOptions());
      return res;
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  const res = NextResponse.redirect(url);
  // A dead account session (signed out elsewhere, or a used refresh token) is cleared so it isn't retried.
  if (at || rt) {
    res.cookies.delete(AT_COOKIE);
    res.cookies.delete(RT_COOKIE);
  }
  return res;
}

export const config = {
  // Everything except Next.js internals and static files.
  // The app manifest, service worker, icons and public media (sign-in page video) load without a login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|sw.js|icon-192.png|icon-512.png|apple-touch-icon.png|media/).*)"],
};
