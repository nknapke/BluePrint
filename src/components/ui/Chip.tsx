type ChipProps = {
  text: string;
  onClear: () => void;
};

export function Chip({ text, onClear }: ChipProps) {
  return (
    <span
      style={{
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
      }}
    >
      <span style={{ opacity: 0.92 }}>{text}</span>
      <button
        type="button"
        onClick={onClear}
        style={{
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
        }}
        title="Clear"
      >
        ×
      </button>
    </span>
  );
}
