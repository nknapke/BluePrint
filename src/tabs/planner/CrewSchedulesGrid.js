import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { normalizeHex, trackGlowFromHex } from "../../utils/colors";
import {
  addDaysISO,
  formatMonthDay,
  formatWeekdayShort,
  isoDate,
} from "../../utils/dates";
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

/** ---------- GRID ---------- */

export default function CrewSchedulesGrid({ S, roster, search, tracks = [] }) {
  const loading = !!(
    roster?.crewLoading ||
    roster?.assignLoading ||
    roster?.showsLoading ||
    roster?.shiftLoading
  );
  const err =
    roster?.crewError ||
    roster?.assignError ||
    roster?.showsError ||
    roster?.shiftError ||
    "";
  const savePaused = !!roster?.savePaused;

  const [hoverCrewId, setHoverCrewId] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const headerRowRef = useRef(null);
  const bodyScrollRef = useRef(null);

  /** ---------- drag paint state ---------- */
  const dragRef = useRef({
    active: false,
    mode: null, // true = paint on, false = paint off
  });

  const startISO = roster?.startISO || isoDate(new Date());
  const days = useMemo(() => {
    if (roster?.dateList?.length) return roster.dateList;
    return Array.from({ length: 7 }, (_, i) => addDaysISO(startISO, i));
  }, [roster?.dateList, startISO]);

  const todayISO = isoDate(new Date());

  const showsForDate = useCallback(
    (d) =>
      typeof roster?.getShowsForDate === "function"
        ? roster.getShowsForDate(d)
        : [],
    [roster]
  );

  const maxShows = useMemo(() => {
    let max = 1;
    for (const d of days) {
      const count = showsForDate(d).length;
      if (count > max) max = count;
    }
    return Math.min(4, Math.max(1, max));
  }, [days, showsForDate]);

  const showSlotsForDate = useCallback(
    (d) => {
      const list = showsForDate(d);
      const trimmed = list.slice(0, maxShows);
      const count = trimmed.length;
      const slots = Array.from({ length: maxShows }, () => null);
      const rightStart = Math.max(0, maxShows - count);
      for (let i = 0; i < count; i += 1) {
        slots[rightStart + i] = { kind: "show", show: trimmed[i] };
      }
      if (count < maxShows) {
        const addIndex = Math.max(0, rightStart - 1);
        slots[addIndex] = { kind: "add" };
      }
      return slots;
    },
    [showsForDate, maxShows]
  );

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

  const applyShift = (dateISO, crewId, startLabel, endLabel) => {
    if (!roster?.setShiftFor || savePaused) return;
    const start24 = startLabel ? parseTimeInput(startLabel) : null;
    const end24 = endLabel ? parseTimeInput(endLabel) : null;
    roster.setShiftFor(dateISO, crewId, start24, end24);
  };

  const promptShowTime = (seed = "") => {
    const raw = window.prompt("Show time (e.g., 7:00 PM)", seed);
    if (!raw) return null;
    return parseTimeInput(raw);
  };

  const handleAddShow = async (dateISO) => {
    if (savePaused) return;
    if (typeof roster?.createShow !== "function") return;
    const list = showsForDate(dateISO);
    if (list.length >= 4) return;
    const parsed = promptShowTime("");
    if (!parsed) return;
    await roster.createShow(dateISO, parsed, list.length + 1);
  };

  const handleEditShow = async (dateISO, show) => {
    if (savePaused) return;
    if (!show?.id || typeof roster?.updateShow !== "function") return;
    const seed = formatShowTime(show.time);
    const parsed = promptShowTime(seed);
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

  const filteredCrew = useMemo(() => {
    const crew = roster?.crew ?? EMPTY_ARRAY;
    const q = String(search || "")
      .trim()
      .toLowerCase();
    if (!q) return crew;
    return crew.filter((c) => {
      const name = String(c.crew_name || "").toLowerCase();
      const dept = String(c.home_department || "").toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [roster?.crew, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const c of filteredCrew) {
      const dept = prettyDept(c.home_department);
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(c);
    }
    return Array.from(map.entries()).map(([dept, people]) => ({
      dept,
      people: people
        .slice()
        .sort((a, b) => String(a.crew_name).localeCompare(String(b.crew_name))),
    }));
  }, [filteredCrew]);

  const [expanded, setExpanded] = useState(() => new Set());
  useEffect(() => {
    setExpanded(new Set(grouped.map((g) => g.dept)));
  }, [grouped]);

  const toggleDept = (dept) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(dept) ? n.delete(dept) : n.add(dept);
      return n;
    });
  };

  const isWorking = useCallback(
    (d, id, showId) =>
      typeof roster?.isWorking === "function"
        ? !!roster.isWorking(d, id, showId)
        : false,
    [roster]
  );

  const getTrackId = useCallback(
    (d, id, showId) =>
      typeof roster?.getTrackId === "function"
        ? roster.getTrackId(d, id, showId)
        : null,
    [roster]
  );

  const setTrackFor = useCallback(
    (d, id, showId, value) =>
      typeof roster?.setTrackFor === "function"
        ? roster.setTrackFor(d, id, showId, value)
        : null,
    [roster]
  );
  const setWorkingFor = useCallback(
    (d, id, showId, value) =>
      typeof roster?.setWorkingFor === "function"
        ? roster.setWorkingFor(d, id, showId, value)
        : null,
    [roster]
  );

  const getShift =
    typeof roster?.getShift === "function" ? roster.getShift : () => null;

  const trackOptions = useMemo(() => {
    return (tracks || [])
      .filter((t) => t && t.active !== false)
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [tracks]);
  const trackNameById = useMemo(() => {
    const map = new Map();
    for (const t of trackOptions) {
      map.set(Number(t.id), t.name);
    }
    return map;
  }, [trackOptions]);
  const trackColorById = useMemo(() => {
    const map = new Map();
    for (const t of trackOptions) {
      const hex = normalizeHex(t?.color);
      if (hex) map.set(Number(t.id), hex);
    }
    return map;
  }, [trackOptions]);

  /** ---------- paint logic ---------- */

  const paintCell = useCallback(
    (dateISO, crewId, showId, nextVal) => {
      if (savePaused) return;
      roster?.setWorkingFor
        ? roster.setWorkingFor(dateISO, crewId, showId, nextVal)
        : roster?.toggleCell?.(dateISO, crewId, showId);
    },
    [roster, savePaused]
  );

  const beginDrag = (dateISO, crewId, showId) => {
    if (!showId && showsForDate(dateISO).length) return;
    if (savePaused) return;
    const current = isWorking(dateISO, crewId, showId);
    dragRef.current = {
      active: true,
      mode: !current,
    };
    paintCell(dateISO, crewId, showId, !current);
  };

  const dragOver = (dateISO, crewId, showId) => {
    if (!dragRef.current.active) return;
    if (!showId && showsForDate(dateISO).length) return;
    paintCell(dateISO, crewId, showId, dragRef.current.mode);
  };

  const endDrag = () => {
    dragRef.current.active = false;
    dragRef.current.mode = null;
  };

  useEffect(() => {
    window.addEventListener("mouseup", endDrag);
    return () => window.removeEventListener("mouseup", endDrag);
  }, []);

  /** ---------- styles ---------- */

  const panel = {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
    padding: 14,
    marginTop: 12,
  };

  const dayColMin = 120;
  const totalCols = days.length * maxShows;
  const gridTemplateColumns = `260px repeat(${totalCols}, minmax(${dayColMin}px, 1fr))`;
  const minGridWidth = 260 + totalCols * (dayColMin + 14);
  const stickyOffset = 105;
  const headerWrap = {
    position: "sticky",
    top: stickyOffset,
    zIndex: 4,
    paddingBottom: 6,
    background: "rgba(12,14,20,0.8)",
    backdropFilter: "blur(8px)",
  };
  const headerOuter = {
    overflowX: "hidden",
  };
  const bodyScroll = {
    overflowX: "auto",
    paddingBottom: 6,
    overflowY: "visible",
    WebkitOverflowScrolling: "touch",
  };
  const gridRow = {
    display: "grid",
    gridTemplateColumns,
    gap: 8,
    minWidth: minGridWidth,
  };

  const syncHeaderScroll = useCallback(() => {
    const body = bodyScrollRef.current;
    const header = headerRowRef.current;
    if (!body || !header) return;
    header.style.transform = `translateX(-${body.scrollLeft || 0}px)`;
  }, []);

  useEffect(() => {
    syncHeaderScroll();
  }, [syncHeaderScroll, days.length]);

  const cellBase = {
    height: 44,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: savePaused ? "not-allowed" : "pointer",
    transition:
      "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
    userSelect: "none",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    padding: "6px",
    position: "relative",
  };

  const timeCellBase = {
    height: 28,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 6px",
  };

  const trackSelect = {
    ...S.select,
    height: "100%",
    minWidth: 0,
    width: "100%",
    borderRadius: 9,
    padding: "0 26px",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
    textAlignLast: "center",
    background: "rgba(10,15,25,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxSizing: "border-box",
  };
  const clearTrackButton = {
    position: "absolute",
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(8,12,20,0.82)",
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: 900,
    lineHeight: "14px",
    padding: 0,
    display: "grid",
    placeItems: "center",
    zIndex: 2,
  };

  return (
    <div style={panel}>
      {savePaused ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ ...S.badge("warn") }}>Editing paused</div>
        </div>
      ) : null}

      {loading && <div style={S.helper}>Loading crew schedules…</div>}
      {err && (
        <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
          {err}
        </div>
      )}


      {/* Sticky Header (synced to body scroll) */}
      <div style={headerWrap}>
        <div style={headerOuter}>
          <div ref={headerRowRef} style={{ display: "grid", gap: 8 }}>
            <div style={gridRow}>
              <div />
            {days.map((d) => {
              const isToday = d === todayISO;
              const canAddShow =
                showsForDate(d).length < 4 && !savePaused;
              return (
                <div
                  key={d}
                  onMouseEnter={() => setHoverDate(d)}
                  onMouseLeave={() => setHoverDate(null)}
                  style={{
                    gridColumn: `span ${maxShows}`,
                    borderRadius: 14,
                    padding: "10px",
                    textAlign: "center",
                    background: isToday
                      ? "linear-gradient(180deg, rgba(0,122,255,0.28) 0%, rgba(0,122,255,0.10) 100%)"
                      : hoverDate === d
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(255,255,255,0.03)",
                    border: isToday
                      ? "1px solid rgba(0,122,255,0.45)"
                      : "1px solid rgba(255,255,255,0.08)",
                    transition: "background 120ms ease, border 120ms ease",
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900 }}>
                    {formatWeekdayShort(d)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {formatMonthDay(d)}
                  </div>
                  {canAddShow ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddShow(d);
                      }}
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.85)",
                        fontSize: 12,
                        fontWeight: 900,
                        lineHeight: "16px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                      title="Add show"
                      aria-label="Add show"
                    >
                      +
                    </button>
                  ) : null}
                </div>
              );
            })}
            </div>

            <div style={gridRow}>
              <div />
              {days.flatMap((d) => {
                const slots = showSlotsForDate(d);
                return slots.map((slot, idx) => {
                  const isShow = slot?.kind === "show";
                  const isAdd = slot?.kind === "add";
                  const show = isShow ? slot.show : null;
                  const label = isShow ? formatShowTime(show.time) : isAdd ? "Add show" : "";
                  return (
                    <div
                      key={`${d}-show-${show?.id ?? `${slot?.kind}-${idx}`}`}
                      onMouseEnter={() => setHoverDate(d)}
                      onMouseLeave={() => setHoverDate(null)}
                      style={{
                        borderRadius: 12,
                        padding: "8px 6px",
                        textAlign: "center",
                        background: isShow
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(255,255,255,0.02)",
                        border: isShow
                          ? "1px solid rgba(255,255,255,0.14)"
                          : "1px dashed rgba(255,255,255,0.08)",
                        color: isShow
                          ? "rgba(255,255,255,0.85)"
                          : "rgba(255,255,255,0.45)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isAdd ? "pointer" : isShow ? "pointer" : "default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                      onClick={() => {
                        if (isShow) {
                          handleEditShow(d, show);
                        } else if (isAdd) {
                          handleAddShow(d);
                        }
                      }}
                    >
                      <span>{label}</span>
                      {isShow ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteShow(d, show);
                          }}
                          style={{
                            marginLeft: 4,
                            border: "none",
                            background: "transparent",
                            color: "rgba(255,255,255,0.5)",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                          title="Delete show"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        ref={bodyScrollRef}
        style={bodyScroll}
        onScroll={syncHeaderScroll}
      >
        {grouped.length === 0 ? (
          <div style={{ padding: 16, opacity: 0.7 }}>No crew found.</div>
        ) : (
          grouped.map(({ dept, people }) => {
            const open = expanded.has(dept);
            return (
              <div key={dept} style={{ marginTop: 10 }}>
                <button
                  onClick={() => toggleDept(dept)}
                  style={{
                    width: "100%",
                    borderRadius: 14,
                    padding: "10px 12px",
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.88)",
                  }}
                >
                  <span style={{ opacity: 0.7 }}>{open ? "v" : ">"}</span>
                  {dept}
                  <span style={{ marginLeft: "auto", opacity: 0.6 }}>
                    {people.length}
                  </span>
                </button>

                {open &&
                  people.map((c) => {
                    const rowHover = hoverCrewId === c.id;
                    return (
                      <div key={c.id} style={{ marginTop: 8 }}>
                        <div style={{ ...gridRow, marginBottom: 6 }}>
                          <div />
                          {days.map((d) => {
                            const shift = getShift(d, c.id) || {};
                            const slots = showSlotsForDate(d);
                            const isAnyWorking = slots.some((show) => {
                              const canUse = show?.kind === "show";
                              if (!canUse) return false;
                              return isWorking(d, c.id, show?.show?.id ?? null);
                            });

                            return (
                              <div
                                key={`${c.id}-${d}-time`}
                                style={{
                                  ...timeCellBase,
                                  gridColumn: `span ${maxShows}`,
                                  background: isAnyWorking
                                    ? "rgba(255,255,255,0.05)"
                                    : "rgba(255,255,255,0.02)",
                                  border: isAnyWorking
                                    ? "1px solid rgba(255,255,255,0.12)"
                                    : "1px solid rgba(255,255,255,0.06)",
                                }}
                              >
                                {isAnyWorking ? (
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr",
                                      gap: 6,
                                      width: "100%",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 800,
                                          opacity: 0.75,
                                        }}
                                      >
                                        IN:
                                      </span>
                                      <select
                                        value={
                                          shift?.startTime
                                            ? formatShowTime(shift.startTime)
                                            : ""
                                        }
                                        onChange={(e) =>
                                          applyShift(
                                            d,
                                            c.id,
                                            e.target.value,
                                            shift?.endTime
                                              ? formatShowTime(shift.endTime)
                                              : ""
                                          )
                                        }
                                        style={{
                                          ...S.select,
                                          height: 24,
                                          fontSize: 10,
                                          padding: "2px 6px",
                                          minWidth: 86,
                                        }}
                                        disabled={savePaused}
                                      >
                                        <option value="">—</option>
                                        {TIME_OPTIONS.map((t) => (
                                          <option key={t} value={t}>
                                            {t}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        justifyContent: "flex-end",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 800,
                                          opacity: 0.75,
                                        }}
                                      >
                                        OUT:
                                      </span>
                                      <select
                                        value={
                                          shift?.endTime
                                            ? formatShowTime(shift.endTime)
                                            : ""
                                        }
                                        onChange={(e) =>
                                          applyShift(
                                            d,
                                            c.id,
                                            shift?.startTime
                                              ? formatShowTime(shift.startTime)
                                              : "",
                                            e.target.value
                                          )
                                        }
                                        style={{
                                          ...S.select,
                                          height: 24,
                                          fontSize: 10,
                                          padding: "2px 6px",
                                          minWidth: 86,
                                        }}
                                        disabled={savePaused}
                                      >
                                        <option value="">—</option>
                                        {TIME_OPTIONS.map((t) => (
                                          <option key={t} value={t}>
                                            {t}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div style={gridRow}>
                          <div
                            onMouseEnter={() => setHoverCrewId(c.id)}
                            onMouseLeave={() => setHoverCrewId(null)}
                            style={{
                              borderRadius: 12,
                              padding: "10px 12px",
                              background: rowHover
                                ? "rgba(255,255,255,0.10)"
                                : "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <div style={{ fontWeight: 900 }}>
                              {c.crew_name}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>
                              {prettyDept(c.home_department)}
                            </div>
                          </div>

                          {days.flatMap((d) => {
                            const slots = showSlotsForDate(d);
                            return slots.map((slot, idx) => {
                              const canUse = slot?.kind === "show";
                              const showId = slot?.show?.id ?? null;
                              const working = canUse
                                ? isWorking(d, c.id, showId)
                                : false;
                              const trackId = canUse
                                ? getTrackId(d, c.id, showId)
                                : null;
                              const trackLabel =
                                trackId != null && Number.isFinite(trackId)
                                  ? trackNameById.get(Number(trackId)) || ""
                                  : "";
                              const trackHex =
                                trackId != null && Number.isFinite(trackId)
                                  ? trackColorById.get(Number(trackId)) || ""
                                  : "";
                              const trackGlow = trackGlowFromHex(trackHex);
                              const hover = rowHover || hoverDate === d;

                              return (
                                <div
                                  key={`${c.id}-${d}-${showId ?? idx}`}
                                  onMouseDown={() =>
                                    canUse ? beginDrag(d, c.id, showId) : null
                                  }
                                  onMouseEnter={() => {
                                    setHoverCrewId(c.id);
                                    setHoverDate(d);
                                    if (canUse) dragOver(d, c.id, showId);
                                  }}
                                  style={{
                                    ...cellBase,
                                    padding: working ? 0 : cellBase.padding,
                                    background: !canUse
                                      ? "rgba(255,255,255,0.015)"
                                      : working
                                      ? trackGlow
                                        ? `linear-gradient(180deg, ${trackGlow.bg} 0%, rgba(255,255,255,0.02) 100%)`
                                        : "linear-gradient(180deg, rgba(90,150,255,0.32) 0%, rgba(90,150,255,0.16) 100%)"
                                      : hover
                                      ? "rgba(255,255,255,0.05)"
                                      : "rgba(255,255,255,0.02)",
                                    border: !canUse
                                      ? "1px dashed rgba(255,255,255,0.06)"
                                      : working
                                      ? trackGlow
                                        ? `1px solid ${trackGlow.border}`
                                        : "1px solid rgba(90,150,255,0.40)"
                                      : "1px solid rgba(255,255,255,0.08)",
                                    boxShadow: trackGlow
                                      ? `0 0 0 1px ${trackGlow.inset} inset, 0 8px 20px ${trackGlow.shadow}`
                                      : hover
                                      ? "0 6px 16px rgba(0,0,0,0.25)"
                                      : "none",
                                    transform: hover ? "translateY(-1px)" : "none",
                                    opacity: savePaused ? 0.6 : 1,
                                    cursor: !canUse
                                      ? "default"
                                      : savePaused
                                      ? "not-allowed"
                                      : "pointer",
                                  }}
                                >
                                  {working ? (
                                    <>
                                      <select
                                        value={
                                          trackId != null &&
                                          Number.isFinite(trackId)
                                            ? String(trackId)
                                            : ""
                                        }
                                        onChange={(e) =>
                                          setTrackFor(
                                            d,
                                            c.id,
                                            showId,
                                            e.target.value
                                          )
                                        }
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseEnter={(e) => e.stopPropagation()}
                                        disabled={savePaused || !canUse}
                                        title={trackLabel || "No track"}
                                        style={
                                          trackGlow
                                            ? {
                                                ...trackSelect,
                                                border: `1px solid ${trackGlow.border}`,
                                                boxShadow: `0 0 0 1px ${trackGlow.inset} inset, 0 6px 14px ${trackGlow.shadow}`,
                                                background:
                                                  "rgba(12,16,26,0.72)",
                                              }
                                            : trackSelect
                                        }
                                      >
                                        <option value="">No track</option>
                                        {trackOptions.map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.name}
                                          </option>
                                        ))}
                                      </select>
                                      {canUse ? (
                                        <button
                                          type="button"
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setWorkingFor(d, c.id, showId, false);
                                          }}
                                          disabled={savePaused || !canUse}
                                          title="Remove assignment"
                                          aria-label="Remove assignment"
                                          style={{
                                            ...clearTrackButton,
                                            cursor:
                                              savePaused || !canUse
                                                ? "not-allowed"
                                                : "pointer",
                                            opacity:
                                              savePaused || !canUse ? 0.55 : 1,
                                          }}
                                        >
                                          x
                                        </button>
                                      ) : null}
                                    </>
                                  ) : null}
                                </div>
                              );
                            });
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
