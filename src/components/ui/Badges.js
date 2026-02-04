export function StatusBadge({ S, active }) {
  return (
    <span style={S.badge(active ? "good" : "bad")}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: active ? "rgba(52,199,89,0.95)" : "rgba(255,59,48,0.95)",
          boxShadow: active
            ? "0 0 0 3px rgba(52,199,89,0.12)"
            : "0 0 0 3px rgba(255,59,48,0.12)",
        }}
      />
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
