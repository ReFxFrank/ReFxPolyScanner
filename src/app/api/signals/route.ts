import { NextRequest, NextResponse } from "next/server";
import { getSignals } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/signals?since=<ms epoch> — recent flagged signals, newest first.
export function GET(req: NextRequest) {
  const since = Number(req.nextUrl.searchParams.get("since")) || 0;
  const signals = getSignals(since);
  return NextResponse.json({ signals });
}
