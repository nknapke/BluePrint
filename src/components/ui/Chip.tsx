import type { CSSProperties } from "react";

type ChipProps = {
  text: string;
  onClear: () => void;
};

const CHIP_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.88)",
  fontSize: 12,
  fontWeight: 800,
  userSelect: "none",
  whiteSpace: "nowrap",
};

const CHIP_TEXT_STYLE: CSSProperties = { opacity: 0.92 };

const CHIP_BUTTON_STYLE: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.18)",
  color: "rgba(255,255,255,0.88)",
  cursor: "pointer",
  fontWeight: 900,
  lineHeight: 1,
  display: "grid",
  placeItems: "center",
};

export function Chip({ text, onClear }: ChipProps) {
  return (
    <span style={CHIP_STYLE}>
      <span style={CHIP_TEXT_STYLE}>{text}</span>
      <button
        type="button"
        onClick={onClear}
        style={CHIP_BUTTON_STYLE}
        title="Clear"
      >
        ×
      </button>
    </span>
  );
}
