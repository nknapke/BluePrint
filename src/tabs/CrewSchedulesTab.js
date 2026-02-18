// src/tabs/CrewSchedulesTab.js
import { useEffect, useMemo, useState } from "react";

import { Segmented } from "../components/ui/Segmented";
import useRosterData from "./planner/useRosterData";
import CrewSchedulesGrid from "./planner/CrewSchedulesGrid";
import CrewSchedulesGridV2 from "./planner/CrewSchedulesGridV2";
import CrewSchedulesDayView from "./planner/CrewSchedulesDayView";
import CrewSchedulesCoverageView from "./planner/CrewSchedulesCoverageView";
import MasterScheduleImportModal from "./planner/MasterScheduleImportModal";
import { isoDate } from "../utils/dates";
import { prettyDept } from "../utils/strings";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrintDay(value) {
  const d = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value || "");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
}

function formatPrintTime(value) {
  if (!value) return "";
  const [hh, mm] = String(value).split(":");
  if (!hh || !mm) return String(value);
  let hour = Number(hh);
  const minute = Number(mm);
  const mer = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${mer}`;
}

export default function CrewSchedulesTab({
  S,
  activeLocationId,
  locationId = null,
  supabaseGet,
  supabasePost,
  supabasePatch,
  supabaseDelete,
  tracks = /** @type {import("../types/domain").Track[]} */ ([]),
}) {
  const locId = activeLocationId ?? locationId ?? null;

  /* ---------- crew schedules view state ---------- */
  const [crewViewMode, setCrewViewMode] = useState("grid"); // grid | gridV2 | day | coverage
  const [crewSearch, setCrewSearch] = useState("");
  const [dayISO, setDayISO] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState("");
  const [printBusy, setPrintBusy] = useState(false);

  /* ---------- roster hook ---------- */
  const roster = useRosterData({
    locId,
    locationId: locId,
    supabaseGet,
    supabasePost,
    supabasePatch,
    supabaseDelete,
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
      await supabaseDelete(
        `/rest/v1/crew_work_shifts?location_id=eq.${Number(
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

  const printCrew = useMemo(() => {
    const list = Array.isArray(roster?.crew) ? roster.crew : [];
    const q = String(crewSearch || "")
      .trim()
      .toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const name = String(c?.crew_name || "").toLowerCase();
      const dept = String(c?.home_department || "").toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [roster?.crew, crewSearch]);

  const printGroupedCrew = useMemo(() => {
    const map = new Map();
    for (const c of printCrew) {
      const dept = prettyDept(c?.home_department);
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(c);
    }
    return Array.from(map.entries())
      .map(([dept, people]) => ({
        dept,
        people: people
          .slice()
          .sort((a, b) =>
            String(a?.crew_name || "").localeCompare(String(b?.crew_name || ""))
          ),
      }))
      .sort((a, b) => a.dept.localeCompare(b.dept));
  }, [printCrew]);

  const trackNameById = useMemo(() => {
    const map = new Map();
    for (const t of tracks || []) {
      const id = Number(t?.id);
      if (!Number.isFinite(id)) continue;
      map.set(id, String(t?.name || `Track ${id}`));
    }
    return map;
  }, [tracks]);

  const handlePrintWeeklyGrid = async () => {
    if (printBusy) return;
    const days = Array.isArray(roster?.dateList) ? roster.dateList : [];
    if (!days.length) return;

    setPrintBusy(true);
    try {
      const getShowsForDate =
        typeof roster?.getShowsForDate === "function"
          ? roster.getShowsForDate
          : () => [];
      const isWorking =
        typeof roster?.isWorking === "function" ? roster.isWorking : () => false;
      const getTrackId =
        typeof roster?.getTrackId === "function" ? roster.getTrackId : () => null;
      const getShift =
        typeof roster?.getShift === "function"
          ? roster.getShift
          : () => ({ startTime: null, endTime: null });

      const dayHeaders = days
        .map((d) => `<th>${escapeHtml(formatPrintDay(d))}</th>`)
        .join("");

      const bodyRows = [];
      for (const group of printGroupedCrew) {
        const span = days.length + 1;
        bodyRows.push(
          `<tr class="dept-row"><td colspan="${span}">${escapeHtml(group.dept)}</td></tr>`
        );

        for (const crew of group.people) {
          const crewName = escapeHtml(crew?.crew_name || "Crew");
          const dayCells = days
            .map((dateISO) => {
              const shift = getShift(dateISO, crew.id) || {};
              const shiftText =
                shift?.startTime || shift?.endTime
                  ? `IN ${formatPrintTime(shift.startTime) || "—"} | OUT ${
                      formatPrintTime(shift.endTime) || "—"
                    }`
                  : "";

              const shows = getShowsForDate(dateISO);
              const workingShowLines = (shows || [])
                .map((show) => {
                  const showId = show?.id ?? null;
                  const working = isWorking(dateISO, crew.id, showId);
                  if (!working) return "";
                  const t = formatPrintTime(show?.time) || "Show";
                  const rawTrackId = getTrackId(dateISO, crew.id, showId);
                  const trackId = Number(rawTrackId);
                  const trackName = Number.isFinite(trackId)
                    ? trackNameById.get(trackId) || `Track ${trackId}`
                    : "No track";
                  const cls = trackName === "No track" ? "show-state warn" : "show-state good";
                  return `<div class="show-line"><span class="show-time">${escapeHtml(
                    t
                  )}</span><span class="${cls}">${escapeHtml(trackName)}</span></div>`;
                })
                .filter(Boolean);

              const hasWorkingShows = workingShowLines.length > 0;
              if (!hasWorkingShows) return "<td></td>";

              const shiftHtml = shiftText
                ? `<div class="shift-line">${escapeHtml(shiftText)}</div>`
                : "";
              return `<td>${shiftHtml}${workingShowLines.join("")}</td>`;
            })
            .join("");

          bodyRows.push(
            `<tr><td class="crew-col"><div class="crew-name">${crewName}</div></td>${dayCells}</tr>`
          );
        }
      }

      const title = "Crew Schedules - Weekly Grid";
      const range = weekLabel ? `Week: ${weekLabel}` : "";
      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      h1 { margin: 0 0 4px; font-size: 20px; }
      h2 { margin: 0 0 12px; font-size: 12px; color: #555; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
      th, td { border: 1px solid #d8dbe3; padding: 4px; vertical-align: top; }
      th { background: #f3f5fb; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
      .crew-col { width: 16%; background: #f9fbff; }
      .crew-name { font-weight: 800; font-size: 11px; }
      .dept-row td {
        background: #e9eefb;
        color: #0b1b3b;
        font-weight: 800;
        letter-spacing: .03em;
        text-transform: uppercase;
      }
      .shift-line {
        margin-bottom: 4px;
        padding: 2px 4px;
        border-radius: 4px;
        border: 1px solid #d7dbe7;
        background: #f5f6fa;
        font-weight: 700;
      }
      .show-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        margin-bottom: 2px;
      }
      .show-time { color: #1f355c; font-weight: 700; }
      .show-state {
        border-radius: 999px;
        padding: 1px 6px;
        border: 1px solid transparent;
        font-weight: 800;
        white-space: nowrap;
      }
      .show-state.good {
        color: #0d4f20;
        background: #e7f6e9;
        border-color: #b9dfc1;
      }
      .show-state.warn {
        color: #7f1d1d;
        background: #fdeceb;
        border-color: #f2c7c3;
      }
      .muted { color: #888; font-style: italic; }
      @media print {
        body { padding: 0; }
        tr, td, th { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <h2>${escapeHtml(range)}</h2>
    <table>
      <thead>
        <tr>
          <th>Crew</th>
          ${dayHeaders}
        </tr>
      </thead>
      <tbody>
        ${bodyRows.join("")}
      </tbody>
    </table>
  </body>
</html>`;

      const win = window.open("", "_blank", "width=1280,height=900");
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } finally {
      setPrintBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Hero */}
      <div style={heroCard}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
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
            <div style={{ marginTop: 8 }}>
              <button style={S.button("ghost")} onClick={roster.retrySaving}>
                Retry sync
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div style={controlCard}>
        <div style={{ ...controlRow, justifyContent: "space-between" }}>
          <div style={{ ...controlRow, gap: 8, flex: "0 1 auto" }}>
            <Segmented
              value={crewViewMode}
              onChange={(v) => setCrewViewMode(v)}
              options={[
                { value: "grid", label: "Week grid" },
                { value: "gridV2", label: "Week grid v2" },
                { value: "day", label: "Single day" },
                { value: "coverage", label: "Show coverage" },
              ]}
            />

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

            <button
              style={S.button("ghost", clearBusy || roster?.savePaused)}
              onClick={clearWeekAssignments}
              disabled={clearBusy || roster?.savePaused}
              title="Clear all assignments for this week"
            >
              {clearBusy ? "Clearing…" : "Clear week"}
            </button>

            <button
              style={S.button("subtle", roster?.savePaused)}
              onClick={() => setImportOpen(true)}
              disabled={roster?.savePaused}
            >
              Import Master Schedule
            </button>

            {crewViewMode === "grid" || crewViewMode === "gridV2" ? (
              <button
                style={S.button("ghost", printBusy)}
                onClick={handlePrintWeeklyGrid}
                disabled={printBusy}
                title="Print weekly crew schedules grid"
              >
                {printBusy ? "Preparing…" : "Print weekly grid"}
              </button>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: "1 1 520px",
              minWidth: 260,
              marginLeft: "auto",
            }}
          >
            <div style={{ flex: "1 1 420px", minWidth: 180, maxWidth: 560 }}>
              <input
                value={crewSearch || ""}
                onChange={(e) => setCrewSearch(e.target.value)}
                placeholder="Search crew or department"
                style={{ ...inputStyle, width: "100%", maxWidth: "none" }}
                disabled={roster?.savePaused}
              />
            </div>
            {crewRangeLabel ? <span style={pill}>{crewRangeLabel}</span> : null}
            {saveState ? (
              <span style={S.badge(saveState.tone)}>{saveState.label}</span>
            ) : null}
          </div>
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
          displayMode="compact"
        />
      ) : crewViewMode === "gridV2" ? (
        <CrewSchedulesGridV2
          S={S}
          roster={roster}
          search={crewSearch}
          tracks={tracks}
        />
      ) : crewViewMode === "coverage" ? (
        <CrewSchedulesCoverageView
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
        onImported={() => roster.refreshAssignments?.(true)}
        locId={locId}
        supabaseGet={supabaseGet}
        supabasePost={supabasePost}
        supabaseDelete={supabaseDelete}
        tracks={tracks}
      />
    </div>
  );
}
