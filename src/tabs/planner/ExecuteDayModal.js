export default function ExecuteDayModal({
  S,
  open,
  busy,
  error,
  rows = [],
  rowsLoading = false,
  rowsError = "",
  onToggleRow,

  completedOn,
  setCompletedOn,
  completedBy,
  setCompletedBy,
  notes,
  setNotes,

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
  const disableConfirm = busy || !completedBy.trim();
  const listCard = {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 8,
  };

  const normalize = (r) => ({
    ...r,
    is_working: !!r.is_working,
    included: !!r.included,
    is_out_of_date: !!r.is_out_of_date,
    no_prior_training: !!r.no_prior_training,
    is_extreme_overdue: !!r.is_extreme_overdue,
  });

  const normalizedRows = Array.isArray(rows) ? rows.map(normalize) : [];
  const selectedCount = normalizedRows.filter(
    (r) => r.included && r.is_working
  ).length;

  const formatTrack = (r) =>
    String(r.track_name || r.track_id || "No track").toUpperCase();
  const statusBits = (r) => {
    const parts = [];
    if (!r.is_working) parts.push("Not working");
    if (!r.included) parts.push("Excluded");
    const hasNoPrior = !!r.no_prior_training;
    if (hasNoPrior) parts.push("No prior history");
    if (r.is_out_of_date && !hasNoPrior) parts.push("Out of date");
    if (r.is_extreme_overdue) parts.push("30+ days overdue");
    if (
      r.included &&
      r.is_working &&
      !r.is_out_of_date &&
      !r.no_prior_training &&
      !r.is_extreme_overdue
    ) {
      parts.push("Current (early completion)");
    }
    return parts;
  };

  const renderRow = (r) => {
    const selected = r.included && r.is_working;
    const disabled = !r.is_working || busy;
    return (
      <div
        key={r.attendee_id || r.crew_id}
        style={{
          display: "grid",
          gap: 6,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.18)",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={() => onToggleRow?.(r)}
          />
          <span>{r.crew_name || "Unknown"}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {formatTrack(r)}
          </span>
        </label>
        {statusBits(r).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {statusBits(r).map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Mark Training Complete</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Marks training records complete for included, working crew — even if
              they are already current.
            </div>
          </div>
        </div>

        <div style={S.modalBody}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={label}>Review completion list</div>

              {rowsLoading ? (
                <div style={{ ...label, opacity: 0.7 }}>Loading crew…</div>
              ) : rowsError ? (
                <div style={{ color: "rgba(255,120,120,0.95)", fontSize: 13 }}>
                  {rowsError}
                </div>
              ) : (
                <>
                  <div style={listCard}>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>
                      Will be completed ({selectedCount})
                    </div>
                    {normalizedRows.length === 0 ? (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        No crew found for this day.
                      </div>
                    ) : (
                      normalizedRows.map((r) => renderRow(r))
                    )}
                  </div>
                </>
              )}
            </div>

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
                {busy ? "Marking…" : "Mark Complete"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
