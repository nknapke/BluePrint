type DotCountProps = {
  color: string;
  count: number;
  title?: string;
};

const DOT_COUNT_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,0.88)",
  whiteSpace: "nowrap" as const,
};

const DOT_STYLE = {
  width: 8,
  height: 8,
  borderRadius: 999,
  boxShadow: "0 0 0 3px rgba(255,255,255,0.06)",
};

export function DotCount({ color, count, title }: DotCountProps) {
  return (
    <span
      title={title}
      style={{
        ...DOT_COUNT_STYLE,
        opacity: count === 0 ? 0.6 : 1,
      }}
    >
      <span
        style={{
          ...DOT_STYLE,
          background: color,
          opacity: count === 0 ? 0.55 : 1,
        }}
      />
      {count}
    </span>
  );
}
