type IdMetaProps = {
  id: string | number;
  label?: string;
  title?: string;
};

const ID_META_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,0.72)",
  whiteSpace: "nowrap" as const,
};

export function IdMeta({ id, label = "#", title }: IdMetaProps) {
  return (
    <span
      style={ID_META_STYLE}
      title={title ?? (label === "#" ? "Track #" : "Database Primary Key")}
    >
      {label} {id}
    </span>
  );
}
