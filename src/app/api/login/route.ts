import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authEnabled, sessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/login { password } — set the session cookie on success.
export async function POST(req: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.json({ ok: true, note: "auth disabled" });
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  const expected = await sessionToken(process.env.AUTH_PASSWORD as string);
  const got = await sessionToken(password);
  if (got !== expected) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

// DELETE /api/login — log out.
export function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
