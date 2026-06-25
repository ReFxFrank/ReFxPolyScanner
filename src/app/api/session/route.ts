import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authEnabled,
  isPublic,
  isValidAdminToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/session — tells the client whether the current visitor may manage
// estimates. `admin` is true when auth is disabled (fully open) or the request
// carries a valid operator cookie. Drives showing/hiding write controls.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const admin = await isValidAdminToken(token);
  return NextResponse.json({
    authEnabled: authEnabled(),
    public: isPublic(),
    admin,
  });
}
