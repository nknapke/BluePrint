import { formatShortDate } from "../../utils/dates";

function formatRange(plan) {
  const start = plan?.start_date ? formatShortDate(plan.start_date) : "";
  const end = plan?.end_date ? formatShortDate(plan.end_date) : "";
  if (start && end) return `${start}–${end}`;
  return start || "Unknown range";
}

export default function ManagePlansModal({
  S,
  open,
  onClose,
  plans = [],
  activePlanId = null,
  busyId = null,
  error = "",
  onDelete,
}) {
  if (!open) return null;

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Manage plans</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Delete plans you no longer need. This removes the plan schedule and
              attendee changes.
            </div>
          </div>
          <button style={S.button("ghost", false)} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={S.modalBody}>
          {error ? (
            <div style={{ color: "rgba(255,120,120,0.95)", fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          {plans.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              No plans found for this location.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {plans.map((p) => {
                const isActive = Number(p.id) === Number(activePlanId);
                const isBusy = Number(busyId) === Number(p.id);
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: isActive
                        ? "1px solid rgba(0,122,255,0.45)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: isActive
                        ? "linear-gradient(180deg, rgba(0,122,255,0.14) 0%, rgba(0,122,255,0.06) 100%)"
                        : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>
                        {formatRange(p)}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Plan #{p.id}
                        {p.status ? ` · ${p.status}` : ""}
                        {isActive ? " · Active" : ""}
                      </div>
                    </div>

                    <button
                      style={S.button("danger", isBusy)}
                      disabled={isBusy}
                      onClick={() => onDelete?.(p)}
                    >
                      {isBusy ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
