import type { CSSProperties } from "react";

type ChevronProps = {
  open?: boolean;
  size?: number;
  style?: CSSProperties;
};

export function Chevron({ open = false, size = 26, style }: ChevronProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        display: "grid",
        placeItems: "center",
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 160ms ease",
        lineHeight: 1,
        fontSize: 18,
        fontWeight: 900,
        opacity: 0.9,
        flex: "0 0 auto",
        ...style,
      }}
    >
      ›
    </span>
  );
}
