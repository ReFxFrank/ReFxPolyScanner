import { forwardRef } from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** Adds a thin blue-tinted glow + border, e.g. for the active/selected panel. */
  accent?: boolean;
  /** Adds the faint top-edge beam highlight. */
  beam?: boolean;
  as?: "div" | "section";
};

// The core layered dark-glass surface. Inset modules (cards, tables) live
// inside the shell using this. Moderate radius, thin border, soft shadow.
export const GlassPanel = forwardRef<HTMLDivElement, Props>(function GlassPanel(
  { accent, beam, className = "", children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={[
        "relative rounded-refx glass",
        beam ? "beam-top" : "",
        accent ? "shadow-refx-blue" : "shadow-refx",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
});
