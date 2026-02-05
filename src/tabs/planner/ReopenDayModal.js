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

  const field = { display: "grid", gap: 6 };
  const label = {
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(255,255,255,0.7)",
  };
  const disableConfirm =
    busy || !confirmed || !reopenedBy.trim() || !reason.trim();

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Reopen day</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Reopening lets you adjust attendees and execute again.
            </div>
          </div>
        </div>

        <div style={S.modalBody}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={field}>
              <div style={label}>Reopened by</div>
              <input
                value={reopenedBy}
                onChange={(e) => setReopenedBy(e.target.value)}
                placeholder="Name"
                style={S.input}
              />
            </div>

            <div style={field}>
              <div style={label}>Reason</div>
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

            {error ? (
              <div style={{ color: "rgba(255,120,120,0.95)", fontSize: 13 }}>
                {error}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button style={S.button("ghost", busy)} onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                style={S.button("primary", disableConfirm)}
                disabled={disableConfirm}
                onClick={onConfirm}
              >
                {busy ? "Reopening…" : "Reopen"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
