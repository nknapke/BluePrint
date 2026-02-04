export default function MarkCompleteModal({
  S,
  isOpen,
  onClose,
  isBusy,

  // context
  crewName,
  trackName,
  trainingName,

  // form state
  completedDate,
  setCompletedDate,
  signoffBy,
  setSignoffBy,
  notes,
  setNotes,

  // actions
  onConfirm,
}) {
  if (!isOpen) return null;

  const overlayStyle = S.modalOverlay || {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 1000,
  };

  const modalStyle = S.modalCard || {
    width: "min(640px, 100%)",
    borderRadius: 16,
    background: "rgba(20,20,22,0.98)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    overflow: "hidden",
  };

  const headerStyle = S.modalHeader || {
    padding: 16,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  };

  const bodyStyle = S.modalBody || {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const footerStyle = S.modalFooter || {
    padding: 16,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  };

  const labelStyle = S.mini || { fontSize: 12, opacity: 0.75 };

  const inputStyle = S.input || {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
  };

  const textAreaStyle = {
    ...inputStyle,
    minHeight: 90,
    resize: "vertical",
  };

  // NEW: validation
  const signedByClean = (signoffBy || "").trim();
  const canSave = !!completedDate && signedByClean.length > 0;

  return (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Mark Training Complete
            </div>
            <div style={labelStyle}>
              {crewName} · {trackName} · {trainingName}
            </div>
          </div>

          <button
            style={S.button ? S.button("ghost") : undefined}
            onClick={onClose}
            disabled={isBusy}
            title="Close"
          >
            ✕
          </button>
        </div>

        <div style={bodyStyle}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={labelStyle}>Completed Date</div>
              <input
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
                style={inputStyle}
                disabled={isBusy}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={labelStyle}>
                Signed off by{" "}
                <span style={{ opacity: 0.9, fontWeight: 700 }}>
                  · Required
                </span>
              </div>
              <input
                type="text"
                value={signoffBy}
                onChange={(e) => setSignoffBy(e.target.value)}
                style={{
                  ...inputStyle,
                  border:
                    signedByClean.length === 0
                      ? "1px solid rgba(255,59,48,0.55)"
                      : inputStyle.border,
                }}
                placeholder="Enter name"
                disabled={isBusy}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={labelStyle}>Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={textAreaStyle}
              placeholder="Optional"
              disabled={isBusy}
            />
          </div>
        </div>

        <div style={footerStyle}>
          <button
            style={S.button ? S.button("ghost") : undefined}
            onClick={onClose}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            style={S.button ? S.button("primary") : undefined}
            onClick={onConfirm}
            disabled={isBusy || !canSave}
            title={
              !completedDate
                ? "Pick a completed date"
                : signedByClean.length === 0
                ? "Signed off by is required"
                : "Save"
            }
          >
            {isBusy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
