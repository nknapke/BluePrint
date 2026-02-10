export default function AddTrackModal({
  S,
  isOpen,
  onClose,
  isBusy,

  newTrackId,
  setNewTrackId,
  newTrackName,
  setNewTrackName,
  newTrackActive,
  setNewTrackActive,

  onConfirm,
}) {
  if (!isOpen) return null;

  const inputTight = {
    ...S.input,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  };

  const selectTight = {
    ...S.select,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  };

  const labelStyle = { ...S.helper, marginBottom: 6 };
  const formGrid = { display: "grid", gap: 10 };
  const idRow = {
    display: "grid",
    gridTemplateColumns: "0.6fr 1.4fr",
    gap: 12,
    alignItems: "end",
  };
  const actionsRow = {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 6,
  };

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={S.modalTitle}>Add Track</h3>
          <button
            style={S.button("ghost", isBusy)}
            onClick={onClose}
            disabled={isBusy}
          >
            Close
          </button>
        </div>

        <div style={S.modalBody}>
          <div style={formGrid}>
            <div style={idRow}>
              <div style={{ minWidth: 0 }}>
                <div style={labelStyle}>Track #</div>
                <input
                  value={newTrackId}
                  onChange={(e) => setNewTrackId(e.target.value)}
                  style={inputTight}
                  placeholder="e.g. 12"
                  inputMode="numeric"
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={labelStyle}>Track Name</div>
                <input
                  value={newTrackName}
                  onChange={(e) => setNewTrackName(e.target.value)}
                  style={inputTight}
                  placeholder="e.g. Head Carpenter"
                />
              </div>
            </div>

            <div style={{ maxWidth: 240 }}>
              <div style={labelStyle}>Active</div>
              <select
                value={newTrackActive}
                onChange={(e) => setNewTrackActive(e.target.value)}
                style={selectTight}
              >
                <option value="TRUE">TRUE</option>
                <option value="FALSE">FALSE</option>
              </select>
            </div>

            <div style={actionsRow}>
              <button
                style={S.button("ghost", isBusy)}
                onClick={onClose}
                disabled={isBusy}
              >
                Cancel
              </button>
              <button
                style={S.button("primary", isBusy)}
                onClick={onConfirm}
                disabled={isBusy}
              >
                {isBusy ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
