// src/tabs/PlannerTab.js
import { useEffect, useMemo, useState } from "react";

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

  return (
    <div style={S.page}>
      {/* Page header */}
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Training Planner</div>
          <div style={S.pageSubtitle}>
            Plan training and manage crew schedules.
          </div>
        </div>
      </div>

      {/* Top toggle */}
      <div style={{ ...S.card, padding: 12, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Planner</div>

          <div
            style={{
              display: "inline-flex",
              borderRadius: 12,
              padding: 4,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              gap: 4,
            }}
          >
            <button
              onClick={() => setPlannerView("training")}
              style={{
                ...S.secondaryBtn,
                height: 34,
                padding: "0 12px",
                borderRadius: 10,
                background:
                  plannerView === "training"
                    ? "rgba(90,150,255,0.25)"
                    : "rgba(255,255,255,0.02)",
                border:
                  plannerView === "training"
                    ? "1px solid rgba(90,150,255,0.45)"
                    : "1px solid rgba(255,255,255,0.10)",
                fontWeight: 900,
              }}
            >
              Training Schedules
            </button>

            <button
              onClick={() => setPlannerView("crew")}
              style={{
                ...S.secondaryBtn,
                height: 34,
                padding: "0 12px",
                borderRadius: 10,
                background:
                  plannerView === "crew"
                    ? "rgba(90,150,255,0.25)"
                    : "rgba(255,255,255,0.02)",
                border:
                  plannerView === "crew"
                    ? "1px solid rgba(90,150,255,0.45)"
                    : "1px solid rgba(255,255,255,0.10)",
                fontWeight: 900,
              }}
            >
              Crew Schedules
            </button>
          </div>

          {/* Crew save status */}
          {plannerView === "crew" ? (
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900 }}>
                {roster?.isSaving
                  ? "Saving…"
                  : roster?.savedPulse
                  ? "Saved"
                  : ""}
              </div>

              {roster?.savePaused ? (
                <button
                  style={{
                    ...S.secondaryBtn,
                    height: 34,
                    padding: "0 12px",
                    border: "1px solid rgba(255,120,120,0.35)",
                  }}
                  onClick={roster.retrySaving}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {plannerView === "crew" && roster?.savePaused ? (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "rgba(255,120,120,0.95)",
            }}
          >
            Connection issue. Editing is paused.
            <div style={{ marginTop: 6 }}>{roster.saveError}</div>
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
          {/* Crew controls */}
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              style={S.secondaryBtn}
              onClick={() => roster.shiftWeek(-1)}
              disabled={roster?.savePaused}
              title="Previous week"
            >
              Prev
            </button>

            <button
              style={S.secondaryBtn}
              onClick={() => roster.shiftWeek(1)}
              disabled={roster?.savePaused}
              title="Next week"
            >
              Next
            </button>

            <div
              style={{
                display: "inline-flex",
                borderRadius: 12,
                padding: 4,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                gap: 4,
              }}
            >
              <button
                style={{
                  ...S.secondaryBtn,
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 10,
                  background:
                    crewViewMode === "grid"
                      ? "rgba(90,150,255,0.22)"
                      : "rgba(255,255,255,0.02)",
                  border:
                    crewViewMode === "grid"
                      ? "1px solid rgba(90,150,255,0.40)"
                      : "1px solid rgba(255,255,255,0.10)",
                  fontWeight: 900,
                }}
                onClick={() => setCrewViewMode("grid")}
              >
                Grid
              </button>

              <button
                style={{
                  ...S.secondaryBtn,
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 10,
                  background:
                    crewViewMode === "day"
                      ? "rgba(90,150,255,0.22)"
                      : "rgba(255,255,255,0.02)",
                  border:
                    crewViewMode === "day"
                      ? "1px solid rgba(90,150,255,0.40)"
                      : "1px solid rgba(255,255,255,0.10)",
                  fontWeight: 900,
                }}
                onClick={() => setCrewViewMode("day")}
              >
                Day
              </button>
            </div>

            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 900 }}>
              Week: {weekLabel}
            </span>
          </div>

          {/* Day picker (Day view only) */}
          {crewViewMode === "day" ? (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <button
                style={S.secondaryBtn}
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
                style={S.secondaryBtn}
                onClick={() => setDayISO((d) => dayPlus1(d))}
                disabled={roster?.savePaused || !dayISO}
                title="Next day"
              >
                ▶
              </button>
            </div>
          ) : null}

          {/* View render */}
          {crewViewMode === "grid" ? (
            <CrewSchedulesGrid
              S={S}
              roster={roster}
              search={crewSearch}
              setSearch={setCrewSearch}
              weekLabel={weekLabel}
            />
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
