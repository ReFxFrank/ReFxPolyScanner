import { NextRequest, NextResponse } from "next/server";
import { createEstimate, getMarket, listEstimates } from "@/lib/store";
import { buildMarketView } from "@/lib/flags";
import { getBooksForSlug } from "@/lib/store";
import { SESSION_COOKIE, isValidAdminToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/estimates — all logged calls, newest first. Public (read-only).
export function GET() {
  return NextResponse.json({ estimates: listEstimates() });
}

// POST /api/estimates — log a YES probability call for a market.
// body: { slug, yourProb (0..1), note? }. Operator-only (admin cookie).
export async function POST(req: NextRequest) {
  if (!(await isValidAdminToken(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { slug?: string; yourProb?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : null;
  const yourProb = Number(body.yourProb);
  if (!slug || !Number.isFinite(yourProb) || yourProb < 0 || yourProb > 1) {
    return NextResponse.json(
      { error: "slug and yourProb (0..1) required" },
      { status: 400 }
    );
  }

  const market = getMarket(slug);
  if (!market) {
    return NextResponse.json({ error: "unknown market" }, { status: 404 });
  }

  // Capture the market mid at log time so calibration later compares against
  // the price you actually faced.
  const view = buildMarketView(market, getBooksForSlug(slug), undefined);
  const estimate = createEstimate(
    slug,
    yourProb,
    view.impliedProb,
    typeof body.note === "string" ? body.note : null,
    Date.now()
  );
  return NextResponse.json({ estimate }, { status: 201 });
}
