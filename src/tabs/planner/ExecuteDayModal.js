export default function ExecuteDayModal({
  S,
  open,
  busy,
  error,

  completedOn,
  setCompletedOn,
  completedBy,
  setCompletedBy,
  notes,
  setNotes,

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
  const disableConfirm = busy || !confirmed || !completedBy.trim();

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Execute day</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Marks training records complete for included attendees.
            </div>
          </div>
        </div>

        <div style={S.modalBody}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={field}>
              <div style={label}>Completed on</div>
              <input
                type="date"
                value={completedOn}
                onChange={(e) => setCompletedOn(e.target.value)}
                style={S.input}
              />
            </div>

            <div style={field}>
              <div style={label}>Completed by</div>
              <input
                value={completedBy}
                onChange={(e) => setCompletedBy(e.target.value)}
                placeholder="Name"
                style={S.input}
              />
            </div>

            <div style={field}>
              <div style={label}>Notes</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
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
              I understand this will mark records complete for included attendees.
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
                {busy ? "Executing…" : "Execute"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
