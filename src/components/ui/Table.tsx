"use client";

// Reusable ReFx data-table primitives: glass container, sticky uppercase
// eyebrow header, sortable headers with an accent-blue arrow, very-low-opacity
// hairline row separation (no zebra striping).

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-refx glass shadow-refx">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-refx-800/90 backdrop-blur">
      <tr className="border-b border-refx-soft text-left">{children}</tr>
    </thead>
  );
}

export function HeaderCell({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2.5 ${className}`}>
      <span className="eyebrow">{children}</span>
    </th>
  );
}

export function SortHeader({
  children,
  active,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={`group cursor-pointer select-none px-3 py-2.5 ${className}`}
    >
      <span
        className={`eyebrow inline-flex items-center gap-1 transition-colors group-hover:text-refx-blueHi ${active ? "!text-refx-blueText" : ""}`}
      >
        {children}
        <span
          className={`text-[9px] transition-colors ${active ? "text-refx-blue" : "text-refx-meta/50 group-hover:text-refx-blueText"}`}
        >
          ▾
        </span>
      </span>
    </th>
  );
}

export function Row({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={[
        "group border-t border-white/[0.04] transition-colors duration-150",
        onClick ? "cursor-pointer" : "",
        selected
          ? "bg-refx-blue/10 shadow-[inset_3px_0_0_0_var(--refx-blue)]"
          : "hover:bg-white/[0.025] hover:shadow-[inset_3px_0_0_0_rgba(0,114,255,0.55)]",
      ].join(" ")}
    >
      {children}
    </tr>
  );
}
