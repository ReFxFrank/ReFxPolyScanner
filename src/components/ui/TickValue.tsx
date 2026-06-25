"use client";

import { useEffect, useRef, useState } from "react";

// Renders a value that gives a calm, quick highlight tick when it changes —
// so the ~10s auto-refresh reads as "this cell updated" without a jarring
// full-table flash. Reduced-motion users get no animation (handled in CSS).
export function TickValue({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  const prev = useRef(children);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prev.current !== children) {
      prev.current = children;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [children]);

  return (
    <span
      className={`inline-block rounded px-1 ${flash ? "tick-flash" : ""} ${className}`}
    >
      {children}
    </span>
  );
}
