// AddTrainingModal.js
export default function AddTrainingModal({
  S,
  isOpen,
  onClose,
  isBusy,

  newTrainingId,
  setNewTrainingId,
  newTrainingName,
  setNewTrainingName,
  newTrainingActive,
  setNewTrainingActive,

  trainingGroups = /** @type {import("../../types/domain").TrainingGroup[]} */ (
    []
  ),
  newTrainingGroupId,
  setNewTrainingGroupId,

  newTrainingExpiryMode,
  setNewTrainingExpiryMode,
  newTrainingExpiryWeeks,
  setNewTrainingExpiryWeeks,

  onConfirm,
}) {
  if (!isOpen) return null;

  const expiryMode = newTrainingExpiryMode || "NEVER";
  const sortedGroups = Array.isArray(trainingGroups)
    ? [...trainingGroups].sort((a, b) => {
        const so = Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999);
        if (so !== 0) return so;
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
    : [];

  const labelStyle = { ...S.helper, marginBottom: 6 };
  const formGrid = { display: "grid", gap: 10 };
  const idRow = {
    display: "grid",
    gridTemplateColumns: "auto 160px",
    gap: 10,
    alignItems: "end",
  };
  const twoColGrid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };
  const actionsRow = {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 6,
  };
  const trainingIdInput = {
    ...S.input,
    width: "100%",
    maxWidth: 220,
  };
  const fullWidthSelect = { ...S.select, width: "100%" };

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={S.modalTitle}>Add Training</h3>
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
            {/* Training ID + Active */}
            <div style={idRow}>
              <div>
                <div style={labelStyle}>Training #</div>
                <input
                  value={newTrainingId}
                  onChange={(e) => setNewTrainingId(e.target.value)}
                  style={trainingIdInput}
                  placeholder="e.g. 101"
                  inputMode="numeric"
                />
              </div>

              <div>
                <div style={labelStyle}>Active</div>
                <select
                  value={newTrainingActive}
                  onChange={(e) => setNewTrainingActive(e.target.value)}
                  style={fullWidthSelect}
                >
                  <option value="TRUE">TRUE</option>
                  <option value="FALSE">FALSE</option>
                </select>
              </div>
            </div>

            {/* Training Name */}
            <div>
              <div style={labelStyle}>Training Name</div>
              <input
                value={newTrainingName}
                onChange={(e) => setNewTrainingName(e.target.value)}
                style={S.input}
                placeholder="Training name"
              />
            </div>

            {/* Training Group */}
            <div>
              <div style={labelStyle}>Group</div>
              <select
                value={newTrainingGroupId}
                onChange={(e) => setNewTrainingGroupId(e.target.value)}
                style={S.select}
              >
                <option value="">Ungrouped</option>
                {sortedGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name || `Group ${g.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Expire In */}
            <div style={twoColGrid}>
              <div>
                <div style={labelStyle}>Expire In</div>
                <select
                  value={expiryMode}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewTrainingExpiryMode(v);
                    if (v === "NEVER") {
                      setNewTrainingExpiryWeeks("");
                    } else {
                      const raw = (newTrainingExpiryWeeks || "").trim();
                      if (raw === "" || raw === "0")
                        setNewTrainingExpiryWeeks("1");
                    }
                  }}
                  style={S.select}
                >
                  <option value="NEVER">Never Expires</option>
                  <option value="WEEKS">Expires After</option>
                </select>
              </div>

              <div>
                <div style={labelStyle}>Weeks</div>
                <input
                  value={newTrainingExpiryWeeks}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d*$/.test(v)) setNewTrainingExpiryWeeks(v);
                  }}
                  style={{
                    ...S.input,
                    opacity: expiryMode === "WEEKS" ? 1 : 0.45,
                  }}
                  placeholder={expiryMode === "WEEKS" ? "e.g. 12" : "N/A"}
                  inputMode="numeric"
                  disabled={expiryMode !== "WEEKS"}
                />
              </div>
            </div>

            {/* Actions */}
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
