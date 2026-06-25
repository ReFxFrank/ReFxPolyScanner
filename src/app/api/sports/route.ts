import { NextRequest, NextResponse } from "next/server";
import { getMarket } from "@/lib/store";
import { getSportsInfo } from "@/lib/sports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/sports?slug=... — team stats for a sports market (cached). Returns
// { available:false } for non-sports / non-team markets so the UI hides it.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ available: false }, { status: 400 });
  }
  const market = getMarket(slug);
  if (!market) return NextResponse.json({ available: false });

  // If categories are tracked and none is a sport, skip the lookup.
  const SPORT_TAGS = new Set([
    "sports", "soccer", "tennis", "basketball", "baseball", "football",
    "mma", "golf", "hockey", "cricket",
  ]);
  let categories: string[] = [];
  try {
    categories = market.categories ? JSON.parse(market.categories) : [];
  } catch {
    categories = [];
  }
  if (categories.length > 0 && !categories.some((c) => SPORT_TAGS.has(c))) {
    return NextResponse.json({ available: false });
  }

  const info = await getSportsInfo(market.question);
  return NextResponse.json(info);
}
