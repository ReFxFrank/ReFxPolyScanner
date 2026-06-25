// ReFx semantic status pill — same vocabulary as the iOS app's server-state
// pills. Blue stays the brand; these are status colors only.

export type StatusKind = "live" | "stale" | "error" | "open";

const MAP: Record<
  StatusKind,
  { label: string; dot: string; text: string; ring: string; pulse: boolean }
> = {
  live: {
    label: "LIVE",
    dot: "bg-status-live",
    text: "text-status-live",
    ring: "border-status-live/30 bg-status-live/10",
    pulse: true,
  },
  stale: {
    label: "STALE",
    dot: "bg-status-stale",
    text: "text-status-stale",
    ring: "border-status-stale/30 bg-status-stale/10",
    pulse: false,
  },
  error: {
    label: "ERROR",
    dot: "bg-status-error",
    text: "text-status-error",
    ring: "border-status-error/30 bg-status-error/10",
    pulse: false,
  },
  open: {
    label: "OPEN",
    dot: "bg-refx-blueText",
    text: "text-refx-blueText",
    ring: "border-refx-blue bg-refx-blue/5",
    pulse: false,
  },
};

export function StatusPill({
  kind,
  label,
}: {
  kind: StatusKind;
  label?: string;
}) {
  const s = MAP[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${s.ring} ${s.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse-soft shadow-[0_0_8px_2px_rgba(58,210,154,0.6)]" : ""}`}
      />
      {label ?? s.label}
    </span>
  );
}
