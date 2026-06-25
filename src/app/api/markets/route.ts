import { NextRequest, NextResponse } from "next/server";
import { allMarketViews } from "@/lib/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/markets?flag=ARB|WIDE|DIVERGE&min_volume=1000&sort=volume|spread|implied
export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const flag = searchParams.get("flag");
  const minVolume = Number(searchParams.get("min_volume")) || 0;
  const sort = searchParams.get("sort") ?? "volume";

  let views = allMarketViews();

  if (minVolume > 0) views = views.filter((v) => v.volume24h >= minVolume);
  if (flag === "ARB") views = views.filter((v) => v.flags.arb);
  else if (flag === "WIDE") views = views.filter((v) => v.flags.wide);
  else if (flag === "DIVERGE") views = views.filter((v) => v.flags.diverge);

  views.sort((a, b) => {
    switch (sort) {
      case "spread":
        return (b.spread ?? -1) - (a.spread ?? -1);
      case "implied":
        return (b.impliedProb ?? -1) - (a.impliedProb ?? -1);
      case "volume":
      default:
        return b.volume24h - a.volume24h;
    }
  });

  return NextResponse.json({ markets: views, count: views.length });
}
