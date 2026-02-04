export default function ReopenDayModal({
  S,
  open,
  busy,
  error,

  reopenedBy,
  setReopenedBy,
  reason,
  setReason,

  confirmed,
  setConfirmed,

  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Reopen day</div>

        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
          Reopening a day allows you to adjust attendees and execute again. This
          does not undo any training records already completed.
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {/* Reopened by */}
          <div style={S.field}>
            <div style={S.label}>Reopened by</div>
            <input
              value={reopenedBy}
              onChange={(e) => setReopenedBy(e.target.value)}
              placeholder="Name"
              style={S.input}
            />
          </div>

          {/* Reason */}
          <div style={S.field}>
            <div style={S.label}>Reason</div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required"
              style={{
                ...S.input,
                height: 90,
                paddingTop: 10,
                resize: "vertical",
              }}
            />
          </div>

          {/* Confirmation */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy}
            />
            I understand reopening does not undo completions.
          </label>

          {/* Error */}
          {error ? (
            <div style={{ color: "rgba(255,120,120,0.95)", fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button style={S.secondaryBtn} onClick={onClose} disabled={busy}>
              Cancel
            </button>

            <button
              style={{
                ...S.primaryBtn,
                opacity:
                  busy || !confirmed || !reopenedBy.trim() || !reason.trim()
                    ? 0.6
                    : 1,
                cursor:
                  busy || !confirmed || !reopenedBy.trim() || !reason.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
              disabled={
                busy || !confirmed || !reopenedBy.trim() || !reason.trim()
              }
              onClick={onConfirm}
            >
              {busy ? "Reopening…" : "Reopen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
