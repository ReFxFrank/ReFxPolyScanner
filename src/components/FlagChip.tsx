// ReFx flag chips. The mapping encodes the honesty hierarchy:
//   DIVERGE → brand blue   (the one true edge signal — most visual weight)
//   ARB     → amber/gold   ("opportunity," warmth doubles as caveat reminder)
//   WIDE    → quiet slate   (informational "thin liquidity, be careful")
// ARB chips always carry the gross/depth/fee caveat via the title passed in.

const STYLES: Record<string, string> = {
  DIVERGE:
    "text-flagc-diverge border-refx-blue-strong bg-refx-blue/12 shadow-[0_0_10px_-3px_rgba(0,114,255,0.5)]",
  ARB: "text-flagc-arb border-flagc-arb/35 bg-flagc-arb/10",
  WIDE: "text-flagc-wide border-flagc-wide/30 bg-flagc-wide/10",
};

export function FlagChip({
  kind,
  title,
}: {
  kind: "ARB" | "WIDE" | "DIVERGE";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STYLES[kind]}`}
    >
      {kind}
    </span>
  );
}
