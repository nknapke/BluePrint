export default function AddCrewModal({
  S,
  isOpen,
  onClose,
  isBusy,

  departments,

  newCrewName,
  setNewCrewName,
  newCrewDept,
  setNewCrewDept,
  newCrewStatus,
  setNewCrewStatus,

  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={S.modalTitle}>Add Crew Member</h3>
          <button
            style={S.button("ghost", isBusy)}
            onClick={onClose}
            disabled={isBusy}
          >
            Close
          </button>
        </div>

        <div style={S.modalBody}>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ ...S.helper, marginBottom: 6 }}>Name</div>
              <input
                value={newCrewName}
                onChange={(e) => setNewCrewName(e.target.value)}
                style={S.input}
                placeholder="Crew name"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div>
                <div style={{ ...S.helper, marginBottom: 6 }}>Department</div>
                <select
                  value={newCrewDept}
                  onChange={(e) => setNewCrewDept(e.target.value)}
                  style={S.select}
                >
                  <option value="">No Department</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ ...S.helper, marginBottom: 6 }}>Status</div>
                <select
                  value={newCrewStatus}
                  onChange={(e) => setNewCrewStatus(e.target.value)}
                  style={S.select}
                >
                  <option value="Active">Active</option>
                  <option value="Not Active">Not Active</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 6,
              }}
            >
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
