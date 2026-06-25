// Color-coded flag chips. ARB is shown with a "gross" reminder by design —
// the UI must never present a flag as risk-free profit.

const STYLES: Record<string, string> = {
  ARB: "bg-flag-arb/15 text-flag-arb border-flag-arb/40",
  WIDE: "bg-flag-wide/15 text-flag-wide border-flag-wide/40",
  DIVERGE: "bg-flag-diverge/15 text-flag-diverge border-flag-diverge/40",
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
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STYLES[kind]}`}
    >
      {kind}
    </span>
  );
}
