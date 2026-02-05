// src/tabs/PlannerTab.js
import { useEffect, useMemo, useState } from "react";

import { Segmented } from "../components/ui/Segmented";
import useRosterData from "./planner/useRosterData";
import CrewSchedulesGrid from "./planner/CrewSchedulesGrid";
import CrewSchedulesDayView from "./planner/CrewSchedulesDayView";
import TrainingPlannerPanel from "./planner/TrainingPlannerPanel";

/* ---------------- helpers ---------------- */

function fmtDateISO(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ---------------- PlannerTab ---------------- */

export default function PlannerTab({
  S,
  activeLocationId,
  locationId = null,
  supabaseRpc,
  supabaseGet,
  supabasePost,
  supabasePatch,
  trainingGroups = /** @type {import("../types/domain").TrainingGroup[]} */ ([]),
}) {
  const locId = activeLocationId ?? locationId ?? null;

  /* ---------- top level view ---------- */
  const [plannerView, setPlannerView] = useState("training"); // training | crew

  /* ---------- crew schedules view state ---------- */
  const [crewViewMode, setCrewViewMode] = useState("grid"); // grid | day
  const [crewSearch, setCrewSearch] = useState("");
  const [dayISO, setDayISO] = useState("");

  /* ---------- roster hook ---------- */
  const roster = useRosterData({
    locId,
    locationId: locId,
    supabaseGet,
    supabasePost,
    days: 7,
  });

  const weekLabel = useMemo(() => {
    const a = roster?.startISO || "";
    const b = roster?.endISO || "";
    if (a && b) return `${a} to ${b}`;
    if (roster?.dateList?.length) {
      const dl = roster.dateList;
      return `${dl[0]} to ${dl[dl.length - 1]}`;
    }
    return "";
  }, [roster?.startISO, roster?.endISO, roster?.dateList]);

  /* Keep Day View synced to the current week start */
  useEffect(() => {
    if (roster?.startISO) setDayISO(roster.startISO);
  }, [roster?.startISO]);

  function dayMinus1(iso) {
    if (!iso) return "";
    return fmtDateISO(
      new Date(new Date(`${iso}T00:00:00`).getTime() - 86400000)
    );
  }

  function dayPlus1(iso) {
    if (!iso) return "";
    return fmtDateISO(
      new Date(new Date(`${iso}T00:00:00`).getTime() + 86400000)
    );
  }

  const saveState = useMemo(() => {
    if (roster?.savePaused) return { label: "Offline", tone: "bad" };
    if (roster?.isSaving) return { label: "Saving", tone: "info" };
    if (roster?.savedPulse) return { label: "Saved", tone: "good" };
    return null;
  }, [roster?.savePaused, roster?.isSaving, roster?.savedPulse]);

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

  const pill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(255,255,255,0.86)",
  };

  const controlCard = {
    ...S.card,
    padding: 16,
    borderRadius: 20,
  };

  const controlRow = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  };

  const inputStyle = { ...S.input, height: 36, maxWidth: 360 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Hero */}
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
              Plan training and manage crew schedules in one place.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Segmented
              value={plannerView}
              onChange={(v) => setPlannerView(v)}
              options={[
                { value: "training", label: "Training" },
                { value: "crew", label: "Crew" },
              ]}
            />

            {plannerView === "crew" && weekLabel && (
              <span style={pill}>Week of {weekLabel}</span>
            )}

            {plannerView === "crew" && saveState ? (
              <span style={S.badge(saveState.tone)}>{saveState.label}</span>
            ) : null}

            {plannerView === "crew" && roster?.savePaused ? (
              <button
                style={S.button("ghost")}
                onClick={roster.retrySaving}
              >
                Retry sync
              </button>
            ) : null}
          </div>
        </div>

        {plannerView === "crew" && roster?.savePaused ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,59,48,0.35)",
              background: "rgba(255,59,48,0.12)",
              color: "rgba(255,210,208,0.95)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Connection issue. Editing is paused.
            <div style={{ marginTop: 6, opacity: 0.9 }}>
              {roster.saveError}
            </div>
          </div>
        ) : null}
      </div>

      {/* TRAINING VIEW */}
      {plannerView === "training" ? (
        <TrainingPlannerPanel
          S={S}
          locId={locId}
          supabaseRpc={supabaseRpc}
          supabaseGet={supabaseGet}
          supabasePatch={supabasePatch}
          supabasePost={supabasePost}
          trainingGroups={trainingGroups}
        />
      ) : null}

      {/* CREW VIEW */}
      {plannerView === "crew" ? (
        <>
          <div style={controlCard}>
            <div style={controlRow}>
              <Segmented
                value={crewViewMode}
                onChange={(v) => setCrewViewMode(v)}
                options={[
                  { value: "grid", label: "Week grid" },
                  { value: "day", label: "Single day" },
                ]}
              />

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={S.button("ghost", roster?.savePaused)}
                  onClick={() => roster.shiftWeek(-1)}
                  disabled={roster?.savePaused}
                  title="Previous week"
                >
                  Prev
                </button>

                <button
                  style={S.button("ghost", roster?.savePaused)}
                  onClick={() => roster.shiftWeek(1)}
                  disabled={roster?.savePaused}
                  title="Next week"
                >
                  Next
                </button>
              </div>

              {weekLabel ? (
                <span style={{ ...pill, marginLeft: "auto" }}>{weekLabel}</span>
              ) : null}
            </div>

            <div style={{ ...controlRow, marginTop: 10 }}>
              <input
                value={crewSearch || ""}
                onChange={(e) => setCrewSearch(e.target.value)}
                placeholder="Search crew or department"
                style={inputStyle}
                disabled={roster?.savePaused}
              />

              {crewViewMode === "day" ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: 6,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  <button
                    style={S.button("ghost", roster?.savePaused || !dayISO)}
                    onClick={() => setDayISO((d) => dayMinus1(d))}
                    disabled={roster?.savePaused || !dayISO}
                    title="Previous day"
                  >
                    ◀
                  </button>

                  <input
                    type="date"
                    value={dayISO || ""}
                    onChange={(e) => setDayISO(e.target.value)}
                    style={{ ...S.input, height: 34, maxWidth: 190 }}
                    disabled={roster?.savePaused}
                  />

                  <button
                    style={S.button("ghost", roster?.savePaused || !dayISO)}
                    onClick={() => setDayISO((d) => dayPlus1(d))}
                    disabled={roster?.savePaused || !dayISO}
                    title="Next day"
                  >
                    ▶
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* View render */}
          {crewViewMode === "grid" ? (
            <CrewSchedulesGrid S={S} roster={roster} search={crewSearch} />
          ) : (
            <CrewSchedulesDayView
              S={S}
              roster={roster}
              dateISO={dayISO} // FIX: prevents "undefined" date saves
              search={crewSearch}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
