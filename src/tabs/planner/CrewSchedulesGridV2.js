import { Fragment, useCallback, useMemo } from "react";
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

export default function CrewSchedulesGridV2({
  S,
  roster,
  search,
  tracks = [],
}) {
  const savePaused = !!roster?.savePaused;

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
  const setShiftFor = useMemo(
    () => (typeof roster?.setShiftFor === "function" ? roster.setShiftFor : () => null),
    [roster?.setShiftFor]
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

  const showDayDetailForCrew = (dateISO, crewId) =>
    hasCompleteShiftForDay(dateISO, crewId) || hasWorkingShowForDay(dateISO, crewId);

  const handleAddShiftForDay = (dateISO, crewId) => {
    if (savePaused || typeof setShiftFor !== "function") return;
    setShiftFor(dateISO, crewId, DEFAULT_DAY_START_TIME, DEFAULT_DAY_END_TIME);
  };

  const handleClearDayForCrew = (dateISO, crewId) => {
    if (savePaused) return;
    setShiftFor(dateISO, crewId, null, null);
    for (const slot of showSlotsForDate(dateISO)) {
      if (slot?.kind !== "show") continue;
      const showId = slot?.show?.id ?? null;
      setWorkingFor(dateISO, crewId, showId, false);
    }
  };

  const shell = {
    ...S.card,
    padding: 14,
    borderRadius: 20,
    background: "rgba(10,14,22,0.72)",
  };

  const paper = {
    borderRadius: 16,
    border: "1px solid #d8dbe3",
    background: "#fff",
    padding: 10,
    color: "#111",
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
          <div style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
            Week Grid View V2
          </div>
          {savePaused ? <span style={S.badge("warn")}>Editing paused</span> : null}
        </div>

        <div style={paper}>
          <div style={{ overflowX: "auto" }}>
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
                      border: "1px solid #d8dbe3",
                      background: "#f3f5fb",
                      padding: "8px 6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      width: 220,
                      position: "sticky",
                      left: 0,
                      zIndex: 4,
                    }}
                  >
                    Crew
                  </th>
                  {days.map((dateISO) => (
                    <th
                      key={`head-day-${dateISO}`}
                      colSpan={colsForDate(dateISO)}
                      style={{
                        border: "1px solid #d8dbe3",
                        background: "#f3f5fb",
                        padding: "6px",
                        textAlign: "center",
                        fontSize: 11,
                        fontWeight: 900,
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
                              : "1px solid #d8dbe3",
                            background: hideGhostForSingleShow ? "#fff" : "#f8faff",
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
                                  border: "1px solid #d7dbe7",
                                  borderRadius: 999,
                                  background: "#fff",
                                  color: "#1f355c",
                                  fontWeight: 800,
                                  fontSize: 10,
                                  padding: "2px 8px",
                                  cursor: savePaused ? "not-allowed" : "pointer",
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
                                  background: "#fdeceb",
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
                                border: "1px dashed #b7c2dc",
                                borderRadius: 999,
                                background: "#f9fbff",
                                color: "#1f355c",
                                fontWeight: 800,
                                fontSize: 10,
                                padding: "2px 8px",
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
                          border: "1px solid #d8dbe3",
                          background: "#e9eefb",
                          color: "#0b1b3b",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          padding: "6px",
                        }}
                      >
                        {group.dept}
                      </td>
                    </tr>

                    {group.people.map((crew) => (
                      <Fragment key={`crew-${crew.id}`}>
                        <tr>
                          <td
                            rowSpan={2}
                            style={{
                              border: "1px solid #d8dbe3",
                              background: "#f9fbff",
                              padding: "6px",
                              position: "sticky",
                              left: 0,
                              zIndex: 2,
                              verticalAlign: "top",
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 800 }}>
                              {crew.crew_name || "Crew"}
                            </div>
                            <div style={{ fontSize: 10, color: "#667" }}>
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
                          if (!showDayDetail) {
                            return (
                              <td
                                key={`off-day-${crew.id}-${dateISO}`}
                                rowSpan={2}
                                colSpan={span}
                                style={{
                                  border: "1px solid #d8dbe3",
                                  background: "#fff",
                                  padding: "4px",
                                  height: 62,
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
                                    border: "1px solid #b7c2dc",
                                    background: "#f9fbff",
                                    color: "#1f355c",
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
                              </td>
                            );
                          }

                          return (
                            <td
                              key={`shift-${crew.id}-${dateISO}`}
                              colSpan={span}
                              style={{
                                border: "1px solid #d8dbe3",
                                background: "#f5f6fa",
                                padding: "4px",
                                height: 30,
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
                                <select
                                  disabled={savePaused}
                                  value={startLabel}
                                  onChange={(e) =>
                                    handleShiftChange(
                                      dateISO,
                                      crew.id,
                                      e.target.value,
                                      endLabel
                                    )
                                  }
                                  style={{
                                    height: 22,
                                    minWidth: 0,
                                    borderRadius: 999,
                                    border: "1px solid #d7dbe7",
                                    background: "#fff",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "0 6px",
                                  }}
                                >
                                  <option value="">IN</option>
                                  {TIME_OPTIONS.map((t) => (
                                    <option key={`in-${dateISO}-${crew.id}-${t}`} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  disabled={savePaused}
                                  value={endLabel}
                                  onChange={(e) =>
                                    handleShiftChange(
                                      dateISO,
                                      crew.id,
                                      startLabel,
                                      e.target.value
                                    )
                                  }
                                  style={{
                                    height: 22,
                                    minWidth: 0,
                                    borderRadius: 999,
                                    border: "1px solid #d7dbe7",
                                    background: "#fff",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "0 6px",
                                  }}
                                >
                                  <option value="">OUT</option>
                                  {TIME_OPTIONS.map((t) => (
                                    <option key={`out-${dateISO}-${crew.id}-${t}`} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>

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
                                    background: "#fdeceb",
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
                                        : "1px dashed #e3e7f2",
                                      background: hideGhostForSingleShow ? "#fff" : "#fbfcff",
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
                                        : "1px solid #d8dbe3",
                                    background: !working
                                      ? "#fff"
                                      : assignmentValue === "none"
                                      ? "#fdeceb"
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
                                          height: 24,
                                          minWidth: 0,
                                          borderRadius: 999,
                                          border:
                                            assignmentValue !== "none" && trackGlow
                                              ? `1px solid ${trackGlow.border}`
                                              : "1px solid #d7dbe7",
                                          background: "rgba(255,255,255,0.9)",
                                          color:
                                            assignmentValue === "none"
                                              ? "#7f1d1d"
                                              : "#0d4f20",
                                          fontSize: 10,
                                          fontWeight: 800,
                                          padding: "0 8px",
                                          boxShadow:
                                            assignmentValue !== "none" && trackGlow
                                              ? `0 0 0 1px ${trackGlow.inset} inset`
                                              : "none",
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
                                          background: "#fdeceb",
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
                                        border: "1px solid #b7c2dc",
                                        background: "#f9fbff",
                                        color: "#1f355c",
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
