const STATUS_DOT_STYLE = {
  width: 7,
  height: 7,
  borderRadius: 999,
};

const STATUS_DOT = {
  active: {
    background: "rgba(52,199,89,0.95)",
    boxShadow: "0 0 0 3px rgba(52,199,89,0.12)",
  },
  inactive: {
    background: "rgba(255,59,48,0.95)",
    boxShadow: "0 0 0 3px rgba(255,59,48,0.12)",
  },
};

export function StatusBadge({ S, active }) {
  const dotStyle = active ? STATUS_DOT.active : STATUS_DOT.inactive;
  return (
    <span style={S.badge(active ? "good" : "bad")}>
      <span style={{ ...STATUS_DOT_STYLE, ...dotStyle }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function BoolBadge({ S, value }) {
  return (
    <span style={S.badge(value ? "good" : "bad")}>
      {value ? "TRUE" : "FALSE"}
    </span>
  );
}
