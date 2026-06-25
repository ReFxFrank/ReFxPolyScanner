import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, expectedToken, safeEqual } from "@/lib/auth";

// Gate every page/API route behind the single-user session, except the login
// flow and Next internals. No-op when AUTH_PASSWORD is unset.
export async function middleware(req: NextRequest) {
  const expected = await expectedToken();
  if (!expected) return NextResponse.next(); // auth disabled

  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (token && safeEqual(token, expected)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Protect everything except the login page/route, Next assets, and favicon.
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"],
};
