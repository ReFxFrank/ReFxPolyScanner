"use client";

import { forwardRef } from "react";

// ── Themed controls — premium hardware/software feel, not stock web. ────────

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const BTN: Record<NonNullable<BtnProps["variant"]>, string> = {
  // Blue glass/gradient, white text, subtle lift.
  primary:
    "bg-refx-blue-glass text-white border border-refx-blue-strong shadow-refx-glow hover:brightness-110 active:translate-y-px",
  // Dark glass, faint border, understated hover.
  secondary:
    "glass text-refx-muted border border-refx-soft hover:text-refx-text hover:border-refx-blue",
  ghost: "text-refx-meta hover:text-refx-text",
  danger:
    "bg-status-error/10 text-status-error border border-status-error/25 hover:bg-status-error/20",
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", className = "", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-refx-sm px-3 py-1.5 text-sm font-medium transition-[transform,background-color,border-color,filter] duration-150 disabled:opacity-50 disabled:pointer-events-none",
        BTN[variant],
        className,
      ].join(" ")}
      {...rest}
    />
  );
});

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={[
        "rounded-refx-sm border border-refx-soft bg-refx-900/60 px-2.5 py-1.5 text-sm text-refx-text placeholder:text-refx-meta outline-none transition-colors duration-150",
        "focus:border-refx-blue focus:shadow-refx-glow",
        className,
      ].join(" ")}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className = "", children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={[
        "rounded-refx-sm border border-refx-soft bg-refx-800 px-2.5 py-1.5 text-sm text-refx-text outline-none transition-colors duration-150 hover:border-refx-blue focus:border-refx-blue",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}
