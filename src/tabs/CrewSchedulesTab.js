// src/tabs/CrewSchedulesTab.js
import { useEffect, useMemo, useState } from "react";

import { Segmented } from "../components/ui/Segmented";
import useRosterData from "./planner/useRosterData";
import CrewSchedulesGrid from "./planner/CrewSchedulesGrid";
import CrewSchedulesDayView from "./planner/CrewSchedulesDayView";
import MasterScheduleImportModal from "./planner/MasterScheduleImportModal";
import { isoDate } from "../utils/dates";

export default function CrewSchedulesTab({
  S,
  activeLocationId,
  locationId = null,
  supabaseGet,
  supabasePost,
  supabaseDelete,
  tracks = /** @type {import("../types/domain").Track[]} */ ([]),
}) {
  const locId = activeLocationId ?? locationId ?? null;

  /* ---------- crew schedules view state ---------- */
  const [crewViewMode, setCrewViewMode] = useState("grid"); // grid | day
  const [crewSearch, setCrewSearch] = useState("");
  const [dayISO, setDayISO] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState("");

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

  const crewRangeLabel = useMemo(() => {
    if (!weekLabel) return "";
    const len = roster?.dateList?.length || 0;
    if (len >= 14) return `2-week: ${weekLabel}`;
    return `Week: ${weekLabel}`;
  }, [weekLabel, roster?.dateList?.length]);

  /* Keep Day View synced to the current week start */
  useEffect(() => {
    if (roster?.startISO) setDayISO(roster.startISO);
  }, [roster?.startISO]);

  function dayMinus1(iso) {
    if (!iso) return "";
    return isoDate(
      new Date(new Date(`${iso}T00:00:00`).getTime() - 86400000)
    );
  }

  function dayPlus1(iso) {
    if (!iso) return "";
    return isoDate(
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

  const clearWeekAssignments = async () => {
    if (!locId || !roster?.startISO || !roster?.endISO || clearBusy) return;
    const ok = window.confirm(
      `Clear all assignments for ${roster.startISO} to ${roster.endISO}? This cannot be undone.`
    );
    if (!ok) return;
    setClearBusy(true);
    setClearError("");
    try {
      await supabaseDelete(
        `/rest/v1/work_roster_assignments?location_id=eq.${Number(
          locId
        )}&work_date=gte.${roster.startISO}&work_date=lte.${roster.endISO}`
      );
      roster.refreshAssignments?.(true);
    } catch (e) {
      setClearError(String(e?.message || e));
    } finally {
      setClearBusy(false);
    }
  };

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
            <div style={heroTitle}>Crew Schedules</div>
            <div style={heroSubtitle}>
              Weekly Crew Schedules and Track Assignments
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
            {crewRangeLabel ? <span style={pill}>{crewRangeLabel}</span> : null}

            {saveState ? (
              <span style={S.badge(saveState.tone)}>{saveState.label}</span>
            ) : null}

            {roster?.savePaused ? (
              <button style={S.button("ghost")} onClick={roster.retrySaving}>
                Retry sync
              </button>
            ) : null}
          </div>
        </div>

        {roster?.savePaused ? (
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

          <button
            style={S.button("ghost", clearBusy || roster?.savePaused)}
            onClick={clearWeekAssignments}
            disabled={clearBusy || roster?.savePaused}
            title="Clear all assignments for this week"
          >
            {clearBusy ? "Clearing…" : "Clear week"}
          </button>

          <button style={S.button("subtle")} onClick={() => setImportOpen(true)}>
            Import Master Schedule
          </button>

          <div
            style={{
              flex: "1 1 320px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <input
              value={crewSearch || ""}
              onChange={(e) => setCrewSearch(e.target.value)}
              placeholder="Search crew or department"
              style={{ ...inputStyle, width: "100%" }}
              disabled={roster?.savePaused}
            />
          </div>

          {crewRangeLabel ? (
            <span style={{ ...pill, marginLeft: "auto" }}>
              {crewRangeLabel}
            </span>
          ) : null}
        </div>

      {crewViewMode === "day" ? (
        <div style={{ ...controlRow, marginTop: 10 }}>
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
          </div>
        ) : null}
      </div>

      {clearError ? (
        <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
          {clearError}
        </div>
      ) : null}

      {/* View render */}
      {crewViewMode === "grid" ? (
        <CrewSchedulesGrid
          S={S}
          roster={roster}
          search={crewSearch}
          tracks={tracks}
        />
      ) : (
        <CrewSchedulesDayView
          S={S}
          roster={roster}
          dateISO={dayISO} // FIX: prevents "undefined" date saves
          search={crewSearch}
          tracks={tracks}
        />
      )}

      <MasterScheduleImportModal
        S={S}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        locId={locId}
        supabaseGet={supabaseGet}
        supabasePost={supabasePost}
        supabaseDelete={supabaseDelete}
        tracks={tracks}
      />
    </div>
  );
}
