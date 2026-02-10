import type { CSSProperties } from "react";

type ChevronProps = {
  open?: boolean;
  size?: number;
  style?: CSSProperties;
};

const CHEVRON_BASE_STYLE: CSSProperties = {
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.06)",
  transition: "transform 160ms ease",
  lineHeight: 1,
  fontSize: 18,
  fontWeight: 900,
  opacity: 0.9,
  flex: "0 0 auto",
};

export function Chevron({ open = false, size = 26, style }: ChevronProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        ...CHEVRON_BASE_STYLE,
        width: size,
        height: size,
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        ...style,
      }}
    >
      ›
    </span>
  );
}
