export function createStyles() {
  return {
    page: {
      minHeight: "100vh",
      background: "transparent",
      color: "rgba(255,255,255,0.92)",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      letterSpacing: "-0.01em",
    },
    shell: { maxWidth: 1180, margin: "0 auto", padding: 22 },
    topBar: {
      position: "sticky",
      top: 0,
      zIndex: 5,
      padding: "18px 0 14px 0",
      backdropFilter: "blur(14px)",
      background:
        "linear-gradient(180deg, rgba(11,12,16,0.82) 0%, rgba(11,12,16,0.55) 60%, rgba(11,12,16,0) 100%)",
    },
    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 14,
      flexWrap: "wrap",
    },
    titleBlock: { display: "flex", flexDirection: "column", gap: 6 },
    title: { fontSize: 28, fontWeight: 720, lineHeight: 1.1, margin: 0 },
    subtitle: { margin: 0, fontSize: 13, color: "rgba(255,255,255,0.65)" },
    pillBar: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      padding: 8,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.10)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
      boxShadow:
        "0 10px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
    },
    tabPill: (active) => ({
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
      userSelect: "none",
      fontSize: 13,
      fontWeight: 650,
      letterSpacing: "-0.01em",
      color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
      background: active
        ? "linear-gradient(180deg, rgba(0,122,255,0.92) 0%, rgba(0,122,255,0.68) 100%)"
        : "transparent",
      border: active
        ? "1px solid rgba(0,122,255,0.65)"
        : "1px solid transparent",
      boxShadow: active ? "0 10px 24px rgba(0,122,255,0.25)" : "none",
      transition:
        "transform 120ms ease, background 160ms ease, box-shadow 160ms ease",
    }),
    contentGrid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 14,
      marginTop: 14,
      paddingBottom: 24,
    },
    card: {
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.10)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
      boxShadow:
        "0 18px 50px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)",
      overflow: "hidden",
    },
    cardHeader: {
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
      flexWrap: "wrap",
    },
    cardTitle: { margin: 0, fontSize: 15, fontWeight: 720 },
    cardBody: { padding: 16 },
    row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

    button: (variant = "primary", disabled = false) => {
      const common = {
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
        fontWeight: 650,
        letterSpacing: "-0.01em",
        transition:
          "transform 120ms ease, box-shadow 160ms ease, background 160ms ease",
        userSelect: "none",
      };

      if (variant === "primary") {
        return {
          ...common,
          color: "white",
          background:
            "linear-gradient(180deg, rgba(0,122,255,0.95) 0%, rgba(0,122,255,0.70) 100%)",
          border: "1px solid rgba(0,122,255,0.65)",
          boxShadow: "0 14px 28px rgba(0,122,255,0.25)",
          opacity: disabled ? 0.55 : 1,
        };
      }

      if (variant === "danger") {
        return {
          ...common,
          color: "white",
          background:
            "linear-gradient(180deg, rgba(255,59,48,0.92) 0%, rgba(255,59,48,0.62) 100%)",
          border: "1px solid rgba(255,59,48,0.55)",
          boxShadow: "0 14px 28px rgba(255,59,48,0.18)",
          opacity: disabled ? 0.55 : 1,
        };
      }

      if (variant === "ghost") {
        return {
          ...common,
          color: "rgba(255,255,255,0.86)",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "none",
          opacity: disabled ? 0.55 : 1,
        };
      }

      return {
        ...common,
        color: "rgba(255,255,255,0.86)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
        opacity: disabled ? 0.55 : 1,
      };
    },

    select: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.92)",
      outline: "none",
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      WebkitAppearance: "none",
      appearance: "none",
    },
    input: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.92)",
      outline: "none",
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    helper: { fontSize: 12, color: "rgba(255,255,255,0.62)", fontWeight: 600 },
    badge: (tone) => {
      const base = {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.86)",
      };
      if (tone === "good")
        return {
          ...base,
          border: "1px solid rgba(52,199,89,0.30)",
          background: "rgba(52,199,89,0.12)",
          color: "rgba(214,255,226,0.95)",
        };
      if (tone === "bad")
        return {
          ...base,
          border: "1px solid rgba(255,59,48,0.28)",
          background: "rgba(255,59,48,0.12)",
          color: "rgba(255,210,208,0.95)",
        };
      if (tone === "warn")
        return {
          ...base,
          border: "1px solid rgba(255,204,0,0.30)",
          background: "rgba(255,204,0,0.12)",
          color: "rgba(255,240,200,0.95)",
        };
      if (tone === "info")
        return {
          ...base,
          border: "1px solid rgba(0,122,255,0.28)",
          background: "rgba(0,122,255,0.12)",
          color: "rgba(210,235,255,0.96)",
        };
      return base;
    },

    tableWrap: {
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      overflow: "hidden",
      background: "rgba(0,0,0,0.20)",
    },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
    thead: { background: "rgba(255,255,255,0.06)" },
    th: {
      textAlign: "left",
      padding: "12px 12px",
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "-0.01em",
      color: "rgba(255,255,255,0.70)",
      borderBottom: "1px solid rgba(255,255,255,0.10)",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "12px 12px",
      fontSize: 13,
      fontWeight: 600,
      color: "rgba(255,255,255,0.90)",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      verticalAlign: "middle",
    },
    trHover: { transition: "background 140ms ease" },
    clickableCell: (isActive) => ({
      padding: "10px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      cursor: "pointer",
      userSelect: "none",
      fontSize: 13,
      fontWeight: 800,
      color: isActive ? "rgba(214,255,226,0.95)" : "rgba(255,210,208,0.95)",
      background: isActive ? "rgba(52,199,89,0.10)" : "rgba(255,59,48,0.10)",
    }),
    accordionHeaderCell: {
      cursor: "pointer",
      userSelect: "none",
      fontWeight: 850,
      letterSpacing: "-0.01em",
      background: "rgba(255,255,255,0.06)",
      borderBottom: "1px solid rgba(255,255,255,0.10)",
    },
    error: {
      margin: 0,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,59,48,0.25)",
      background: "rgba(255,59,48,0.12)",
      color: "rgba(255,210,208,0.95)",
      fontSize: 13,
      fontWeight: 650,
    },
    loading: {
      margin: 0,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.78)",
      fontSize: 13,
      fontWeight: 650,
    },
    mini: { fontSize: 12, color: "rgba(255,255,255,0.62)", fontWeight: 650 },

    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
      padding: 16,
    },
    modalCard: {
      width: "min(640px, 100%)",
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.12)",
      background:
        "linear-gradient(180deg, rgba(20,22,30,0.92) 0%, rgba(12,13,18,0.92) 100%)",
      boxShadow:
        "0 30px 90px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
      overflow: "hidden",
    },
    modalHeader: {
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderBottom: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.04)",
    },
    modalTitle: { margin: 0, fontSize: 14, fontWeight: 800 },
    modalBody: { padding: 16 },
  };
}
