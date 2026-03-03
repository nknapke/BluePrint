// src/tabs/CrewSchedulesTab.js
import { useEffect, useMemo, useState } from "react";

import { Segmented } from "../components/ui/Segmented";
import useRosterData from "./planner/useRosterData";
import CrewSchedulesGridV2 from "./planner/CrewSchedulesGridV2";
import CrewSchedulesDayView from "./planner/CrewSchedulesDayView";
import CrewSchedulesCoverageView from "./planner/CrewSchedulesCoverageView";
import MasterScheduleImportModal from "./planner/MasterScheduleImportModal";
import { isoDate } from "../utils/dates";
import { normalizeHex, trackGlowFromHex } from "../utils/colors";
import { matchesCrewScheduleDeptFilter, prettyDept } from "../utils/strings";

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

function formatPrintHours(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

function weekdayFromISO(value) {
  const d = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

function normalizeWeekdayNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0 || i > 6) return null;
  return i;
}

function employmentSortRank(crew) {
  const value = String(crew?.employment_type || crew?.employmentType || "")
    .trim()
    .toLowerCase();
  if (value === "on-call" || value === "on call" || value === "oncall") return 1;
  return 0;
}

function compareCrewForSchedule(a, b) {
  const leadRankA = a?.is_department_lead ? 0 : 1;
  const leadRankB = b?.is_department_lead ? 0 : 1;
  if (leadRankA !== leadRankB) return leadRankA - leadRankB;

  const employmentRankA = employmentSortRank(a);
  const employmentRankB = employmentSortRank(b);
  if (employmentRankA !== employmentRankB) {
    return employmentRankA - employmentRankB;
  }

  return String(a?.crew_name || "").localeCompare(String(b?.crew_name || ""));
}

export default function CrewSchedulesTab({
  S,
  activeLocationId,
  locationId = null,
  departmentFilter = "ALL",
  refreshSignal = 0,
  supabaseGet,
  supabasePost,
  supabasePatch,
  supabaseDelete,
  tracks = /** @type {import("../types/domain").Track[]} */ ([]),
}) {
  const locId = activeLocationId ?? locationId ?? null;

  /* ---------- crew schedules view state ---------- */
  const [crewViewMode, setCrewViewMode] = useState("gridV2"); // gridV2 | day | coverage
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
  const refreshAssignments = roster?.refreshAssignments;

  useEffect(() => {
    if (!refreshSignal) return;
    if (typeof refreshAssignments === "function") {
      refreshAssignments(true);
    }
  }, [refreshAssignments, refreshSignal]);

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

  const isGridV2View = crewViewMode === "gridV2";
  const undoDisabled =
    !isGridV2View ||
    !!roster?.savePaused ||
    !!roster?.historyApplying ||
    !roster?.canUndo;
  const redoDisabled =
    !isGridV2View ||
    !!roster?.savePaused ||
    !!roster?.historyApplying ||
    !roster?.canRedo;
  const undoAction = roster?.undo;
  const redoAction = roster?.redo;

  useEffect(() => {
    if (!isGridV2View) return undefined;

    const handleUndoRedoKey = (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      const tag = String(target?.tagName || "").toLowerCase();
      const isTypingTarget =
        target?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select";
      if (isTypingTarget) return;

      const hasCommand = event.metaKey || event.ctrlKey;
      if (!hasCommand || event.altKey) return;
      const key = String(event.key || "").toLowerCase();
      if (key === "z") {
        if (event.shiftKey) {
          if (redoDisabled) return;
          event.preventDefault();
          void redoAction?.();
        } else {
          if (undoDisabled) return;
          event.preventDefault();
          void undoAction?.();
        }
        return;
      }
      if (key === "y") {
        if (redoDisabled) return;
        event.preventDefault();
        void redoAction?.();
      }
    };

    window.addEventListener("keydown", handleUndoRedoKey);
    return () => window.removeEventListener("keydown", handleUndoRedoKey);
  }, [
    isGridV2View,
    undoAction,
    redoAction,
    undoDisabled,
    redoDisabled,
  ]);

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
    return list.filter((c) => {
      if (!matchesCrewScheduleDeptFilter(c?.home_department, departmentFilter)) {
        return false;
      }
      if (!q) return true;
      const name = String(c?.crew_name || "").toLowerCase();
      const dept = String(c?.home_department || "").toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [roster?.crew, crewSearch, departmentFilter]);

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
        people: people.slice().sort(compareCrewForSchedule),
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

  const trackColorById = useMemo(() => {
    const map = new Map();
    for (const t of tracks || []) {
      const id = Number(t?.id);
      if (!Number.isFinite(id)) continue;
      const hex = normalizeHex(t?.color);
      if (!hex) continue;
      map.set(id, hex);
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
      const getDayHours =
        typeof roster?.getDayHours === "function" ? roster.getDayHours : () => null;
      const getWeekHours =
        typeof roster?.getWeekHours === "function" ? roster.getWeekHours : () => null;

      const showColumnCountForDate = (dateISO) => {
        const count = getShowsForDate(dateISO).length;
        const clamped = Math.min(4, Math.max(0, count));
        if (clamped === 1) return 2;
        return Math.max(1, clamped);
      };

      const colsForDate = (dateISO) => showColumnCountForDate(dateISO);
      const showSlotsForDate = (dateISO) => {
        const cols = colsForDate(dateISO);
        const list = getShowsForDate(dateISO);
        const trimmed = list.slice(0, cols);
        const count = trimmed.length;
        const slots = Array.from({ length: cols }, () => null);
        const rightStart = Math.max(0, cols - count);
        for (let i = 0; i < count; i += 1) {
          slots[rightStart + i] = { kind: "show", show: trimmed[i] };
        }
        if (count < cols) {
          const addIndex = Math.max(0, rightStart - 1);
          slots[addIndex] = { kind: "add" };
        }
        return slots;
      };

      const totalShowCols = days.reduce((sum, dateISO) => sum + colsForDate(dateISO), 0);

      const getDayDescriptionForDay = (dateISO, crewId) => {
        const shift = getShift(dateISO, crewId) || {};
        return String(shift?.dayDescription || "").trim();
      };

      const hasWorkingShowForDay = (dateISO, crewId) =>
        showSlotsForDate(dateISO).some((slot) => {
          if (slot?.kind !== "show") return false;
          const showId = slot?.show?.id ?? null;
          return isWorking(dateISO, crewId, showId);
        });

      const hasCompleteShiftForDay = (dateISO, crewId) => {
        const shift = getShift(dateISO, crewId) || {};
        return !!(shift?.startTime && shift?.endTime);
      };

      const hasDayDescriptionForDay = (dateISO, crewId) => {
        const dayDescription = getDayDescriptionForDay(dateISO, crewId);
        return !!dayDescription && dayDescription.toUpperCase() !== "OFF";
      };

      const hasDayDataForCrew = (dateISO, crewId) =>
        hasCompleteShiftForDay(dateISO, crewId) ||
        hasWorkingShowForDay(dateISO, crewId) ||
        hasDayDescriptionForDay(dateISO, crewId);

      const isWeeklyOffDayForCrew = (dateISO, crew) => {
        const weekday = weekdayFromISO(dateISO);
        if (weekday === null) return false;
        const weeklyOffDays = [
          normalizeWeekdayNumber(crew?.weeklyOffDay1 ?? crew?.weekly_off_day_1),
          normalizeWeekdayNumber(crew?.weeklyOffDay2 ?? crew?.weekly_off_day_2),
        ].filter((d) => d !== null);
        if (!weeklyOffDays.length) return false;
        return weeklyOffDays.includes(weekday);
      };

      const isOffDayForCrew = (dateISO, crew) => {
        if (getDayDescriptionForDay(dateISO, crew.id).toUpperCase() === "OFF") return true;
        if (!isWeeklyOffDayForCrew(dateISO, crew)) return false;
        return !hasDayDataForCrew(dateISO, crew.id);
      };

      const isPtoDayForCrew = (dateISO, crew) =>
        getDayDescriptionForDay(dateISO, crew.id).toUpperCase() === "PTO";

      const showDayDetailForCrew = (dateISO, crew) => {
        const dayDescription = getDayDescriptionForDay(dateISO, crew.id).toUpperCase();
        if (dayDescription === "OFF" || dayDescription === "PTO") return false;
        return hasDayDataForCrew(dateISO, crew.id);
      };

      const isWorkCallDayForCrew = (dateISO, crew) =>
        getDayDescriptionForDay(dateISO, crew.id).toLowerCase() === "workcall";

      const shouldShowTrackRowForCrewDay = (dateISO, crew) => {
        if (!showDayDetailForCrew(dateISO, crew)) return false;
        if (isWorkCallDayForCrew(dateISO, crew)) return false;
        const dayDescription = getDayDescriptionForDay(dateISO, crew.id);
        if (dayDescription) return true;
        return hasWorkingShowForDay(dateISO, crew.id);
      };

      const dayHeaders = days
        .map(
          (dateISO) =>
            `<th class="day-head" colspan="${colsForDate(dateISO)}">${escapeHtml(
              formatPrintDay(dateISO)
            )}</th>`
        )
        .join("");

      const showHeaderRow = days
        .map((dateISO) => {
          const slots = showSlotsForDate(dateISO);
          const cols = colsForDate(dateISO);
          const showCountForDay = getShowsForDate(dateISO).length;
          return slots
            .map((slot, idx) => {
              const isShow = slot?.kind === "show";
              const isAdd = slot?.kind === "add";
              const hideGhostForSingleShow =
                !isShow && cols === 2 && showCountForDay === 1;
              if (hideGhostForSingleShow) {
                return `<th class="sub-head ghost-hidden"></th>`;
              }
              if (isShow) {
                const time = formatPrintTime(slot?.show?.time) || "Show";
                return `<th class="sub-head"><span class="show-pill">${escapeHtml(
                  time
                )}</span></th>`;
              }
              if (isAdd) {
                return `<th class="sub-head"><span class="add-pill">+ Add show</span></th>`;
              }
              return `<th class="sub-head ghost-slot"></th>`;
            })
            .join("");
        })
        .join("");

      const bodyRows = [];
      for (const group of printGroupedCrew) {
        const span = totalShowCols + 2;
        bodyRows.push(
          `<tr class="dept-row"><td colspan="${span}">${escapeHtml(group.dept)}</td></tr>`
        );

        for (const crew of group.people) {
          const crewName = escapeHtml(crew?.crew_name || "Crew");
          const weeklyTotals = getWeekHours(roster?.startISO, crew.id) || {
            totalHours: 0,
            paidHours: 0,
            leadHours: 0,
            regularHours: 0,
            regularOvertimeHours: 0,
            leadOvertimeHours: 0,
          };
          const paidHoursNumber = Number(weeklyTotals.paidHours);
          const paidHoursSafe = Number.isFinite(paidHoursNumber) ? paidHoursNumber : 0;
          const paidGoal = 36;
          const paidProgressPct = Math.max(
            0,
            Math.min(100, (paidHoursSafe / paidGoal) * 100)
          );
          const overtimeOverGoal = Math.max(0, paidHoursSafe - paidGoal);
          const weeklyHoursHtml = `
            <td class="weekly-hours" rowspan="4">
              <div class="weekly-card">
                <div class="weekly-title">Paid Hours</div>
                <div class="weekly-paid">
                  <span class="weekly-paid-value${overtimeOverGoal > 0 ? " over" : ""}">${escapeHtml(
                    formatPrintHours(weeklyTotals.paidHours)
                  )}</span>
                  <span class="weekly-paid-target">/ 36</span>
                </div>
                <div class="weekly-bar">
                  <div class="weekly-bar-fill${overtimeOverGoal > 0 ? " over" : ""}" style="width: ${paidProgressPct}%;"></div>
                </div>
              </div>
              <div class="weekly-breakdown">
                <div class="weekly-col">
                  <div>Lead: <strong>${escapeHtml(
                    formatPrintHours(weeklyTotals.leadHours)
                  )}</strong></div>
                  <div>L-OT: <strong>${escapeHtml(
                    formatPrintHours(weeklyTotals.leadOvertimeHours)
                  )}</strong></div>
                </div>
                <div class="weekly-col">
                  <div>Regular: <strong>${escapeHtml(
                    formatPrintHours(weeklyTotals.regularHours)
                  )}</strong></div>
                  <div>R-OT: <strong>${escapeHtml(
                    formatPrintHours(weeklyTotals.regularOvertimeHours)
                  )}</strong></div>
                </div>
              </div>
            </td>
          `;

          const row1DayCells = days
            .map((dateISO) => {
              const spanCols = colsForDate(dateISO);
              const showDayDetail = showDayDetailForCrew(dateISO, crew);
              if (!showDayDetail) {
                const isPto = isPtoDayForCrew(dateISO, crew);
                const isOff = isOffDayForCrew(dateISO, crew);
                const stateClass = isPto ? "pto" : isOff ? "off" : "empty";
                const label = isPto ? "PTO" : isOff ? "OFF" : "";
                return `
                  <td class="day-off ${stateClass}" rowspan="4" colspan="${spanCols}">
                    <span class="mini-plus">+</span>
                    ${label ? `<span class="off-label">${label}</span>` : ""}
                  </td>
                `;
              }

              const shift = getShift(dateISO, crew.id) || {};
              const startLabel = shift?.startTime ? formatPrintTime(shift.startTime) : "";
              const endLabel = shift?.endTime ? formatPrintTime(shift.endTime) : "";
              const timeMarkup =
                startLabel || endLabel
                  ? `<span>${escapeHtml(startLabel || "IN")}</span><span class="slash">/</span><span>${escapeHtml(
                      endLabel || "OUT"
                    )}</span>`
                  : `<span class="time-empty"></span>`;

              return `
                <td class="shift-cell" colspan="${spanCols}">
                  <div class="time-line">${timeMarkup}</div>
                </td>
              `;
            })
            .join("");
          const crewCellHtml = `
            <td class="crew-col" rowspan="4">
              <div class="crew-name">${crewName}</div>
              ${
                crew?.is_department_lead
                  ? `<div class="crew-lead">Department Lead</div>`
                  : ""
              }
              <div class="crew-dept">${escapeHtml(prettyDept(crew?.home_department))}</div>
            </td>
          `;
          bodyRows.push(`<tr>${crewCellHtml}${row1DayCells}${weeklyHoursHtml}</tr>`);

          const row2DayCells = days
            .map((dateISO) => {
              if (!showDayDetailForCrew(dateISO, crew)) return "";
              const spanCols = colsForDate(dateISO);
              const showTrackRow = shouldShowTrackRowForCrewDay(dateISO, crew);
              if (!showTrackRow) {
                const dayDescription = getDayDescriptionForDay(dateISO, crew.id);
                return `
                  <td class="desc-cell tall" rowspan="2" colspan="${spanCols}">
                    ${escapeHtml(dayDescription || "Select day description")}
                  </td>
                `;
              }
              const slots = showSlotsForDate(dateISO);
              const cols = colsForDate(dateISO);
              const showCountForDay = getShowsForDate(dateISO).length;
              return slots
                .map((slot, idx) => {
                  const isShow = slot?.kind === "show";
                  const hideGhostForSingleShow =
                    !isShow && cols === 2 && showCountForDay === 1;
                  if (!isShow) {
                    if (hideGhostForSingleShow) {
                      return `<td class="track-ghost hidden"></td>`;
                    }
                    return `<td class="track-ghost"></td>`;
                  }
                  const showId = slot?.show?.id ?? null;
                  const working = isWorking(dateISO, crew.id, showId);
                  if (!working) {
                    return `<td class="track-empty"></td>`;
                  }
                  const rawTrackId = getTrackId(dateISO, crew.id, showId);
                  const trackId = Number(rawTrackId);
                  if (!Number.isFinite(trackId)) {
                    return `<td class="track-cell no-track"><span>No track</span></td>`;
                  }
                  const trackName = trackNameById.get(trackId) || `Track ${trackId}`;
                  const trackHex = trackColorById.get(trackId) || "";
                  const glow = trackGlowFromHex(trackHex);
                  const inlineStyle = glow
                    ? `style="background: linear-gradient(180deg, ${glow.bg} 0%, rgba(255,255,255,0.92) 100%); border-color: ${glow.border}; box-shadow: inset 0 0 0 1px ${glow.inset};"`
                    : "";
                  return `<td class="track-cell assigned" ${inlineStyle}><span>${escapeHtml(
                    trackName
                  )}</span></td>`;
                })
                .join("");
            })
            .join("");
          bodyRows.push(`<tr>${row2DayCells}</tr>`);

          const row3DayCells = days
            .map((dateISO) => {
              if (!showDayDetailForCrew(dateISO, crew)) return "";
              if (!shouldShowTrackRowForCrewDay(dateISO, crew)) return "";
              const spanCols = colsForDate(dateISO);
              const dayDescription = getDayDescriptionForDay(dateISO, crew.id);
              return `
                <td class="desc-cell" colspan="${spanCols}">
                  ${escapeHtml(dayDescription || "Select day description")}
                </td>
              `;
            })
            .join("");
          bodyRows.push(`<tr>${row3DayCells}</tr>`);

          const row4DayCells = days
            .map((dateISO) => {
              if (!showDayDetailForCrew(dateISO, crew)) return "";
              const spanCols = colsForDate(dateISO);
              const dbHours = getDayHours(dateISO, crew.id);
              const paidTotal = Number(dbHours?.totalHours);
              const hasPaidTotal = Number.isFinite(paidTotal) && paidTotal > 0;
              const workedTotal = Number(dbHours?.workedHours);
              const hasWorkedTotal = Number.isFinite(workedTotal) && workedTotal > 0;
              const leadValue = Number(dbHours?.leadHours);
              const regularValue = Number(dbHours?.regularHours);
              const regularOvertimeValue = Number(dbHours?.regularOvertimeHours);
              const leadOvertimeValue = Number(dbHours?.leadOvertimeHours);
              const showLeadOvertime =
                Number.isFinite(leadOvertimeValue) && leadOvertimeValue > 0;
              const showRegularOvertime =
                Number.isFinite(regularOvertimeValue) && regularOvertimeValue > 0;
              const normalizedLeadValue = Number.isFinite(leadValue) ? leadValue : 0;
              const showLead = normalizedLeadValue > 0 || showLeadOvertime;
              const showRegular = Number.isFinite(regularValue) && regularValue > 0;
              const leadPaidTotal =
                (Number.isFinite(leadValue) ? leadValue : 0) +
                (Number.isFinite(leadOvertimeValue) ? leadOvertimeValue : 0);
              const regularPaidTotal =
                (Number.isFinite(regularValue) ? regularValue : 0) +
                (Number.isFinite(regularOvertimeValue) ? regularOvertimeValue : 0);
              const paidHoursForRole = Number.isFinite(paidTotal)
                ? paidTotal
                : leadPaidTotal + regularPaidTotal;
              const isDepartmentLead = !!crew?.is_department_lead;
              const isFullLeadShift =
                !isDepartmentLead &&
                leadPaidTotal > 0 &&
                regularPaidTotal <= 0.0001 &&
                paidHoursForRole > 0;
              const isPartialLeadShift =
                !isDepartmentLead && leadPaidTotal > 0 && !isFullLeadShift;
              const isStandardRate =
                !isDepartmentLead &&
                leadPaidTotal <= 0.0001 &&
                regularPaidTotal > 0;
              const dayLeadRoleLabel = isDepartmentLead
                ? "LEAD"
                : isFullLeadShift
                ? "Full LEAD Rate"
                : isPartialLeadShift
                ? "Partial LEAD Rate"
                : isStandardRate
                ? "Standard Rate"
                : "";
              const hasAnyBreakdown =
                showLead || showRegular || showRegularOvertime || showLeadOvertime;
              const hasLeadColumn = showLead || showLeadOvertime;
              const hasRegularColumn = showRegular || showRegularOvertime;
              const showBothBreakdownColumns = hasLeadColumn && hasRegularColumn;

              return `
                <td class="hours-cell" colspan="${spanCols}">
                  ${
                    dayLeadRoleLabel
                      ? `<div class="hours-role">${escapeHtml(dayLeadRoleLabel)}</div>`
                      : ""
                  }
                  ${
                    hasAnyBreakdown || hasWorkedTotal || hasPaidTotal
                      ? `<div class="hours-totals">
                           <div>Total Hours: <strong>${escapeHtml(
                             formatPrintHours(hasWorkedTotal ? workedTotal : null)
                           )}</strong></div>
                           <div class="totals-right">Paid Hours: <strong>${escapeHtml(
                             formatPrintHours(hasPaidTotal ? paidTotal : null)
                           )}</strong></div>
                         </div>`
                      : ""
                  }
                  <div class="hours-breakdown${
                    showBothBreakdownColumns ? " two-col" : " one-col"
                  }">
                    ${
                      hasLeadColumn
                        ? `<div class="hours-col">
                             ${
                               showLead
                                 ? `<div>Lead: <strong>${escapeHtml(
                                     formatPrintHours(normalizedLeadValue)
                                   )}</strong></div>`
                                 : ""
                             }
                             ${
                               showLeadOvertime
                                 ? `<div class="ot">L-OT: <strong>${escapeHtml(
                                     formatPrintHours(leadOvertimeValue)
                                   )}</strong></div>`
                                 : ""
                             }
                           </div>`
                        : ""
                    }
                    ${
                      hasRegularColumn
                        ? `<div class="hours-col${
                            hasLeadColumn ? " with-divider" : ""
                          }">
                             ${
                               showRegular
                                 ? `<div>Regular: <strong>${escapeHtml(
                                     formatPrintHours(regularValue)
                                   )}</strong></div>`
                                 : ""
                             }
                             ${
                               showRegularOvertime
                                 ? `<div class="ot">R-OT: <strong>${escapeHtml(
                                     formatPrintHours(regularOvertimeValue)
                                   )}</strong></div>`
                                 : ""
                             }
                           </div>`
                        : ""
                    }
                  </div>
                </td>
              `;
            })
            .join("");
          bodyRows.push(`<tr>${row4DayCells}</tr>`);
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
      @page { size: landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111a2d;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      h1 { margin: 0 0 2px; font-size: 16px; }
      h2 { margin: 0 0 8px; font-size: 10px; color: #5d6880; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; }
      th, td { border: 1px solid #d3dbe9; padding: 0; vertical-align: top; }
      .crew-head {
        width: 180px;
        background: #edf2fb;
        color: #2a3652;
        text-transform: uppercase;
        letter-spacing: .06em;
        font-size: 11px;
        font-weight: 900;
        text-align: center;
        padding: 6px;
      }
      .day-head {
        background: #edf2fb;
        color: #202d47;
        font-size: 11px;
        font-weight: 900;
        text-align: center;
        padding: 6px 4px;
      }
      .weekly-head {
        width: 165px;
        background: #edf2fb;
        color: #202d47;
        text-transform: uppercase;
        letter-spacing: .04em;
        font-size: 10px;
        font-weight: 900;
        text-align: center;
        padding: 6px 4px;
      }
      .sub-head {
        background: #f5f8ff;
        text-align: center;
        padding: 2px;
      }
      .show-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid #c8d2e5;
        background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,249,255,0.98));
        color: #0f2b57;
        font-weight: 800;
        font-size: 8px;
      }
      .add-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px dashed #a9bddf;
        background: #f2f7ff;
        color: #23437a;
        font-weight: 800;
        font-size: 8px;
      }
      .ghost-slot {
        background: #f8fbff;
        border-style: dashed;
        border-color: #e2e7f2;
      }
      .ghost-hidden { border: 1px solid transparent; background: #fff; }
      .dept-row td {
        background: linear-gradient(180deg, #e6eeff 0%, #dee9ff 100%);
        color: #0b1b3b;
        font-weight: 800;
        letter-spacing: .05em;
        font-size: 10px;
        text-transform: uppercase;
        padding: 6px 8px;
      }
      .crew-col {
        width: 180px;
        background: linear-gradient(180deg, #f9fbff 0%, #f2f6ff 100%);
        padding: 8px 8px 7px;
      }
      .crew-name { font-size: 13px; font-weight: 900; color: #111827; }
      .crew-lead {
        margin-top: 1px;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: .05em;
        color: #345e9f;
        text-transform: uppercase;
      }
      .crew-dept { margin-top: 1px; font-size: 9px; color: #5d6880; }
      .day-off {
        position: relative;
        min-height: 74px;
        background: #f8faff;
      }
      .day-off.off { background: linear-gradient(180deg, #e6e9f0 0%, #d8dde8 100%); }
      .day-off.pto { background: linear-gradient(180deg, #dff5e6 0%, #cbeed8 100%); }
      .mini-plus {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 13px;
        height: 13px;
        border-radius: 999px;
        border: 1px solid #a9bddf;
        background: #f2f7ff;
        color: #23437a;
        font-size: 11px;
        line-height: 12px;
        text-align: center;
        font-weight: 900;
      }
      .off-label {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .1em;
        text-transform: uppercase;
      }
      .day-off.off .off-label { color: #5f687a; }
      .day-off.pto .off-label { color: #1f6b3f; }
      .shift-cell {
        background: #eef3fb;
        padding: 1px 5px;
        height: 20px;
      }
      .time-line {
        display: grid;
        grid-template-columns: 1fr 8px 1fr;
        align-items: center;
        gap: 2px;
        text-align: center;
        font-size: 10px;
        font-weight: 800;
        color: #1a2740;
        min-height: 16px;
      }
      .slash { color: rgba(31,53,92,0.5); transform: skewX(-16deg); }
      .time-empty { display: inline-block; min-height: 10px; }
      .track-cell,
      .track-empty,
      .track-ghost {
        height: 24px;
        text-align: center;
        vertical-align: middle;
      }
      .track-empty { background: #f8faff; }
      .track-ghost { background: #f8fbff; border-style: dashed; border-color: #e2e7f2; }
      .track-ghost.hidden { border: 1px solid transparent; background: #f8faff; }
      .track-cell {
        border: 1px solid #d3dbe9;
        background: #e7f6e9;
        color: #0d4f20;
        font-size: 9px;
        font-weight: 800;
      }
      .track-cell.no-track {
        background: #fff3f1;
        color: #7f1d1d;
      }
      .track-cell span {
        display: inline-block;
        padding: 6px 4px 5px;
        line-height: 1;
      }
      .desc-cell {
        background: #f5f8ff;
        text-align: center;
        padding: 4px 6px;
        height: 22px;
        font-size: 10px;
        font-weight: 800;
        color: #1a2740;
      }
      .desc-cell.tall {
        height: 48px;
        vertical-align: middle;
      }
      .hours-cell {
        background: #eef3f9;
        padding: 2px 6px 3px;
        min-height: 22px;
        font-size: 9px;
      }
      .hours-role {
        margin-bottom: 2px;
        padding-bottom: 2px;
        border-bottom: 1px solid rgba(31,53,92,0.12);
        text-align: center;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: .02em;
        color: #334a70;
      }
      .hours-totals {
        margin-bottom: 2px;
        padding-bottom: 2px;
        border-bottom: 1px solid rgba(31,53,92,0.12);
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
        color: #5b6479;
        font-weight: 800;
      }
      .hours-totals strong { color: #1f355c; font-weight: 900; }
      .hours-totals .totals-right {
        border-left: 1px solid rgba(31,53,92,0.12);
        padding-left: 6px;
      }
      .hours-breakdown.two-col {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
      }
      .hours-breakdown.one-col { display: block; }
      .hours-col { display: grid; gap: 1px; color: #5b6479; font-weight: 800; }
      .hours-col.with-divider {
        border-left: 1px solid rgba(31,53,92,0.12);
        padding-left: 6px;
      }
      .hours-col strong { color: #1f355c; font-weight: 900; }
      .hours-col .ot,
      .hours-col .ot strong { color: #9a3412; }
      .weekly-hours {
        background: #eef3f9;
        padding: 5px 7px;
        width: 165px;
      }
      .weekly-card {
        border: 1px solid rgba(31,53,92,0.14);
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(245,250,255,0.9));
        padding: 6px 6px 5px;
      }
      .weekly-title {
        font-size: 8px;
        font-weight: 800;
        letter-spacing: .05em;
        text-transform: uppercase;
        color: #6b7388;
        text-align: center;
      }
      .weekly-paid {
        margin-top: 1px;
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 3px;
      }
      .weekly-paid-value {
        font-size: 16px;
        line-height: 1;
        font-weight: 900;
        color: #1f355c;
      }
      .weekly-paid-value.over { color: #9a3412; }
      .weekly-paid-target { font-size: 10px; font-weight: 800; color: #6b7388; }
      .weekly-bar {
        margin-top: 4px;
        height: 4px;
        border-radius: 999px;
        background: rgba(31,53,92,0.14);
        overflow: hidden;
      }
      .weekly-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #2563eb, #3b82f6);
      }
      .weekly-bar-fill.over {
        background: linear-gradient(90deg, #2563eb, #16a34a);
      }
      .weekly-breakdown {
        border-top: 1px solid rgba(31,53,92,0.12);
        margin-top: 4px;
        padding-top: 4px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 3px;
      }
      .weekly-col {
        display: grid;
        gap: 2px;
        font-size: 10px;
        color: #5b6479;
        font-weight: 700;
      }
      .weekly-col strong { font-weight: 900; color: #1f355c; }
      .weekly-col div:last-child { color: #9a3412; }
      .weekly-col div:last-child strong { color: #9a3412; }
      .weekly-col + .weekly-col {
        border-left: 1px solid rgba(31,53,92,0.12);
        padding-left: 6px;
      }
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
          <th class="crew-head" rowspan="2">Crew</th>
          ${dayHeaders}
          <th class="weekly-head" rowspan="2">Weekly Hours</th>
        </tr>
        <tr>
          ${showHeaderRow}
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
                { value: "gridV2", label: "Week grid" },
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

            {crewViewMode === "gridV2" ? (
              <>
                <button
                  style={S.button("ghost", undoDisabled)}
                  onClick={() => {
                    if (!undoDisabled) void undoAction?.();
                  }}
                  disabled={undoDisabled}
                  title="Undo (Cmd/Ctrl+Z)"
                >
                  Undo
                </button>

                <button
                  style={S.button("ghost", redoDisabled)}
                  onClick={() => {
                    if (!redoDisabled) void redoAction?.();
                  }}
                  disabled={redoDisabled}
                  title="Redo (Cmd/Ctrl+Shift+Z)"
                >
                  Redo
                </button>
              </>
            ) : null}

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

            {crewViewMode === "gridV2" ? (
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
      {crewViewMode === "gridV2" ? (
        <CrewSchedulesGridV2
          S={S}
          roster={roster}
          search={crewSearch}
          departmentFilter={departmentFilter}
          tracks={tracks}
        />
      ) : crewViewMode === "coverage" ? (
        <CrewSchedulesCoverageView
          S={S}
          roster={roster}
          search={crewSearch}
          departmentFilter={departmentFilter}
          tracks={tracks}
        />
      ) : (
        <CrewSchedulesDayView
          S={S}
          roster={roster}
          dateISO={dayISO} // FIX: prevents "undefined" date saves
          search={crewSearch}
          departmentFilter={departmentFilter}
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
