// src/components/modals/HistoryModal.js
import { formatTimestampShort } from "../../utils/dates";

function formatLoggedLabel(ts) {
  if (!ts) return "";
  return `Logged ${formatTimestampShort(ts)}`;
}

function formatCompletedDate(yyyyMmDd) {
  if (!yyyyMmDd) return "—";
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return String(yyyyMmDd);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function Badge({ text }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.86)",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export default function HistoryModal({
  S,
  isOpen,
  onClose,
  isBusy,

  title,
  subtitle,

  rows,
  error,
  onDeleteRow,
}) {
  if (!isOpen) return null;

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div
        style={{
          ...S.modalCard,
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ ...S.modalHeader, flex: "0 0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h3 style={S.modalTitle}>History</h3>
            <div style={S.helper}>
              <span style={{ fontWeight: 900, opacity: 0.95 }}>{title}</span>
              {subtitle ? (
                <>
                  <span style={{ opacity: 0.55 }}> · </span>
                  <span style={{ opacity: 0.82 }}>{subtitle}</span>
                </>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={S.button("ghost", isBusy)}
              disabled={isBusy}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div
          style={{
            ...S.modalBody,
            flex: "1 1 auto",
            overflowY: "auto",
            paddingRight: 10,
          }}
        >
          {error ? <p style={S.error}>{error}</p> : null}

          {!error && (!rows || rows.length === 0) ? (
            <div style={{ padding: 10, opacity: 0.78 }}>
              No history yet for this record.
            </div>
          ) : null}

          {!error && rows && rows.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((h, idx) => {
                const completed = formatCompletedDate(h.completed_on);
                const logged = formatLoggedLabel(h.created_at);
                const by = (h.completed_by || "").trim();
                const notes = (h.notes || "").trim();

                return (
                  <div
                    key={h.id ?? `${h.completed_on}-${idx}`}
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.18) 100%)",
                      boxShadow: "0 14px 36px rgba(0,0,0,0.18)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 950,
                            letterSpacing: "-0.01em",
                            color: "rgba(255,255,255,0.92)",
                          }}
                        >
                          {completed}
                        </div>

                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            fontWeight: 750,
                            opacity: 0.65,
                          }}
                        >
                          {logged}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <Badge text={by ? `By ${by}` : "By —"} />

                        <button
                          type="button"
                          onClick={() => onDeleteRow?.(h)}
                          disabled={isBusy || !h?.id}
                          style={S.button("ghost", isBusy || !h?.id)}
                          title="Delete this entry"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {notes ? (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 10,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(0,0,0,0.16)",
                          color: "rgba(255,255,255,0.88)",
                          fontSize: 12.5,
                          fontWeight: 750,
                          lineHeight: 1.35,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {notes}
                      </div>
                    ) : (
                      <div
                        style={{ marginTop: 10, opacity: 0.55, fontSize: 12 }}
                      >
                        No notes
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
