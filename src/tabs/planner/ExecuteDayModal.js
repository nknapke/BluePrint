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
  
    return (
      <div style={S.modalOverlay} onMouseDown={onClose}>
        <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Execute day</div>
  
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            This will mark training records complete for all trainings in this
            group for included attendees.
          </div>
  
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {/* Completed on */}
            <div style={S.field}>
              <div style={S.label}>Completed on</div>
              <input
                type="date"
                value={completedOn}
                onChange={(e) => setCompletedOn(e.target.value)}
                style={S.input}
              />
            </div>
  
            {/* Completed by */}
            <div style={S.field}>
              <div style={S.label}>Completed by</div>
              <input
                value={completedBy}
                onChange={(e) => setCompletedBy(e.target.value)}
                placeholder="Name"
                style={S.input}
              />
            </div>
  
            {/* Notes */}
            <div style={S.field}>
              <div style={S.label}>Notes</div>
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
              I understand this will mark records complete for included attendees.
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
              <button
                style={S.secondaryBtn}
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
  
              <button
                style={{
                  ...S.primaryBtn,
                  opacity:
                    busy || !confirmed || !completedBy.trim() ? 0.6 : 1,
                  cursor:
                    busy || !confirmed || !completedBy.trim()
                      ? "not-allowed"
                      : "pointer",
                }}
                disabled={busy || !confirmed || !completedBy.trim()}
                onClick={onConfirm}
              >
                {busy ? "Executing…" : "Execute"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  