import { NextRequest, NextResponse } from "next/server";
import { deleteEstimate, resolveEstimate } from "@/lib/store";
import { SESSION_COOKIE, isValidAdminToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function denyIfNotAdmin(req: NextRequest): Promise<NextResponse | null> {
  if (await isValidAdminToken(req.cookies.get(SESSION_COOKIE)?.value)) {
    return null;
  }
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// DELETE /api/estimates/:id — remove a logged call. Operator-only.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfNotAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const ok = deleteEstimate(Number(id));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/estimates/:id — resolve a call. body: { outcome: 1|0 }
// Manual capture of resolution (the public feeds don't push it reliably);
// powers the backtest/calibration view.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfNotAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  let body: { outcome?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const outcome = Number(body.outcome);
  if (outcome !== 0 && outcome !== 1) {
    return NextResponse.json({ error: "outcome must be 0 or 1" }, { status: 400 });
  }
  const ok = resolveEstimate(Number(id), outcome);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
