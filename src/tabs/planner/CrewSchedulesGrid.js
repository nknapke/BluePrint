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

export default function CrewSchedulesGrid({
  S,
  roster,
  search,
  tracks = [],
  displayMode = "compact",
}) {
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
  const compact = displayMode === "compact";

  const [hoverCrewId, setHoverCrewId] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const [stickyOffset, setStickyOffset] = useState(112);
  const panelRef = useRef(null);
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

  const showColumnCountForDate = useCallback(
    (d) => {
      const count = showsForDate(d).length;
      const clamped = Math.min(4, Math.max(0, count));
      if (clamped === 1) return 2;
      return Math.max(1, clamped);
    },
    [showsForDate]
  );

  const dayColCountByDate = useMemo(() => {
    const map = new Map();
    for (const d of days) {
      map.set(d, showColumnCountForDate(d));
    }
    return map;
  }, [days, showColumnCountForDate]);

  const colsForDate = useCallback(
    (d) => dayColCountByDate.get(d) || 1,
    [dayColCountByDate]
  );

  const showSlotsForDate = useCallback(
    (d) => {
      const cols = colsForDate(d);
      const list = showsForDate(d);
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
    [showsForDate, colsForDate]
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

  useEffect(() => {
    const computeStickyOffset = () => {
      const topBar = document.querySelector('[data-app-topbar="true"]');
      const rect = topBar?.getBoundingClientRect?.();
      if (rect && Number.isFinite(rect.bottom)) {
        const next = Math.round(Math.max(0, rect.bottom) + 8);
        setStickyOffset((prev) => (Math.abs(prev - next) > 1 ? next : prev));
        return;
      }
      setStickyOffset(112);
    };

    computeStickyOffset();
    window.addEventListener("resize", computeStickyOffset);
    window.addEventListener("scroll", computeStickyOffset, { passive: true });
    return () => {
      window.removeEventListener("resize", computeStickyOffset);
      window.removeEventListener("scroll", computeStickyOffset);
    };
  }, []);

  /** ---------- styles ---------- */

  const panel = compact
    ? {
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(180deg, rgba(248,250,255,0.06) 0%, rgba(18,22,30,0.35) 100%)",
        boxShadow: "0 14px 30px rgba(0,0,0,0.28)",
        padding: 10,
        marginTop: 10,
        position: "relative",
        zIndex: 0,
        isolation: "isolate",
      }
    : {
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
        padding: 14,
        marginTop: 12,
        position: "relative",
        zIndex: 0,
        isolation: "isolate",
      };

  const leadColWidth = compact ? 210 : 260;
  const dayColMin = compact ? 92 : 120;
  const timeRowHeight = compact ? 24 : 28;
  const assignmentRowHeight = compact ? 34 : 44;
  const rowBandGap = compact ? 4 : 6;
  const nameCardSpill = compact ? 6 : 8;
  const floatingNameHeight =
    timeRowHeight + rowBandGap + assignmentRowHeight + nameCardSpill;
  const totalCols = useMemo(
    () => days.reduce((sum, d) => sum + colsForDate(d), 0),
    [days, colsForDate]
  );
  const colGap = compact ? 4 : 8;
  const dayBoundaryGap = compact ? 6 : 10;
  const dayBoundaryHalf = dayBoundaryGap / 2;
  const dayIndexByDate = useMemo(() => {
    const map = new Map();
    days.forEach((d, i) => map.set(d, i));
    return map;
  }, [days]);
  const dayChrome = useCallback(
    (d) => {
      const idx = dayIndexByDate.get(d) || 0;
      const isTodayDay = d === todayISO;
      return {
        idx,
        isTodayDay,
        laneTint: isTodayDay
          ? "rgba(0,122,255,0.09)"
          : idx % 2 === 0
          ? "rgba(255,255,255,0.022)"
          : "rgba(148,178,240,0.035)",
        emptyTint: isTodayDay
          ? "rgba(0,122,255,0.05)"
          : idx % 2 === 0
          ? "rgba(255,255,255,0.015)"
          : "rgba(148,178,240,0.022)",
        hoverTint: isTodayDay
          ? "rgba(0,122,255,0.14)"
          : "rgba(255,255,255,0.06)",
        edge: isTodayDay ? "rgba(0,122,255,0.42)" : "rgba(255,255,255,0.18)",
        baseline: isTodayDay ? "rgba(0,122,255,0.58)" : "rgba(255,255,255,0.20)",
      };
    },
    [dayIndexByDate, todayISO]
  );
  const daySpanSpacing = useCallback(
    (d) => {
      const idx = dayIndexByDate.get(d) || 0;
      return {
        marginLeft: idx === 0 ? 0 : dayBoundaryHalf,
        marginRight: idx === days.length - 1 ? 0 : dayBoundaryHalf,
      };
    },
    [dayIndexByDate, days.length, dayBoundaryHalf]
  );
  const daySlotSpacing = useCallback(
    (d, slotIdx, slotCount) => {
      const idx = dayIndexByDate.get(d) || 0;
      return {
        marginLeft: slotIdx === 0 && idx > 0 ? dayBoundaryHalf : 0,
        marginRight:
          slotIdx === slotCount - 1 && idx < days.length - 1
            ? dayBoundaryHalf
            : 0,
      };
    },
    [dayIndexByDate, days.length, dayBoundaryHalf]
  );
  const gridTemplateColumns = `${leadColWidth}px repeat(${totalCols}, minmax(${dayColMin}px, 1fr))`;
  const minGridWidth = leadColWidth + totalCols * (dayColMin + colGap + 4);
  const headerWrap = {
    position: "sticky",
    top: stickyOffset,
    zIndex: 5,
    paddingBottom: compact ? 4 : 6,
    background: compact ? "rgba(12,14,20,0.72)" : "rgba(12,14,20,0.8)",
    backdropFilter: "blur(8px)",
  };
  const headerOuter = {
    overflowX: "hidden",
  };
  const bodyScroll = {
    overflowX: "auto",
    paddingBottom: compact ? 4 : 6,
    overflowY: "visible",
    WebkitOverflowScrolling: "touch",
    position: "relative",
    zIndex: 1,
  };
  const gridRow = {
    display: "grid",
    gridTemplateColumns,
    gap: colGap,
    minWidth: minGridWidth,
  };

  const syncHeaderScroll = useCallback(() => {
    const body = bodyScrollRef.current;
    const header = headerRowRef.current;
    if (!body || !header) return;
    const left = body.scrollLeft || 0;
    header.style.transform = `translateX(-${left}px)`;
    if (panelRef.current) {
      panelRef.current.style.setProperty("--freeze-x", `${left}px`);
    }
  }, []);

  useEffect(() => {
    syncHeaderScroll();
  }, [syncHeaderScroll, days.length]);

  const cellBase = {
    height: assignmentRowHeight,
    borderRadius: compact ? 8 : 10,
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: savePaused ? "not-allowed" : "pointer",
    transition:
      "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
    userSelect: "none",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    padding: compact ? "4px" : "6px",
    position: "relative",
  };

  const timeCellBase = {
    height: timeRowHeight,
    borderRadius: compact ? 8 : 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: compact ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.03)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: compact ? "0 4px" : "0 6px",
    overflow: "hidden",
  };
  const frozenLeadBase = {
    width: leadColWidth,
    minWidth: leadColWidth,
    maxWidth: leadColWidth,
    transform: "translateX(var(--freeze-x, 0px))",
    willChange: "transform",
    boxSizing: "border-box",
  };
  const frozenLeadHeaderCell = {
    ...frozenLeadBase,
    position: "relative",
    zIndex: 3,
    borderRadius: compact ? 10 : 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: compact ? "rgba(12,14,20,0.92)" : "rgba(12,14,20,0.96)",
    boxShadow: "8px 0 14px rgba(0,0,0,0.22)",
  };
  const frozenNameCell = {
    ...frozenLeadBase,
    position: "relative",
    zIndex: 1,
    borderRadius: compact ? 10 : 12,
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "8px 0 14px rgba(0,0,0,0.22)",
    backdropFilter: "blur(6px)",
  };
  const frozenLeadShiftStub = {
    ...frozenLeadBase,
    height: timeRowHeight,
    pointerEvents: "none",
  };
  const floatingNameCard = {
    ...frozenNameCell,
    position: "absolute",
    top: 0,
    left: 0,
    height: floatingNameHeight,
    padding: compact ? "8px 8px" : "12px 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    zIndex: 2,
  };

  const trackSelect = {
    ...S.select,
    height: "100%",
    minWidth: 0,
    width: "100%",
    borderRadius: compact ? 7 : 9,
    padding: compact ? "0 20px" : "0 26px",
    fontSize: compact ? 11 : 12,
    fontWeight: 700,
    textAlign: "center",
    textAlignLast: "center",
    background: compact ? "rgba(10,15,25,0.48)" : "rgba(10,15,25,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxSizing: "border-box",
  };
  const clearTrackButton = {
    position: "absolute",
    top: compact ? 2 : 3,
    right: compact ? 2 : 3,
    width: compact ? 12 : 14,
    height: compact ? 12 : 14,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(8,12,20,0.82)",
    color: "rgba(255,255,255,0.9)",
    fontSize: compact ? 9 : 10,
    fontWeight: 900,
    lineHeight: compact ? "12px" : "14px",
    padding: 0,
    display: "grid",
    placeItems: "center",
    zIndex: 2,
  };

  return (
    <div ref={panelRef} style={panel}>
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
          <div ref={headerRowRef} style={{ display: "grid", gap: colGap }}>
            <div style={gridRow}>
              <div style={frozenLeadHeaderCell} data-freeze-left="1" />
            {days.map((d) => {
              const chrome = dayChrome(d);
              const isToday = chrome.isTodayDay;
              const canAddShow =
                showsForDate(d).length < 4 && !savePaused;
              return (
                <div
                  key={d}
                  onMouseEnter={() => setHoverDate(d)}
                  onMouseLeave={() => setHoverDate(null)}
                  style={{
                    gridColumn: `span ${colsForDate(d)}`,
                    ...daySpanSpacing(d),
                    borderRadius: compact ? 10 : 14,
                    padding: compact ? "6px 8px" : "10px",
                    textAlign: "center",
                    background: isToday
                      ? compact
                        ? "linear-gradient(180deg, rgba(0,122,255,0.24) 0%, rgba(0,122,255,0.08) 100%)"
                        : "linear-gradient(180deg, rgba(0,122,255,0.28) 0%, rgba(0,122,255,0.10) 100%)"
                      : hoverDate === d
                      ? compact
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.08)"
                      : compact
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.03)",
                    border: isToday
                      ? "1px solid rgba(0,122,255,0.45)"
                      : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: isToday
                      ? `inset 0 -2px 0 ${chrome.baseline}`
                      : `inset 0 -1px 0 ${chrome.baseline}`,
                    transition: "background 120ms ease, border 120ms ease",
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: compact ? 11 : 13, fontWeight: 900 }}>
                    {formatWeekdayShort(d)}
                  </div>
                  <div style={{ fontSize: compact ? 10 : 12, opacity: 0.6 }}>
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
                        top: compact ? 3 : 6,
                        right: compact ? 4 : 8,
                        width: compact ? 14 : 18,
                        height: compact ? 14 : 18,
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.85)",
                        fontSize: compact ? 10 : 12,
                        fontWeight: 900,
                        lineHeight: compact ? "12px" : "16px",
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
              <div style={frozenLeadHeaderCell} data-freeze-left="1" />
              {days.flatMap((d) => {
                const slots = showSlotsForDate(d);
                const cols = colsForDate(d);
                const chrome = dayChrome(d);
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
                        ...daySlotSpacing(d, idx, cols),
                        borderRadius: compact ? 8 : 12,
                        padding: compact ? "5px 4px" : "8px 6px",
                        textAlign: "center",
                        background: isShow
                          ? compact
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(255,255,255,0.06)"
                          : compact
                          ? chrome.emptyTint
                          : chrome.laneTint,
                        border: isShow
                          ? "1px solid rgba(255,255,255,0.14)"
                          : "1px dashed rgba(255,255,255,0.08)",
                        borderLeft:
                          idx === 0
                            ? `1px solid ${chrome.edge}`
                            : undefined,
                        borderRight:
                          idx === cols - 1
                            ? `1px solid ${chrome.edge}`
                            : undefined,
                        color: isShow
                          ? "rgba(255,255,255,0.85)"
                          : "rgba(255,255,255,0.45)",
                        fontSize: compact ? 10 : 12,
                        fontWeight: 700,
                        cursor: isAdd ? "pointer" : isShow ? "pointer" : "default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: compact ? 4 : 6,
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
                            marginLeft: compact ? 2 : 4,
                            border: "none",
                            background: "transparent",
                            color: "rgba(255,255,255,0.5)",
                            cursor: "pointer",
                            fontSize: compact ? 10 : 12,
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
              <div key={dept} style={{ marginTop: compact ? 6 : 10 }}>
                <button
                  onClick={() => toggleDept(dept)}
                  style={{
                    width: "100%",
                    borderRadius: compact ? 10 : 14,
                    padding: compact ? "7px 10px" : "10px 12px",
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: compact ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "center",
                    gap: compact ? 8 : 10,
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: compact ? 12 : 14,
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
                  people.map((c, personIdx) => {
                    const rowHover = hoverCrewId === c.id;
                    return (
                      <div
                        key={c.id}
                        style={{
                          marginTop:
                            personIdx === 0 ? (compact ? 5 : 8) : rowBandGap,
                          position: "relative",
                        }}
                      >
                        <div style={{ ...gridRow, marginBottom: rowBandGap }}>
                          <div style={frozenLeadShiftStub} data-freeze-left="1" />
                          {days.map((d) => {
                            const shift = getShift(d, c.id) || {};
                            const slots = showSlotsForDate(d);
                            const cols = colsForDate(d);
                            const chrome = dayChrome(d);
                            const hasTrackAssignment = slots.some((slot) => {
                              const canUse = slot?.kind === "show";
                              if (!canUse) return false;
                              const sid = slot?.show?.id ?? null;
                              if (!isWorking(d, c.id, sid)) return false;
                              const tid = getTrackId(d, c.id, sid);
                              return tid != null && Number.isFinite(tid);
                            });

                            return (
                              <div
                                key={`${c.id}-${d}-time`}
                                style={{
                                  ...timeCellBase,
                                  ...daySpanSpacing(d),
                                  gridColumn: `span ${cols}`,
                                  background: hasTrackAssignment
                                    ? `linear-gradient(180deg, rgba(255,255,255,0.05) 0%, ${chrome.emptyTint} 100%)`
                                    : chrome.laneTint,
                                  border: hasTrackAssignment
                                    ? `1px solid ${
                                        chrome.isTodayDay
                                          ? "rgba(0,122,255,0.38)"
                                          : "rgba(255,255,255,0.12)"
                                      }`
                                    : `1px solid ${
                                        chrome.isTodayDay
                                          ? "rgba(0,122,255,0.26)"
                                          : "rgba(255,255,255,0.08)"
                                      }`,
                                }}
                              >
                                {hasTrackAssignment ? (
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "auto minmax(0,1fr) auto minmax(0,1fr)",
                                      columnGap: compact ? 4 : 6,
                                      width: "100%",
                                      minWidth: 0,
                                      alignItems: "center",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: compact ? 9 : 10,
                                        fontWeight: 800,
                                        opacity: 0.75,
                                        whiteSpace: "nowrap",
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
                                        height: compact ? 20 : 24,
                                        fontSize: compact ? 9 : 10,
                                        padding: compact ? "1px 3px" : "2px 5px",
                                        width: "100%",
                                        minWidth: 0,
                                        maxWidth: "100%",
                                        boxSizing: "border-box",
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
                                    <span
                                      style={{
                                        fontSize: compact ? 9 : 10,
                                        fontWeight: 800,
                                        opacity: 0.75,
                                        whiteSpace: "nowrap",
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
                                        height: compact ? 20 : 24,
                                        fontSize: compact ? 9 : 10,
                                        padding: compact ? "1px 3px" : "2px 5px",
                                        width: "100%",
                                        minWidth: 0,
                                        maxWidth: "100%",
                                        boxSizing: "border-box",
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
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div
                          onMouseEnter={() => setHoverCrewId(c.id)}
                          onMouseLeave={() => setHoverCrewId(null)}
                          style={{
                            ...floatingNameCard,
                            background: rowHover
                              ? "rgba(30,36,52,0.98)"
                              : "rgba(22,28,44,0.96)",
                          }}
                          data-freeze-left="1"
                        >
                          <div style={{ fontWeight: 900, fontSize: compact ? 12 : 14 }}>
                            {c.crew_name}
                          </div>
                          {c?.is_department_lead ? (
                            <div
                              style={{
                                fontSize: compact ? 9 : 10,
                                fontWeight: 800,
                                letterSpacing: "0.02em",
                                textTransform: "uppercase",
                                opacity: 0.72,
                              }}
                            >
                              Department Lead
                            </div>
                          ) : null}
                          <div style={{ fontSize: compact ? 10 : 12, opacity: 0.6 }}>
                            {prettyDept(c.home_department)}
                          </div>
                        </div>

                        <div style={gridRow}>
                          <div
                            style={{
                              gridColumn: "2 / -1",
                              display: "grid",
                              gridTemplateColumns: `repeat(${totalCols}, minmax(${dayColMin}px, 1fr))`,
                              gap: colGap,
                            }}
                          >
                            {days.flatMap((d) => {
                              const slots = showSlotsForDate(d);
                              const cols = colsForDate(d);
                              const chrome = dayChrome(d);
                              const showCountForDay = showsForDate(d).length;
                              return slots.map((slot, idx) => {
                                const canUse = slot?.kind === "show";
                                const showId = slot?.show?.id ?? null;
                                const hideGhostForSingleShow =
                                  !canUse &&
                                  cols === 2 &&
                                  showCountForDay === 1;
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
                                      ...daySlotSpacing(d, idx, cols),
                                      padding: working ? 0 : cellBase.padding,
                                      background: !canUse
                                        ? chrome.emptyTint
                                        : working
                                        ? trackGlow
                                          ? `linear-gradient(180deg, ${trackGlow.bg} 0%, rgba(255,255,255,0.02) 100%)`
                                          : "linear-gradient(180deg, rgba(90,150,255,0.32) 0%, rgba(90,150,255,0.16) 100%)"
                                        : hover
                                        ? chrome.hoverTint
                                        : chrome.laneTint,
                                      border: !canUse
                                        ? "1px dashed rgba(255,255,255,0.07)"
                                        : working
                                        ? trackGlow
                                          ? `1px solid ${trackGlow.border}`
                                          : "1px solid rgba(90,150,255,0.40)"
                                        : `1px solid ${
                                            chrome.isTodayDay
                                              ? "rgba(0,122,255,0.18)"
                                              : "rgba(255,255,255,0.08)"
                                          }`,
                                      borderLeft:
                                        idx === 0
                                          ? `1px solid ${chrome.edge}`
                                          : undefined,
                                      borderRight:
                                        idx === cols - 1
                                          ? `1px solid ${chrome.edge}`
                                          : undefined,
                                      boxShadow: trackGlow
                                        ? `0 0 0 1px ${trackGlow.inset} inset, 0 8px 20px ${trackGlow.shadow}`
                                        : hover
                                        ? "0 6px 16px rgba(0,0,0,0.25)"
                                        : "none",
                                      transform: compact
                                        ? "none"
                                        : hover
                                        ? "translateY(-1px)"
                                        : "none",
                                      opacity: savePaused ? 0.6 : 1,
                                      cursor: !canUse
                                        ? "default"
                                        : savePaused
                                        ? "not-allowed"
                                        : "pointer",
                                      visibility: hideGhostForSingleShow
                                        ? "hidden"
                                        : "visible",
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
                                                  boxShadow: compact
                                                    ? `0 0 0 1px ${trackGlow.inset} inset`
                                                    : `0 0 0 1px ${trackGlow.inset} inset, 0 6px 14px ${trackGlow.shadow}`,
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
