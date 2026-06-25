import { NextResponse } from "next/server";
import { getScores } from "@/lib/scores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scores — normalized live/recent games from ESPN, cached server-side.
export async function GET() {
  const games = await getScores();
  return NextResponse.json({ games });
}
