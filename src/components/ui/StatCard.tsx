import { GlassPanel } from "./GlassPanel";

// Compact calibration/metric module. Sober by design — no celebratory styling
// (this is a tool that measures whether you actually have edge).
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad" | "accent";
}) {
  const valueTone =
    tone === "good"
      ? "text-status-live"
      : tone === "bad"
        ? "text-status-error"
        : tone === "accent"
          ? "text-refx-blueText"
          : "text-refx-text";
  return (
    <GlassPanel className="px-3.5 py-3">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular ${valueTone}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-refx-meta">{hint}</div>}
    </GlassPanel>
  );
}
