import { Fragment, useCallback, useMemo, useState } from "react";
import { normalizeHex, trackGlowFromHex } from "../../utils/colors";

import { prettyDept } from "../../utils/strings";

const EMPTY_ARRAY = [];

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const total = i * 15;
  let hour = Math.floor(total / 60);
  const minute = total % 60;
  const mer = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${mer}`;
});

const DEFAULT_DAY_START_TIME = "13:45:00";
const DEFAULT_DAY_END_TIME = "21:45:00";
const PTO_START_TIME = "12:00:00";
const PTO_END_TIME = "12:00:00";
const DAY_DESCRIPTION_OPTIONS = [
  "OFF",
  "Workcall",
  "WC/Presets",
  "WC/Shows",
  "PTO",
  "Rehearsal",
  "Shows",
];
const TIME_DATALIST_ID = "crew-grid-v2-time-options";

const parseTimeInput = (value) => {
  if (!value) return null;
  const v = value.trim();
  const ampm = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2]);
    const mer = ampm[3].toUpperCase();
    if (mer === "PM" && hour < 12) hour += 12;
    if (mer === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0"
    )}:00`;
  }
  const hm = v.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const hour = Number(hm[1]);
    const minute = Number(hm[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0"
    )}:00`;
  }
  return null;
};

const formatShowTime = (value) => {
  if (!value) return "";
  const [hh, mm] = String(value).split(":");
  if (!hh || !mm) return value;
  let hour = Number(hh);
  const minute = Number(mm);
  const mer = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${mer}`;
};

const minutesFromTime = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
};

const shiftDurationHours = (startTime, endTime) => {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  if (start === null || end === null) return null;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  if (diff === 0) diff = 24 * 60;
  return diff / 60;
};

const formatShortDay = (dateISO) => {
  if (!dateISO) return "";
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateISO);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
};

const formatHours = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
};

const weekdayFromISO = (dateISO) => {
  if (!dateISO) return null;
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
};

const normalizeWeekdayNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0 || i > 6) return null;
  return i;
};

export default function CrewSchedulesGridV2({
  S,
  roster,
  search,
  tracks = [],
}) {
  const savePaused = !!roster?.savePaused;
  const [timeDraftMap, setTimeDraftMap] = useState(() => new Map());

  const days = Array.isArray(roster?.dateList) ? roster.dateList : EMPTY_ARRAY;
  const getShowsForDate = useMemo(
    () =>
      typeof roster?.getShowsForDate === "function"
        ? roster.getShowsForDate
        : () => EMPTY_ARRAY,
    [roster?.getShowsForDate]
  );
  const isWorking = useMemo(
    () => (typeof roster?.isWorking === "function" ? roster.isWorking : () => false),
    [roster?.isWorking]
  );
  const getTrackId = useMemo(
    () => (typeof roster?.getTrackId === "function" ? roster.getTrackId : () => null),
    [roster?.getTrackId]
  );
  const setWorkingFor = useMemo(
    () =>
      typeof roster?.setWorkingFor === "function" ? roster.setWorkingFor : () => null,
    [roster?.setWorkingFor]
  );
  const setTrackFor = useMemo(
    () =>
      typeof roster?.setTrackFor === "function" ? roster.setTrackFor : () => null,
    [roster?.setTrackFor]
  );
  const getShift = useMemo(
    () =>
      typeof roster?.getShift === "function"
        ? roster.getShift
        : () => ({ startTime: null, endTime: null }),
    [roster?.getShift]
  );
  const getDayHours = useMemo(
    () =>
      typeof roster?.getDayHours === "function" ? roster.getDayHours : () => null,
    [roster?.getDayHours]
  );
  const setShiftFor = useMemo(
    () => (typeof roster?.setShiftFor === "function" ? roster.setShiftFor : () => null),
    [roster?.setShiftFor]
  );
  const setDayDescriptionFor = useMemo(
    () =>
      typeof roster?.setDayDescriptionFor === "function"
        ? roster.setDayDescriptionFor
        : () => null,
    [roster?.setDayDescriptionFor]
  );

  const trackOptions = useMemo(
    () =>
      (tracks || [])
        .filter((t) => t && t.active !== false)
        .slice()
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [tracks]
  );

  const trackNameById = useMemo(() => {
    const map = new Map();
    for (const t of trackOptions) {
      const id = Number(t.id);
      if (!Number.isFinite(id)) continue;
      map.set(id, String(t.name || `Track ${id}`));
    }
    return map;
  }, [trackOptions]);
  const trackColorById = useMemo(() => {
    const map = new Map();
    for (const t of trackOptions) {
      const id = Number(t.id);
      if (!Number.isFinite(id)) continue;
      const hex = normalizeHex(t?.color);
      if (hex) map.set(id, hex);
    }
    return map;
  }, [trackOptions]);

  const filteredCrew = useMemo(() => {
    const crew = Array.isArray(roster?.crew) ? roster.crew : EMPTY_ARRAY;
    const q = String(search || "")
      .trim()
      .toLowerCase();
    if (!q) return crew;
    return crew.filter((c) => {
      const name = String(c?.crew_name || "").toLowerCase();
      const dept = String(c?.home_department || "").toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [roster?.crew, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const c of filteredCrew) {
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
  }, [filteredCrew]);

  const crewById = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(roster?.crew) ? roster.crew : EMPTY_ARRAY;
    for (const c of list) {
      const id = Number(c?.id);
      if (!Number.isFinite(id)) continue;
      map.set(id, c);
    }
    return map;
  }, [roster?.crew]);

  const showColumnCountForDate = useCallback(
    (dateISO) => {
      const count = getShowsForDate(dateISO).length;
      const clamped = Math.min(4, Math.max(0, count));
      if (clamped === 1) return 2;
      return Math.max(1, clamped);
    },
    [getShowsForDate]
  );

  const dayColCountByDate = useMemo(() => {
    const map = new Map();
    for (const d of days) map.set(d, showColumnCountForDate(d));
    return map;
  }, [days, showColumnCountForDate]);

  const colsForDate = useCallback(
    (dateISO) => dayColCountByDate.get(dateISO) || 1,
    [dayColCountByDate]
  );

  const showSlotsForDate = useCallback(
    (dateISO) => {
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
    },
    [colsForDate, getShowsForDate]
  );

  const totalShowCols = useMemo(
    () => days.reduce((sum, d) => sum + colsForDate(d), 0),
    [days, colsForDate]
  );

  const handleShiftChange = (dateISO, crewId, nextStartLabel, nextEndLabel) => {
    if (savePaused || typeof setShiftFor !== "function") return;
    setShiftFor(
      dateISO,
      crewId,
      nextStartLabel ? parseTimeInput(nextStartLabel) : null,
      nextEndLabel ? parseTimeInput(nextEndLabel) : null
    );
  };

  const timeDraftKey = (dateISO, crewId, field) =>
    `${dateISO}|${Number(crewId)}|${field}`;
  const isKnownTimeOption = (value) =>
    TIME_OPTIONS.some(
      (opt) => opt.toLowerCase() === String(value || "").trim().toLowerCase()
    );

  const getTimeInputValue = (dateISO, crewId, field, committedValue) => {
    const key = timeDraftKey(dateISO, crewId, field);
    return timeDraftMap.has(key) ? timeDraftMap.get(key) : committedValue;
  };

  const setTimeInputDraft = (dateISO, crewId, field, value) => {
    const key = timeDraftKey(dateISO, crewId, field);
    setTimeDraftMap((prev) => {
      const next = new Map(prev);
      next.set(key, String(value || ""));
      return next;
    });
  };

  const clearTimeInputDraft = (dateISO, crewId, field) => {
    const key = timeDraftKey(dateISO, crewId, field);
    setTimeDraftMap((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const commitTimeInput = (dateISO, crewId, field, rawValue) => {
    const shift = getShift(dateISO, crewId) || {};
    const startCommitted = shift?.startTime ? formatShowTime(shift.startTime) : "";
    const endCommitted = shift?.endTime ? formatShowTime(shift.endTime) : "";

    const text = String(rawValue || "").trim();
    const parsed = text ? parseTimeInput(text) : null;
    const normalized = !text
      ? ""
      : parsed
      ? formatShowTime(parsed)
      : field === "start"
      ? startCommitted
      : endCommitted;

    if (field === "start") {
      handleShiftChange(dateISO, crewId, normalized, endCommitted);
    } else {
      handleShiftChange(dateISO, crewId, startCommitted, normalized);
    }
    clearTimeInputDraft(dateISO, crewId, field);
  };

  const applyShowState = (dateISO, crewId, showId, value) => {
    if (savePaused) return;

    if (value === "off") {
      setWorkingFor(dateISO, crewId, showId, false);
      return;
    }

    const setTrackAfterTurnOn = (nextTrack) => {
      window.setTimeout(() => {
        setTrackFor(dateISO, crewId, showId, nextTrack);
      }, 0);
    };

    if (value === "none") {
      if (isWorking(dateISO, crewId, showId)) {
        setTrackFor(dateISO, crewId, showId, "");
      } else {
        setWorkingFor(dateISO, crewId, showId, true);
        setTrackAfterTurnOn("");
      }
      return;
    }

    const nextTrackId = Number(value);
    if (!Number.isFinite(nextTrackId)) return;
    if (isWorking(dateISO, crewId, showId)) {
      setTrackFor(dateISO, crewId, showId, nextTrackId);
    } else {
      setWorkingFor(dateISO, crewId, showId, true);
      setTrackAfterTurnOn(nextTrackId);
    }
  };

  const handleAddShow = async (dateISO) => {
    if (savePaused) return;
    if (typeof roster?.createShow !== "function") return;
    const list = getShowsForDate(dateISO);
    if (list.length >= 4) return;
    const raw = window.prompt("Show time (e.g., 7:00 PM)", "");
    const parsed = parseTimeInput(raw || "");
    if (!parsed) return;
    await roster.createShow(dateISO, parsed, list.length + 1);
  };

  const handleEditShow = async (dateISO, show) => {
    if (savePaused) return;
    if (!show?.id || typeof roster?.updateShow !== "function") return;
    const raw = window.prompt("Show time (e.g., 7:00 PM)", formatShowTime(show.time));
    const parsed = parseTimeInput(raw || "");
    if (!parsed) return;
    await roster.updateShow(show.id, parsed);
  };

  const handleDeleteShow = async (dateISO, show) => {
    if (savePaused) return;
    if (!show?.id || typeof roster?.deleteShow !== "function") return;
    const ok = window.confirm("Delete this show time and its assignments?");
    if (!ok) return;
    await roster.deleteShow(show.id, dateISO);
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

  const getDayDescriptionForDay = (dateISO, crewId) => {
    const shift = getShift(dateISO, crewId) || {};
    return String(shift?.dayDescription || "").trim();
  };

  const hasDayDescriptionForDay = (dateISO, crewId) => {
    const dayDescription = getDayDescriptionForDay(dateISO, crewId);
    return !!dayDescription && dayDescription.toUpperCase() !== "OFF";
  };

  const hasDayDataForCrew = (dateISO, crewId) =>
    hasCompleteShiftForDay(dateISO, crewId) ||
    hasWorkingShowForDay(dateISO, crewId) ||
    hasDayDescriptionForDay(dateISO, crewId);

  const isWeeklyOffDayForCrew = (dateISO, crewId) => {
    const weekday = weekdayFromISO(dateISO);
    if (weekday === null) return false;
    const crew = crewById.get(Number(crewId));
    if (!crew) return false;
    const days = [
      normalizeWeekdayNumber(crew?.weeklyOffDay1 ?? crew?.weekly_off_day_1),
      normalizeWeekdayNumber(crew?.weeklyOffDay2 ?? crew?.weekly_off_day_2),
    ].filter((d) => d !== null);
    if (!days.length) return false;
    return days.includes(weekday);
  };

  const isOffDayForCrew = (dateISO, crewId) => {
    if (getDayDescriptionForDay(dateISO, crewId).toUpperCase() === "OFF") return true;
    if (!isWeeklyOffDayForCrew(dateISO, crewId)) return false;
    return !hasDayDataForCrew(dateISO, crewId);
  };

  const showDayDetailForCrew = (dateISO, crewId) => {
    if (getDayDescriptionForDay(dateISO, crewId).toUpperCase() === "OFF") return false;
    return hasDayDataForCrew(dateISO, crewId);
  };

  const handleAddShiftForDay = (dateISO, crewId) => {
    if (savePaused || typeof setShiftFor !== "function") return;
    if (isOffDayForCrew(dateISO, crewId)) {
      setShiftFor(dateISO, crewId, DEFAULT_DAY_START_TIME, DEFAULT_DAY_END_TIME, null);
      return;
    }
    setShiftFor(dateISO, crewId, DEFAULT_DAY_START_TIME, DEFAULT_DAY_END_TIME);
  };

  const handleDayDescriptionChange = (dateISO, crewId, rawValue) => {
    if (savePaused) return;
    const nextValue = String(rawValue || "").trim();

    if (nextValue === "OFF") {
      setShiftFor(dateISO, crewId, null, null, "OFF");
      for (const slot of showSlotsForDate(dateISO)) {
        if (slot?.kind !== "show") continue;
        const showId = slot?.show?.id ?? null;
        setWorkingFor(dateISO, crewId, showId, false);
      }
      return;
    }

    if (nextValue === "PTO") {
      setShiftFor(dateISO, crewId, PTO_START_TIME, PTO_END_TIME, "PTO");
      for (const slot of showSlotsForDate(dateISO)) {
        if (slot?.kind !== "show") continue;
        const showId = slot?.show?.id ?? null;
        setWorkingFor(dateISO, crewId, showId, false);
      }
      return;
    }

    setDayDescriptionFor(dateISO, crewId, nextValue || null);
  };

  const handleClearDayForCrew = (dateISO, crewId) => {
    if (savePaused) return;
    setShiftFor(dateISO, crewId, null, null, null);
    for (const slot of showSlotsForDate(dateISO)) {
      if (slot?.kind !== "show") continue;
      const showId = slot?.show?.id ?? null;
      setWorkingFor(dateISO, crewId, showId, false);
    }
  };

  const ui = {
    shellBg:
      "linear-gradient(180deg, rgba(14,20,34,0.78) 0%, rgba(10,15,27,0.72) 100%)",
    shellBorder: "1px solid rgba(173, 191, 224, 0.22)",
    shellShadow: "0 18px 38px rgba(3, 8, 18, 0.38)",
    paperBg: "linear-gradient(180deg, #f9fbff 0%, #f4f7fd 100%)",
    paperBorder: "1px solid #cdd7e8",
    paperShadow: "0 10px 26px rgba(18, 35, 66, 0.10)",
    cellBorder: "#d3dbe9",
    cellBorderSoft: "#e2e7f2",
    headerBg: "#edf2fb",
    headerSubBg: "#f5f8ff",
    deptBg: "linear-gradient(180deg, #e6eeff 0%, #dee9ff 100%)",
    crewBg: "linear-gradient(180deg, #f9fbff 0%, #f2f6ff 100%)",
    emptyDayBg: "#f8faff",
    offDayBg: "linear-gradient(180deg, #e6e9f0 0%, #d8dde8 100%)",
    shiftBg: "#eef3fb",
    descriptionBg: "#f5f8ff",
    hoursBg: "#eef3f9",
    controlBorder: "#c8d2e5",
    controlBg: "#ffffff",
    controlText: "#0f2b57",
    plusBg: "#f2f7ff",
    plusBorder: "#a9bddf",
    plusText: "#23437a",
    title: "rgba(246,250,255,0.96)",
    text: "#111a2d",
    muted: "#5d6880",
  };
  const cellBorder = `1px solid ${ui.cellBorder}`;

  const shell = {
    ...S.card,
    padding: 14,
    borderRadius: 20,
    background: ui.shellBg,
    border: ui.shellBorder,
    boxShadow: ui.shellShadow,
    backdropFilter: "blur(3px)",
  };

  const paper = {
    borderRadius: 16,
    border: ui.paperBorder,
    background: ui.paperBg,
    padding: 10,
    color: ui.text,
    boxShadow: ui.paperShadow,
  };

  if (!days.length) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={shell}>
          <div style={S.helper}>No days available for this week.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={shell}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: ui.title,
              letterSpacing: "0.02em",
            }}
          >
            Week Grid View V2
          </div>
          {savePaused ? <span style={S.badge("warn")}>Editing paused</span> : null}
        </div>

        <div style={paper}>
          <datalist id={TIME_DATALIST_ID}>
            {TIME_OPTIONS.map((t) => (
              <option key={`time-opt-${t}`} value={t} />
            ))}
          </datalist>
          <div style={{ overflowX: "auto", borderRadius: 12 }}>
            <table
              style={{
                width: "100%",
                minWidth: 220 + totalShowCols * 145,
                borderCollapse: "collapse",
                tableLayout: "fixed",
                fontSize: 11,
              }}
            >
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    style={{
                      border: cellBorder,
                      background: ui.headerBg,
                      padding: "9px 8px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#2a3652",
                      width: 220,
                      position: "sticky",
                      left: 0,
                      zIndex: 4,
                      boxShadow: "2px 0 0 rgba(200, 212, 236, 0.85)",
                    }}
                  >
                    Crew
                  </th>
                  {days.map((dateISO) => (
                    <th
                      key={`head-day-${dateISO}`}
                      colSpan={colsForDate(dateISO)}
                      style={{
                        border: cellBorder,
                        background: ui.headerBg,
                        padding: "8px 6px",
                        textAlign: "center",
                        fontSize: 11,
                        fontWeight: 900,
                        color: "#202d47",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {formatShortDay(dateISO)}
                    </th>
                  ))}
                </tr>

                <tr>
                  {days.flatMap((dateISO) => {
                    const slots = showSlotsForDate(dateISO);
                    const cols = colsForDate(dateISO);
                    const showCountForDay = getShowsForDate(dateISO).length;
                    return slots.map((slot, idx) => {
                      const isShow = slot?.kind === "show";
                      const isAdd = slot?.kind === "add";
                      const show = isShow ? slot.show : null;
                      const hideGhostForSingleShow =
                        !isShow && cols === 2 && showCountForDay === 1;
                      return (
                        <th
                          key={`head-show-${dateISO}-${show?.id ?? `${slot?.kind}-${idx}`}`}
                          style={{
                            border: hideGhostForSingleShow
                              ? "1px solid transparent"
                              : cellBorder,
                            background: hideGhostForSingleShow ? "#fff" : ui.headerSubBg,
                            padding: "4px",
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          {isShow ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <button
                                type="button"
                                disabled={savePaused}
                                onClick={() => handleEditShow(dateISO, show)}
                                style={{
                                  border: `1px solid ${ui.controlBorder}`,
                                  borderRadius: 999,
                                  background:
                                    "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,249,255,0.98))",
                                  color: ui.controlText,
                                  fontWeight: 800,
                                  fontSize: 10,
                                  padding: "2px 9px",
                                  cursor: savePaused ? "not-allowed" : "pointer",
                                  boxShadow: "0 1px 0 rgba(255,255,255,0.8) inset",
                                }}
                                title="Edit show time"
                              >
                                {formatShowTime(show?.time) || "Show"}
                              </button>
                              <button
                                type="button"
                                disabled={savePaused}
                                onClick={() => handleDeleteShow(dateISO, show)}
                                style={{
                                  border: "1px solid #f2c7c3",
                                  borderRadius: 999,
                                  background: "#fff3f1",
                                  color: "#7f1d1d",
                                  fontWeight: 900,
                                  fontSize: 10,
                                  width: 18,
                                  height: 18,
                                  padding: 0,
                                  cursor: savePaused ? "not-allowed" : "pointer",
                                  lineHeight: "16px",
                                }}
                                title="Delete show"
                                aria-label="Delete show"
                              >
                                ×
                              </button>
                            </div>
                          ) : isAdd ? (
                            <button
                              type="button"
                              disabled={savePaused}
                              onClick={() => handleAddShow(dateISO)}
                              style={{
                                border: `1px dashed ${ui.plusBorder}`,
                                borderRadius: 999,
                                background: ui.plusBg,
                                color: ui.plusText,
                                fontWeight: 800,
                                fontSize: 10,
                                padding: "2px 9px",
                                cursor: savePaused ? "not-allowed" : "pointer",
                              }}
                            >
                              + Add show
                            </button>
                          ) : null}
                        </th>
                      );
                    });
                  })}
                </tr>
              </thead>

              <tbody>
                {grouped.map((group) => (
                  <Fragment key={`dept-${group.dept}`}>
                    <tr>
                      <td
                        colSpan={totalShowCols + 1}
                        style={{
                          border: cellBorder,
                          background: ui.deptBg,
                          color: "#0b1b3b",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          padding: "7px 8px",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
                        }}
                      >
                        {group.dept}
                      </td>
                    </tr>

                    {group.people.map((crew) => (
                      <Fragment key={`crew-${crew.id}`}>
                        <tr>
                          <td
                            rowSpan={4}
                            style={{
                              border: cellBorder,
                              background: ui.crewBg,
                              padding: "10px 10px 8px",
                              position: "sticky",
                              left: 0,
                              zIndex: 2,
                              verticalAlign: "top",
                              boxShadow: "2px 0 0 rgba(200, 212, 236, 0.85)",
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
                              {crew.crew_name || "Crew"}
                            </div>
                            {crew?.is_department_lead ? (
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  letterSpacing: "0.05em",
                                  textTransform: "uppercase",
                                  color: "#345e9f",
                                  marginTop: 1,
                                }}
                              >
                                Department Lead
                              </div>
                            ) : null}
                            <div style={{ fontSize: 11, color: ui.muted, marginTop: 1 }}>
                              {prettyDept(crew?.home_department)}
                            </div>
                          </td>

                        {days.map((dateISO) => {
                          const span = colsForDate(dateISO);
                          const shift = getShift(dateISO, crew.id) || {};
                          const startLabel = shift?.startTime
                            ? formatShowTime(shift.startTime)
                            : "";
                          const endLabel = shift?.endTime
                            ? formatShowTime(shift.endTime)
                            : "";
                          const showDayDetail = showDayDetailForCrew(dateISO, crew.id);
                          const isOffDay = isOffDayForCrew(dateISO, crew.id);
                          if (!showDayDetail) {
                            return (
                              <td
                                key={`off-day-${crew.id}-${dateISO}`}
                                rowSpan={4}
                                colSpan={span}
                                style={{
                                  border: cellBorder,
                                  background: isOffDay ? ui.offDayBg : ui.emptyDayBg,
                                  padding: "4px",
                                  height: 116,
                                  position: "relative",
                                  verticalAlign: "top",
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={savePaused}
                                  onClick={() => handleAddShiftForDay(dateISO, crew.id)}
                                  title="Add IN/OUT time"
                                  aria-label="Add IN/OUT time"
                                  style={{
                                    position: "absolute",
                                    top: 4,
                                    left: 4,
                                    width: 16,
                                    height: 16,
                                    borderRadius: 999,
                                    border: `1px solid ${ui.plusBorder}`,
                                    background: ui.plusBg,
                                    color: ui.plusText,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    lineHeight: "14px",
                                    padding: 0,
                                    display: "grid",
                                    placeItems: "center",
                                    cursor: savePaused ? "not-allowed" : "pointer",
                                  }}
                                >
                                  +
                                </button>
                                {isOffDay ? (
                                  <div
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      display: "grid",
                                      placeItems: "center",
                                      pointerEvents: "none",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 900,
                                        letterSpacing: "0.1em",
                                        textTransform: "uppercase",
                                        color: "#5f687a",
                                      }}
                                    >
                                      OFF
                                    </span>
                                  </div>
                                ) : null}
                              </td>
                            );
                          }

                          return (
                            <td
                              key={`shift-${crew.id}-${dateISO}`}
                              colSpan={span}
                              style={{
                                border: cellBorder,
                                background: ui.shiftBg,
                                padding: "5px 6px",
                                height: 34,
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr auto",
                                  gap: 4,
                                  alignItems: "center",
                                }}
                              >
                                <input
                                  type="text"
                                  list={TIME_DATALIST_ID}
                                  disabled={savePaused}
                                  value={getTimeInputValue(
                                    dateISO,
                                    crew.id,
                                    "start",
                                    startLabel
                                  )}
                                  onChange={(e) =>
                                    (() => {
                                      const raw = e.target.value;
                                      setTimeInputDraft(
                                        dateISO,
                                        crew.id,
                                        "start",
                                        raw
                                      );
                                      if (isKnownTimeOption(raw)) {
                                        commitTimeInput(dateISO, crew.id, "start", raw);
                                      }
                                    })()
                                  }
                                  onBlur={(e) =>
                                    commitTimeInput(
                                      dateISO,
                                      crew.id,
                                      "start",
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitTimeInput(
                                        dateISO,
                                        crew.id,
                                        "start",
                                        e.currentTarget.value
                                      );
                                      e.currentTarget.blur();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      clearTimeInputDraft(dateISO, crew.id, "start");
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  placeholder="IN"
                                  style={{
                                    height: 24,
                                    minWidth: 0,
                                    borderRadius: 999,
                                    border: `1px solid ${ui.controlBorder}`,
                                    background:
                                      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.98))",
                                    color: "#1a2740",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "0 8px",
                                    boxShadow: "0 1px 0 rgba(255,255,255,0.85) inset",
                                  }}
                                />

                                <input
                                  type="text"
                                  list={TIME_DATALIST_ID}
                                  disabled={savePaused}
                                  value={getTimeInputValue(
                                    dateISO,
                                    crew.id,
                                    "end",
                                    endLabel
                                  )}
                                  onChange={(e) =>
                                    (() => {
                                      const raw = e.target.value;
                                      setTimeInputDraft(
                                        dateISO,
                                        crew.id,
                                        "end",
                                        raw
                                      );
                                      if (isKnownTimeOption(raw)) {
                                        commitTimeInput(dateISO, crew.id, "end", raw);
                                      }
                                    })()
                                  }
                                  onBlur={(e) =>
                                    commitTimeInput(
                                      dateISO,
                                      crew.id,
                                      "end",
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitTimeInput(
                                        dateISO,
                                        crew.id,
                                        "end",
                                        e.currentTarget.value
                                      );
                                      e.currentTarget.blur();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      clearTimeInputDraft(dateISO, crew.id, "end");
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  placeholder="OUT"
                                  style={{
                                    height: 24,
                                    minWidth: 0,
                                    borderRadius: 999,
                                    border: `1px solid ${ui.controlBorder}`,
                                    background:
                                      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.98))",
                                    color: "#1a2740",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "0 8px",
                                    boxShadow: "0 1px 0 rgba(255,255,255,0.85) inset",
                                  }}
                                />

                                <button
                                  type="button"
                                  disabled={savePaused}
                                  onClick={() => handleClearDayForCrew(dateISO, crew.id)}
                                  title="Clear day"
                                  aria-label="Clear day"
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 999,
                                    border: "1px solid #f2c7c3",
                                    background: "#fff2f1",
                                    color: "#7f1d1d",
                                    fontSize: 12,
                                    fontWeight: 900,
                                    lineHeight: "20px",
                                    padding: 0,
                                    cursor: savePaused ? "not-allowed" : "pointer",
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            </td>
                          );
                        })}
                        </tr>

                        <tr>
                          {days.flatMap((dateISO) => {
                            if (!showDayDetailForCrew(dateISO, crew.id)) return [];
                            const slots = showSlotsForDate(dateISO);
                            const cols = colsForDate(dateISO);
                            const showCountForDay = getShowsForDate(dateISO).length;
                            return slots.map((slot, idx) => {
                              const canUse = slot?.kind === "show";
                              const showId = slot?.show?.id ?? null;
                              const hideGhostForSingleShow =
                                !canUse && cols === 2 && showCountForDay === 1;
                              if (!canUse) {
                                return (
                                  <td
                                    key={`ghost-${crew.id}-${dateISO}-${idx}`}
                                    style={{
                                      border: hideGhostForSingleShow
                                        ? "1px solid transparent"
                                        : `1px dashed ${ui.cellBorderSoft}`,
                                      background:
                                        hideGhostForSingleShow ? ui.emptyDayBg : "#f8fbff",
                                      padding: "4px",
                                      height: 32,
                                    }}
                                  />
                                );
                              }

                              const working = isWorking(dateISO, crew.id, showId);
                              const rawTrackId = getTrackId(dateISO, crew.id, showId);
                              const trackId = Number(rawTrackId);
                              const assignmentValue = Number.isFinite(trackId)
                                ? String(trackId)
                                : "none";
                              const assignedTrackHex =
                                assignmentValue === "none"
                                  ? ""
                                  : trackColorById.get(trackId) || "";
                              const trackGlow = trackGlowFromHex(assignedTrackHex);

                              return (
                                <td
                                  key={`show-${crew.id}-${dateISO}-${showId ?? idx}`}
                                  style={{
                                    border:
                                      working && assignmentValue !== "none" && trackGlow
                                        ? `1px solid ${trackGlow.border}`
                                        : cellBorder,
                                    background: !working
                                      ? ui.emptyDayBg
                                      : assignmentValue === "none"
                                      ? "#fff3f1"
                                      : trackGlow
                                      ? `linear-gradient(180deg, ${trackGlow.bg} 0%, rgba(255,255,255,0.92) 100%)`
                                      : "#e7f6e9",
                                    padding: "3px",
                                    height: 32,
                                    position: "relative",
                                    boxShadow:
                                      working && assignmentValue !== "none" && trackGlow
                                        ? `0 0 0 1px ${trackGlow.inset} inset, 0 6px 14px ${trackGlow.shadow}`
                                        : "none",
                                  }}
                                >
                                  {working ? (
                                    <>
                                      <select
                                        disabled={savePaused}
                                        value={assignmentValue}
                                        onChange={(e) =>
                                          applyShowState(dateISO, crew.id, showId, e.target.value)
                                        }
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          minHeight: 24,
                                          minWidth: 0,
                                          borderRadius: 0,
                                          border: "none",
                                          background: "transparent",
                                          color:
                                            assignmentValue === "none"
                                              ? "#7f1d1d"
                                              : "#0d4f20",
                                          fontSize: 11,
                                          fontWeight: 800,
                                          padding: "0 18px 0 8px",
                                          boxShadow: "none",
                                          appearance: "none",
                                          WebkitAppearance: "none",
                                          MozAppearance: "none",
                                          textAlign: "center",
                                          textAlignLast: "center",
                                          cursor: savePaused ? "not-allowed" : "pointer",
                                          outline: "none",
                                        }}
                                      >
                                        <option value="none">No track</option>
                                        {trackOptions.map((t) => (
                                          <option key={`track-opt-${t.id}`} value={t.id}>
                                            {trackNameById.get(Number(t.id)) || t.name}
                                          </option>
                                        ))}
                                      </select>

                                      <button
                                        type="button"
                                        disabled={savePaused}
                                        onClick={() => setWorkingFor(dateISO, crew.id, showId, false)}
                                        title="Remove assignment"
                                        aria-label="Remove assignment"
                                        style={{
                                          position: "absolute",
                                          top: 4,
                                          right: 4,
                                          width: 14,
                                          height: 14,
                                          borderRadius: 999,
                                          border: "1px solid #f2c7c3",
                                          background: "#fff2f1",
                                          color: "#7f1d1d",
                                          fontSize: 10,
                                          fontWeight: 900,
                                          lineHeight: "12px",
                                          padding: 0,
                                          display: "grid",
                                          placeItems: "center",
                                          cursor: savePaused ? "not-allowed" : "pointer",
                                        }}
                                      >
                                        ×
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={savePaused}
                                      onClick={() => setWorkingFor(dateISO, crew.id, showId, true)}
                                      title="Add assignment"
                                      aria-label="Add assignment"
                                      style={{
                                        position: "absolute",
                                        top: 4,
                                        left: 4,
                                        width: 14,
                                        height: 14,
                                        borderRadius: 999,
                                        border: `1px solid ${ui.plusBorder}`,
                                        background: ui.plusBg,
                                        color: ui.plusText,
                                        fontSize: 10,
                                        fontWeight: 900,
                                        lineHeight: "12px",
                                        padding: 0,
                                        display: "grid",
                                        placeItems: "center",
                                        cursor: savePaused ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      +
                                    </button>
                                  )}
                                </td>
                              );
                            });
                          })}
                        </tr>

                        <tr>
                          {days.flatMap((dateISO) => {
                            if (!showDayDetailForCrew(dateISO, crew.id)) return [];
                            const span = colsForDate(dateISO);
                            const shift = getShift(dateISO, crew.id) || {};
                            const dayDescription = String(
                              shift?.dayDescription || ""
                            ).trim();
                            return [
                              <td
                                key={`desc-${crew.id}-${dateISO}`}
                                colSpan={span}
                                style={{
                                  border: cellBorder,
                                  background: ui.descriptionBg,
                                  padding: "5px 6px",
                                  height: 30,
                                }}
                              >
                                <select
                                  disabled={savePaused}
                                  value={dayDescription}
                                  onChange={(e) =>
                                    handleDayDescriptionChange(
                                      dateISO,
                                      crew.id,
                                      e.target.value || null
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    height: 24,
                                    minWidth: 0,
                                    borderRadius: 999,
                                    border: `1px solid ${ui.controlBorder}`,
                                    background:
                                      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.98))",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "#1a2740",
                                    padding: "0 10px",
                                  }}
                                >
                                  <option value="">Select day description</option>
                                  {DAY_DESCRIPTION_OPTIONS.map((opt) => (
                                    <option
                                      key={`day-description-${crew.id}-${dateISO}-${opt}`}
                                      value={opt}
                                    >
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>,
                            ];
                          })}
                        </tr>

                        <tr>
                          {days.flatMap((dateISO) => {
                            if (!showDayDetailForCrew(dateISO, crew.id)) return [];
                            const span = colsForDate(dateISO);
                            const shift = getShift(dateISO, crew.id) || {};
                            const dbHours = getDayHours(dateISO, crew.id);
                            const paidTotal = Number(dbHours?.totalHours);
                            const hasPaidTotal = Number.isFinite(paidTotal) && paidTotal > 0;
                            const workedTotal = shiftDurationHours(
                              shift?.startTime || null,
                              shift?.endTime || null
                            );
                            const hasWorkedTotal =
                              Number.isFinite(workedTotal) && workedTotal > 0;
                            const unpaidHoursRaw =
                              Number.isFinite(workedTotal) && hasPaidTotal
                                ? Math.max(0, workedTotal - paidTotal)
                                : null;
                            const unpaidHours =
                              Number.isFinite(unpaidHoursRaw)
                                ? Math.round(unpaidHoursRaw * 100) / 100
                                : null;
                            const lead = dbHours?.leadHours ?? null;
                            const hours = dbHours?.regularHours ?? null;
                            const regularOvertime =
                              dbHours?.regularOvertimeHours ?? null;
                            const leadOvertime = dbHours?.leadOvertimeHours ?? null;
                            const visibleHourItems = [
                              { key: "lead", label: "Lead", value: lead },
                              { key: "hours", label: "Hours", value: hours },
                              {
                                key: "r-ot",
                                label: "R-OT",
                                value: regularOvertime,
                              },
                              {
                                key: "l-ot",
                                label: "L-OT",
                                value: leadOvertime,
                              },
                            ].filter((item) => {
                              const n = Number(item.value);
                              return Number.isFinite(n) && n > 0;
                            });
                            return [
                              <td
                                key={`hours-${crew.id}-${dateISO}`}
                                colSpan={span}
                                style={{
                                  border: cellBorder,
                                  background: ui.hoursBg,
                                  padding: "4px 8px 6px",
                                  minHeight: 28,
                                }}
                              >
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: visibleHourItems.length
                                      ? `repeat(${visibleHourItems.length}, minmax(0, 1fr))`
                                      : "1fr",
                                    gap: 0,
                                    alignItems: "center",
                                    fontSize: 11,
                                    color: "#4b556e",
                                  }}
                                >
                                  {visibleHourItems.map((item, idx) => {
                                    const n = Number(item.value);
                                    const isOvertime = item.key === "r-ot" || item.key === "l-ot";
                                    const isHot = isOvertime && n > 0;
                                    const justifyContent =
                                      visibleHourItems.length === 1
                                        ? "center"
                                        : idx === 0
                                        ? "flex-start"
                                        : idx === visibleHourItems.length - 1
                                        ? "flex-end"
                                        : "center";
                                    return (
                                      <div
                                        key={`${crew.id}-${dateISO}-${item.key}`}
                                        style={{
                                          padding: "0 8px",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent,
                                          gap: 4,
                                          minWidth: 0,
                                          borderLeft:
                                            idx === 0
                                              ? "none"
                                              : "1px solid rgba(31,53,92,0.12)",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontWeight: 800,
                                            color: isHot
                                              ? "#9a3412"
                                              : "#5b6479",
                                            minWidth: 0,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {item.label}:
                                        </span>{" "}
                                        <span
                                          style={{
                                            fontWeight: 900,
                                            color: isHot
                                              ? "#9a3412"
                                              : "#1f355c",
                                            flexShrink: 0,
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {formatHours(item.value)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                {hasPaidTotal || hasWorkedTotal ? (
                                  <div
                                    style={{
                                      marginTop: 4,
                                      paddingTop: 4,
                                      borderTop: "1px solid rgba(31,53,92,0.12)",
                                      display: "grid",
                                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                      alignItems: "center",
                                      gap: 8,
                                      fontSize: 11,
                                      color: "#5b6479",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 800,
                                        whiteSpace: "nowrap",
                                        textAlign: "left",
                                      }}
                                    >
                                      Total Hours:{" "}
                                      <span style={{ fontWeight: 900, color: "#1f355c" }}>
                                        {formatHours(hasWorkedTotal ? workedTotal : null)}
                                      </span>
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: 800,
                                        whiteSpace: "nowrap",
                                        textAlign: "center",
                                      }}
                                    >
                                      Paid Total:{" "}
                                      <span style={{ fontWeight: 900, color: "#1f355c" }}>
                                        {formatHours(hasPaidTotal ? paidTotal : null)}
                                      </span>
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: 800,
                                        whiteSpace: "nowrap",
                                        textAlign: "right",
                                      }}
                                    >
                                      Unpaid:{" "}
                                      <span style={{ fontWeight: 900, color: "#374151" }}>
                                        {formatHours(unpaidHours)}
                                      </span>
                                    </span>
                                  </div>
                                ) : null}
                              </td>,
                            ];
                          })}
                        </tr>
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
