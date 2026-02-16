// src/tabs/PlannerTab.js
import TrainingPlannerPanel from "./planner/TrainingPlannerPanel";

/* ---------------- PlannerTab ---------------- */

export default function PlannerTab({
  S,
  activeLocationId,
  locationId = null,
  supabaseRpc,
  supabaseGet,
  supabasePost,
  supabasePatch,
  supabaseDelete,
  trainingGroups = /** @type {import("../types/domain").TrainingGroup[]} */ ([]),
  tracks = /** @type {import("../types/domain").Track[]} */ ([]),
  refreshSignal = 0,
}) {
  const locId = activeLocationId ?? locationId ?? null;

  const heroCard = {
    ...S.card,
    padding: 18,
    borderRadius: 22,
    background:
      "linear-gradient(150deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.2) 100%)",
  };

  const heroTitle = {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    margin: 0,
  };

  const heroSubtitle = {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.68)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={heroCard}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 220 }}>
            <div style={heroTitle}>Training Planner</div>
            <div style={heroSubtitle}>
              Weekly Training Schedules and Track Assignments
            </div>
          </div>
        </div>
      </div>

      <TrainingPlannerPanel
        S={S}
        locId={locId}
        supabaseRpc={supabaseRpc}
        supabaseGet={supabaseGet}
        supabasePatch={supabasePatch}
        supabasePost={supabasePost}
        supabaseDelete={supabaseDelete}
        trainingGroups={trainingGroups}
        refreshSignal={refreshSignal}
      />
    </div>
  );
}
