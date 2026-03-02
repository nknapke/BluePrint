// src/tabs/planner/useRosterData.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDaysISO, isoDate } from "../../utils/dates";

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function safeISODate(x) {
  const d = String(x || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return d;
}

function normalizeTrackId(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function normalizeShowId(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function isTruthyFlag(value) {
  return value === true || value === "true" || value === "t" || value === 1;
}

function normalizeEmploymentType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "Full-Time";
  if (normalized === "on-call" || normalized === "on call" || normalized === "oncall") {
    return "On-Call";
  }
  return "Full-Time";
}

function normalizeDayDescription(value) {
  const s = String(value || "").trim();
  return s ? s : null;
}

function normalizeHourNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeWeekdayNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0 || i > 6) return null;
  return i;
}

function keyOf(dateISO, showId, crewId) {
  const sid = normalizeShowId(showId) ?? 0;
  return `${dateISO}|${sid}|${Number(crewId)}`;
}

function shiftKey(dateISO, crewId) {
  return `${dateISO}|${Number(crewId)}`;
}

function weekKey(weekStartISO, crewId) {
  return `${weekStartISO}|${Number(crewId)}`;
}

const MAX_HISTORY_ENTRIES = 200;
const WC_SHOWS_MINUTES_THRESHOLD = 225; // 3.75 hours
const AUTO_SHOW_DAY_DESCRIPTIONS = new Set(["Shows", "WC/Shows"]);

function sameAssignmentState(a, b) {
  return (
    !!a?.isWorking === !!b?.isWorking &&
    normalizeTrackId(a?.trackId) === normalizeTrackId(b?.trackId)
  );
}

function sameShiftState(a, b) {
  return (
    (a?.startTime || null) === (b?.startTime || null) &&
    (a?.endTime || null) === (b?.endTime || null) &&
    normalizeDayDescription(a?.dayDescription) ===
      normalizeDayDescription(b?.dayDescription)
  );
}

function parseSqlClockMinutes(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export default function useRosterData({
  locId,
  locationId,
  supabaseGet,
  supabasePost,
  supabasePatch,
  supabaseDelete,
  days = 7,
}) {
  const location = locationId ?? locId ?? null;
  const rangeDays = Math.max(1, Number(days) || 7);

  const [startISO, setStartISO] = useState(() => {
    return isoDate(startOfWeekMonday(new Date()));
  });

  const endISO = useMemo(
    () => addDaysISO(startISO, rangeDays - 1),
    [startISO, rangeDays]
  );
  const dateList = useMemo(() => {
    return Array.from({ length: rangeDays }, (_, i) =>
      addDaysISO(startISO, i)
    );
  }, [startISO, rangeDays]);

  // Crew
  const [crew, setCrew] = useState([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [crewError, setCrewError] = useState("");

  // Shift times (per crew/day)
  const [shiftMap, setShiftMap] = useState(() => new Map());
  const [dayHoursMap, setDayHoursMap] = useState(() => new Map());
  const [weekHoursMap, setWeekHoursMap] = useState(() => new Map());
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState("");

  // Shows for visible range only
  const [shows, setShows] = useState([]);
  const [showsLoading, setShowsLoading] = useState(false);
  const [showsError, setShowsError] = useState("");

  const showsByDate = useMemo(() => {
    const map = new Map();
    for (const s of Array.isArray(shows) ? shows : []) {
      const d = safeISODate(s.show_date);
      if (!d) continue;
      const entry = {
        id: Number(s.id),
        date: d,
        time: s.show_time,
        sortOrder: Number(s.sort_order) || 0,
      };
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(entry);
    }
    for (const [d, list] of map.entries()) {
      list.sort((a, b) => {
        if (a.sortOrder && b.sortOrder && a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return String(a.time).localeCompare(String(b.time));
      });
      map.set(d, list);
    }
    return map;
  }, [shows]);

  // Assignments for visible range only
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignMap, setAssignMap] = useState(() => new Map());

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [savePaused, setSavePaused] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Dirty buffer for debounced saving
  const dirtyRef = useRef(new Map()); // key -> { location_id, work_date, crew_id, show_id, is_working, track_id }
  const saveTimerRef = useRef(null);
  const pendingAutoShowsRef = useRef(new Set());
  const autoManagedShowDescriptionsRef = useRef(new Set());
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const historyMutedRef = useRef(false);
  const historyApplyingRef = useRef(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [historyApplying, setHistoryApplying] = useState(false);

  const canRun =
    !!location &&
    typeof supabaseGet === "function" &&
    typeof supabasePost === "function";

  const syncHistoryState = useCallback(() => {
    setHistoryVersion((n) => n + 1);
  }, []);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistoryState();
  }, [syncHistoryState]);

  const pushHistoryEntry = useCallback(
    (entry) => {
      if (!entry || historyMutedRef.current) return;
      undoStackRef.current.push(entry);
      if (undoStackRef.current.length > MAX_HISTORY_ENTRIES) {
        undoStackRef.current.splice(
          0,
          undoStackRef.current.length - MAX_HISTORY_ENTRIES
        );
      }
      redoStackRef.current = [];
      syncHistoryState();
    },
    [syncHistoryState]
  );

  const loadCrew = useCallback(async () => {
    if (!canRun) return;
    setCrewLoading(true);
    setCrewError("");

    try {
      const withMetaPath =
        "/rest/v1/crew_roster" +
        `?select=id,crew_name,home_department,status,employment_type,is_department_lead,weekly_off_day_1,weekly_off_day_2,location_id` +
        `&location_id=eq.${Number(location)}` +
        `&status=eq.Active` +
        `&order=crew_name.asc`;
      const withMetaNoEmploymentPath =
        "/rest/v1/crew_roster" +
        `?select=id,crew_name,home_department,status,is_department_lead,weekly_off_day_1,weekly_off_day_2,location_id` +
        `&location_id=eq.${Number(location)}` +
        `&status=eq.Active` +
        `&order=crew_name.asc`;
      const withLeadPath =
        "/rest/v1/crew_roster" +
        `?select=id,crew_name,home_department,status,employment_type,is_department_lead,location_id` +
        `&location_id=eq.${Number(location)}` +
        `&status=eq.Active` +
        `&order=crew_name.asc`;
      const withLeadNoEmploymentPath =
        "/rest/v1/crew_roster" +
        `?select=id,crew_name,home_department,status,is_department_lead,location_id` +
        `&location_id=eq.${Number(location)}` +
        `&status=eq.Active` +
        `&order=crew_name.asc`;
      const legacyPath =
        "/rest/v1/crew_roster" +
        `?select=id,crew_name,home_department,status,location_id` +
        `&location_id=eq.${Number(location)}` +
        `&status=eq.Active` +
        `&order=crew_name.asc`;

      let rows = [];
      try {
        rows = await supabaseGet(withMetaPath, {
          cacheTag: `roster:crew:${location}`,
        });
      } catch (firstErr) {
        const msg1 = String(firstErr?.message || firstErr || "").toLowerCase();
        const missingWeeklyCols =
          msg1.includes("weekly_off_day_1") || msg1.includes("weekly_off_day_2");
        const missingLeadCol = msg1.includes("is_department_lead");
        const missingEmploymentCol = msg1.includes("employment_type");
        const missingColumn = msg1.includes("42703") || msg1.includes("column");
        if (
          !missingColumn &&
          !missingWeeklyCols &&
          !missingLeadCol &&
          !missingEmploymentCol
        ) {
          throw firstErr;
        }

        if (missingLeadCol) {
          rows = await supabaseGet(legacyPath, {
            cacheTag: `roster:crew:${location}`,
          });
        } else if (missingWeeklyCols && missingEmploymentCol) {
          rows = await supabaseGet(withLeadNoEmploymentPath, {
            cacheTag: `roster:crew:${location}`,
          });
        } else if (missingWeeklyCols) {
          rows = await supabaseGet(withLeadPath, {
            cacheTag: `roster:crew:${location}`,
          });
        } else if (missingEmploymentCol) {
          rows = await supabaseGet(withMetaNoEmploymentPath, {
            cacheTag: `roster:crew:${location}`,
          });
        } else {
          rows = await supabaseGet(legacyPath, {
            cacheTag: `roster:crew:${location}`,
          });
        }
      }
      setCrew(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          ...r,
          employment_type: normalizeEmploymentType(r?.employment_type),
          employmentType: normalizeEmploymentType(r?.employment_type),
          is_department_lead: isTruthyFlag(r?.is_department_lead),
          weekly_off_day_1: normalizeWeekdayNumber(r?.weekly_off_day_1),
          weekly_off_day_2: normalizeWeekdayNumber(r?.weekly_off_day_2),
          weeklyOffDay1: normalizeWeekdayNumber(r?.weekly_off_day_1),
          weeklyOffDay2: normalizeWeekdayNumber(r?.weekly_off_day_2),
        }))
      );
    } catch (e) {
      setCrewError(String(e?.message || e));
      setCrew([]);
    } finally {
      setCrewLoading(false);
    }
  }, [canRun, location, supabaseGet]);

  const loadShowsForRange = useCallback(
    async (rangeStartISO, rangeEndISO, opts = {}) => {
      if (!location || typeof supabaseGet !== "function") return;
      const rs = safeISODate(rangeStartISO);
      const re = safeISODate(rangeEndISO);
      if (!rs || !re) return;

      setShowsLoading(true);
      setShowsError("");

      try {
        const path =
          "/rest/v1/show_instances" +
          `?select=id,location_id,show_date,show_time,sort_order` +
          `&location_id=eq.${Number(location)}` +
          `&show_date=gte.${rs}` +
          `&show_date=lte.${re}`;

        const rows = await supabaseGet(path, {
          cacheTag: `roster:shows:${location}:${rs}:${re}`,
          ...opts,
        });
        setShows(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setShowsError(String(e?.message || e));
        setShows([]);
      } finally {
        setShowsLoading(false);
      }
    },
    [location, supabaseGet]
  );

  const loadAssignmentsForRange = useCallback(
    async (rangeStartISO, rangeEndISO, opts = {}) => {
      if (!canRun) return;

      const rs = safeISODate(rangeStartISO);
      const re = safeISODate(rangeEndISO);
      if (!rs || !re) return;

      setAssignLoading(true);
      setAssignError("");

      try {
        const path =
          "/rest/v1/work_roster_assignments" +
          `?select=id,location_id,work_date,crew_id,show_id,is_working,track_id` +
          `&location_id=eq.${Number(location)}` +
          `&work_date=gte.${rs}` +
          `&work_date=lte.${re}`;

        const rows = await supabaseGet(path, {
          cacheTag: `roster:assign:${location}:${rs}:${re}`,
          ...opts,
        });

        const next = new Map();
        for (const r of Array.isArray(rows) ? rows : []) {
          const d = safeISODate(r.work_date);
          const cid = Number(r.crew_id);
          if (!d || !Number.isFinite(cid)) continue;
          next.set(keyOf(d, r.show_id, cid), {
            isWorking: !!r.is_working,
            trackId: normalizeTrackId(r.track_id),
            showId: normalizeShowId(r.show_id),
          });
        }
        setAssignMap(next);
      } catch (e) {
        setAssignError(String(e?.message || e));
        setAssignMap(new Map());
      } finally {
        setAssignLoading(false);
      }
    },
    [canRun, location, supabaseGet]
  );

  const loadShiftsForRange = useCallback(
    async (rangeStartISO, rangeEndISO, opts = {}) => {
      if (!canRun) return;

      const rs = safeISODate(rangeStartISO);
      const re = safeISODate(rangeEndISO);
      if (!rs || !re) return;

      setShiftLoading(true);
      setShiftError("");

      try {
        const path =
          "/rest/v1/crew_work_shifts" +
          `?select=location_id,work_date,crew_id,start_time,end_time,day_description` +
          `&location_id=eq.${Number(location)}` +
          `&work_date=gte.${rs}` +
          `&work_date=lte.${re}`;

        const rows = await supabaseGet(path, {
          cacheTag: `roster:shifts:${location}:${rs}:${re}`,
          ...opts,
        });

        const next = new Map();
        for (const r of Array.isArray(rows) ? rows : []) {
          const d = safeISODate(r.work_date);
          const cid = Number(r.crew_id);
          if (!d || !Number.isFinite(cid)) continue;
          next.set(shiftKey(d, cid), {
            startTime: r.start_time || null,
            endTime: r.end_time || null,
            dayDescription: normalizeDayDescription(r.day_description),
          });
        }
        setShiftMap(next);

        try {
          const hoursPath =
            "/rest/v1/v_crew_day_hours" +
            `?select=location_id,work_date,crew_id,total_hours,lead_hours,hours,regular_overtime_hours,lead_overtime_hours` +
            `&location_id=eq.${Number(location)}` +
            `&work_date=gte.${rs}` +
            `&work_date=lte.${re}`;

          const hourRows = await supabaseGet(hoursPath, {
            cacheTag: `roster:dayhours:${location}:${rs}:${re}`,
            ...opts,
          });

          const nextHours = new Map();
          for (const r of Array.isArray(hourRows) ? hourRows : []) {
            const d = safeISODate(r.work_date);
            const cid = Number(r.crew_id);
            if (!d || !Number.isFinite(cid)) continue;
            nextHours.set(shiftKey(d, cid), {
              totalHours: normalizeHourNumber(r.total_hours),
              leadHours: normalizeHourNumber(r.lead_hours),
              regularHours: normalizeHourNumber(r.hours),
              regularOvertimeHours: normalizeHourNumber(r.regular_overtime_hours),
              leadOvertimeHours: normalizeHourNumber(r.lead_overtime_hours),
            });
          }

          try {
            const workedPath =
              "/rest/v1/v_crew_day_worked_hours" +
              `?select=location_id,work_date,crew_id,worked_hours` +
              `&location_id=eq.${Number(location)}` +
              `&work_date=gte.${rs}` +
              `&work_date=lte.${re}`;
            const workedRows = await supabaseGet(workedPath, {
              cacheTag: `roster:workedhours:${location}:${rs}:${re}`,
              ...opts,
            });
            for (const row of Array.isArray(workedRows) ? workedRows : []) {
              const d = safeISODate(row?.work_date);
              const cid = Number(row?.crew_id);
              if (!d || !Number.isFinite(cid)) continue;
              const k = shiftKey(d, cid);
              const existing = nextHours.get(k) || {
                totalHours: null,
                leadHours: null,
                regularHours: null,
                regularOvertimeHours: null,
                leadOvertimeHours: null,
              };
              nextHours.set(k, {
                ...existing,
                workedHours: normalizeHourNumber(row?.worked_hours),
              });
            }
          } catch (workedErr) {
            const workedMsg = String(workedErr?.message || workedErr || "").toLowerCase();
            const missingWorkedView =
              workedMsg.includes("v_crew_day_worked_hours") ||
              workedMsg.includes("42p01") ||
              workedMsg.includes("relation");
            if (!missingWorkedView) {
              setShiftError(String(workedErr?.message || workedErr));
            }
          }

          setDayHoursMap(nextHours);
        } catch (hoursErr) {
          const msg = String(hoursErr?.message || hoursErr || "").toLowerCase();
          const missingView =
            msg.includes("v_crew_day_hours") ||
            msg.includes("42p01") ||
            msg.includes("relation");
          if (!missingView) {
            setShiftError(String(hoursErr?.message || hoursErr));
          }
          setDayHoursMap(new Map());
        }
      } catch (e) {
        setShiftError(String(e?.message || e));
        setShiftMap(new Map());
        setDayHoursMap(new Map());
      } finally {
        setShiftLoading(false);
      }
    },
    [canRun, location, supabaseGet]
  );

  const loadWeekHoursForRange = useCallback(
    async (rangeStartISO, rangeEndISO, opts = {}) => {
      if (!canRun) return;

      const rs = safeISODate(rangeStartISO);
      const re = safeISODate(rangeEndISO);
      if (!rs || !re) return;

      try {
        const weekPath =
          "/rest/v1/v_crew_week_hours" +
          `?select=location_id,week_start,week_end,crew_id,total_hours,paid_hours,lead_hours,regular_hours,regular_overtime_hours,lead_overtime_hours` +
          `&location_id=eq.${Number(location)}` +
          `&week_start=gte.${rs}` +
          `&week_start=lte.${re}`;

        const rows = await supabaseGet(weekPath, {
          cacheTag: `roster:weekhours:${location}:${rs}:${re}`,
          ...opts,
        });

        const next = new Map();
        for (const row of Array.isArray(rows) ? rows : []) {
          const weekStart = safeISODate(row?.week_start);
          const crewId = Number(row?.crew_id);
          if (!weekStart || !Number.isFinite(crewId)) continue;
          next.set(weekKey(weekStart, crewId), {
            totalHours: normalizeHourNumber(row?.total_hours),
            paidHours: normalizeHourNumber(row?.paid_hours),
            leadHours: normalizeHourNumber(row?.lead_hours),
            regularHours: normalizeHourNumber(row?.regular_hours),
            regularOvertimeHours: normalizeHourNumber(row?.regular_overtime_hours),
            leadOvertimeHours: normalizeHourNumber(row?.lead_overtime_hours),
          });
        }
        setWeekHoursMap(next);
      } catch (weekErr) {
        const msg = String(weekErr?.message || weekErr || "").toLowerCase();
        const missingView =
          msg.includes("v_crew_week_hours") ||
          msg.includes("42p01") ||
          msg.includes("relation");
        if (!missingView) {
          setShiftError(String(weekErr?.message || weekErr));
        }
        setWeekHoursMap(new Map());
      }
    },
    [canRun, location, supabaseGet]
  );

  useEffect(() => {
    if (!canRun) return;
    loadCrew();
  }, [canRun, loadCrew]);

  useEffect(() => {
    clearHistory();
  }, [location, clearHistory]);

  useEffect(() => {
    if (!canRun) return;
    loadAssignmentsForRange(startISO, endISO);
    loadShowsForRange(startISO, endISO);
    loadShiftsForRange(startISO, endISO);
    loadWeekHoursForRange(startISO, endISO);
  }, [
    canRun,
    loadAssignmentsForRange,
    loadShowsForRange,
    loadShiftsForRange,
    loadWeekHoursForRange,
    startISO,
    endISO,
  ]);

  const getAssignment = useCallback(
    (dateISO, crewId, showId = null) => {
      const d = safeISODate(dateISO);
      if (!d) return { isWorking: false, trackId: null };
      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return { isWorking: false, trackId: null };
      const k = keyOf(d, showId, cid);
      const entry = assignMap.get(k);
      return {
        isWorking: !!entry?.isWorking,
        trackId: normalizeTrackId(entry?.trackId),
        showId: normalizeShowId(entry?.showId),
      };
    },
    [assignMap]
  );

  const isWorking = useCallback(
    (dateISO, crewId, showId = null) =>
      getAssignment(dateISO, crewId, showId).isWorking,
    [getAssignment]
  );

  const getTrackId = useCallback(
    (dateISO, crewId, showId = null) =>
      getAssignment(dateISO, crewId, showId).trackId,
    [getAssignment]
  );

  const getShift = useCallback(
    (dateISO, crewId) => {
      const d = safeISODate(dateISO);
      if (!d) return { startTime: null, endTime: null, dayDescription: null };
      const cid = Number(crewId);
      if (!Number.isFinite(cid))
        return { startTime: null, endTime: null, dayDescription: null };
      const entry = shiftMap.get(shiftKey(d, cid));
      return {
        startTime: entry?.startTime || null,
        endTime: entry?.endTime || null,
        dayDescription: normalizeDayDescription(entry?.dayDescription),
      };
    },
    [shiftMap]
  );

  const getDayHours = useCallback(
    (dateISO, crewId) => {
      const d = safeISODate(dateISO);
      if (!d) return null;
      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return null;
      const entry = dayHoursMap.get(shiftKey(d, cid));
      if (!entry) return null;
      return {
        workedHours: normalizeHourNumber(entry?.workedHours),
        totalHours: normalizeHourNumber(entry?.totalHours),
        leadHours: normalizeHourNumber(entry?.leadHours),
        regularHours: normalizeHourNumber(entry?.regularHours),
        regularOvertimeHours: normalizeHourNumber(entry?.regularOvertimeHours),
        leadOvertimeHours: normalizeHourNumber(entry?.leadOvertimeHours),
      };
    },
    [dayHoursMap]
  );

  const getWeekHours = useCallback(
    (weekStartISO, crewId) => {
      const w = safeISODate(weekStartISO);
      if (!w) return null;
      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return null;
      const entry = weekHoursMap.get(weekKey(w, cid));
      if (!entry) return null;
      return {
        totalHours: normalizeHourNumber(entry?.totalHours),
        paidHours: normalizeHourNumber(entry?.paidHours),
        leadHours: normalizeHourNumber(entry?.leadHours),
        regularHours: normalizeHourNumber(entry?.regularHours),
        regularOvertimeHours: normalizeHourNumber(entry?.regularOvertimeHours),
        leadOvertimeHours: normalizeHourNumber(entry?.leadOvertimeHours),
      };
    },
    [weekHoursMap]
  );

  const refreshDayHoursForDate = useCallback(
    async (dateISO, opts = {}) => {
      if (!canRun) return;
      const d = safeISODate(dateISO);
      if (!d) return;
      if (typeof supabaseGet !== "function") return;

      try {
        const hoursPath =
          "/rest/v1/v_crew_day_hours" +
          `?select=location_id,work_date,crew_id,total_hours,lead_hours,hours,regular_overtime_hours,lead_overtime_hours` +
          `&location_id=eq.${Number(location)}` +
          `&work_date=eq.${d}`;
        const rows = await supabaseGet(hoursPath, {
          cacheTag: `roster:dayhours:${location}:${d}`,
          ...opts,
        });

        let workedRows = [];
        try {
          const workedPath =
            "/rest/v1/v_crew_day_worked_hours" +
            `?select=location_id,work_date,crew_id,worked_hours` +
            `&location_id=eq.${Number(location)}` +
            `&work_date=eq.${d}`;
          const result = await supabaseGet(workedPath, {
            cacheTag: `roster:workedhours:${location}:${d}`,
            ...opts,
          });
          workedRows = Array.isArray(result) ? result : [];
        } catch (_workedErr) {
          workedRows = [];
        }

        setDayHoursMap((prev) => {
          const next = new Map(prev);
          for (const key of Array.from(next.keys())) {
            if (String(key).startsWith(`${d}|`)) next.delete(key);
          }
          for (const row of Array.isArray(rows) ? rows : []) {
            const rDate = safeISODate(row?.work_date);
            const rCrewId = Number(row?.crew_id);
            if (!rDate || rDate !== d || !Number.isFinite(rCrewId)) continue;
            next.set(shiftKey(d, rCrewId), {
              workedHours: null,
              totalHours: normalizeHourNumber(row.total_hours),
              leadHours: normalizeHourNumber(row.lead_hours),
              regularHours: normalizeHourNumber(row.hours),
              regularOvertimeHours: normalizeHourNumber(row.regular_overtime_hours),
              leadOvertimeHours: normalizeHourNumber(row.lead_overtime_hours),
            });
          }
          for (const row of workedRows) {
            const rDate = safeISODate(row?.work_date);
            const rCrewId = Number(row?.crew_id);
            if (!rDate || rDate !== d || !Number.isFinite(rCrewId)) continue;
            const k = shiftKey(d, rCrewId);
            const existing = next.get(k) || {
              totalHours: null,
              leadHours: null,
              regularHours: null,
              regularOvertimeHours: null,
              leadOvertimeHours: null,
            };
            next.set(k, {
              ...existing,
              workedHours: normalizeHourNumber(row?.worked_hours),
            });
          }
          return next;
        });
      } catch (_e) {
        // Keep existing values; loadShiftsForRange will eventually refresh this.
      }
    },
    [canRun, location, supabaseGet]
  );

  const setShiftFor = useCallback(
    async (
      dateISO,
      crewId,
      startTime,
      endTime,
      dayDescription = undefined,
      opts = {}
    ) => {
      const recordHistory = opts?.recordHistory !== false;
      const allowWhenPaused = opts?.allowWhenPaused === true;
      if ((!allowWhenPaused && savePaused) || !location || typeof supabasePost !== "function") {
        return false;
      }
      const d = safeISODate(dateISO);
      if (!d) return false;
      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return false;

      const current = getShift(d, cid);
      const before = {
        startTime: current?.startTime || null,
        endTime: current?.endTime || null,
        dayDescription: normalizeDayDescription(current?.dayDescription),
      };
      const nextStart = startTime || null;
      const nextEnd = endTime || null;
      const nextDayDescription =
        dayDescription === undefined
          ? normalizeDayDescription(current?.dayDescription)
          : normalizeDayDescription(dayDescription);
      const shiftStateKey = shiftKey(d, cid);
      const nextIsAutoShowDescription =
        !!nextDayDescription && AUTO_SHOW_DAY_DESCRIPTIONS.has(nextDayDescription);
      const after = {
        startTime: nextStart,
        endTime: nextEnd,
        dayDescription: nextDayDescription,
      };
      if (sameShiftState(before, after)) return false;

      if (recordHistory) {
        pushHistoryEntry({
          type: "shift",
          dateISO: d,
          crewId: cid,
          before,
          after,
        });
      }

      if (!nextStart && !nextEnd && !nextDayDescription) {
        autoManagedShowDescriptionsRef.current.delete(shiftStateKey);
      } else if (opts?.autoManaged === true) {
        if (nextIsAutoShowDescription) {
          autoManagedShowDescriptionsRef.current.add(shiftStateKey);
        } else {
          autoManagedShowDescriptionsRef.current.delete(shiftStateKey);
        }
      } else if (dayDescription !== undefined) {
        autoManagedShowDescriptionsRef.current.delete(shiftStateKey);
      }

      setShiftMap((prev) => {
        const m = new Map(prev);
        if (!nextStart && !nextEnd && !nextDayDescription) {
          m.delete(shiftKey(d, cid));
        } else {
          m.set(shiftKey(d, cid), {
            startTime: nextStart,
            endTime: nextEnd,
            dayDescription: nextDayDescription,
          });
        }
        return m;
      });
      pendingAutoShowsRef.current.add(`${d}|${cid}`);
      setDayHoursMap((prev) => {
        const next = new Map(prev);
        next.delete(shiftKey(d, cid));
        return next;
      });

      setShiftError("");
      try {
        if (!nextStart && !nextEnd && !nextDayDescription) {
          if (typeof supabaseDelete === "function") {
            await supabaseDelete(
              `/rest/v1/crew_work_shifts?location_id=eq.${Number(
                location
              )}&work_date=eq.${d}&crew_id=eq.${cid}`
            );
          }
          await refreshDayHoursForDate(d, { bypassCache: true });
          await loadWeekHoursForRange(startISO, endISO, { bypassCache: true });
          return true;
        }
        await supabasePost(
          "/rest/v1/crew_work_shifts?on_conflict=location_id,work_date,crew_id",
          [
            {
              location_id: Number(location),
              work_date: d,
              crew_id: cid,
              start_time: nextStart,
              end_time: nextEnd,
              day_description: nextDayDescription,
            },
          ],
          { headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }
        );
        await refreshDayHoursForDate(d, { bypassCache: true });
        await loadWeekHoursForRange(startISO, endISO, { bypassCache: true });
        return true;
      } catch (e) {
        setShiftError(String(e?.message || e));
        return false;
      }
    },
    [
      location,
      supabasePost,
      supabaseDelete,
      getShift,
      refreshDayHoursForDate,
      loadWeekHoursForRange,
      startISO,
      endISO,
      savePaused,
      pushHistoryEntry,
    ]
  );

  const setDayDescriptionFor = useCallback(
    async (dateISO, crewId, dayDescription) => {
      const current = getShift(dateISO, crewId);
      await setShiftFor(
        dateISO,
        crewId,
        current?.startTime || null,
        current?.endTime || null,
        dayDescription,
        { autoManaged: false }
      );
    },
    [getShift, setShiftFor]
  );

  const flushSave = useCallback(async () => {
    if (!canRun) return;
    if (savePaused) return;

    const dirty = Array.from(dirtyRef.current.values());
    if (dirty.length === 0) return;

    setIsSaving(true);
    setSaveError("");

    try {
      await supabasePost(
        "/rest/v1/work_roster_assignments?on_conflict=location_id,work_date,show_id,crew_id",
        dirty,
        {
          headers: {
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
        }
      );

      dirtyRef.current.clear();
      setIsSaving(false);
      setSavedPulse(true);
      setTimeout(() => setSavedPulse(false), 650);
    } catch (e) {
      const msg = String(e?.message || e);
      setIsSaving(false);
      setSavePaused(true);
      setSaveError(msg);
    }
  }, [canRun, savePaused, supabasePost]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushSave();
    }, 550);
  }, [flushSave]);

  const retrySaving = useCallback(async () => {
    setSavePaused(false);
    setSaveError("");
    await flushSave();
  }, [flushSave]);

  const getShowsForDate = useCallback(
    (dateISO) => {
      const d = safeISODate(dateISO);
      if (!d) return [];
      return showsByDate.get(d) || [];
    },
    [showsByDate]
  );

  const createShow = useCallback(
    async (dateISO, timeValue, sortOrder = null) => {
      if (!location || typeof supabasePost !== "function") return;
      const d = safeISODate(dateISO);
      if (!d) return;
      if (!timeValue) return;
      setShowsError("");
      const payload = {
        location_id: Number(location),
        show_date: d,
        show_time: timeValue,
      };
      if (Number.isFinite(Number(sortOrder))) {
        payload.sort_order = Number(sortOrder);
      }
      try {
        await supabasePost(
          "/rest/v1/show_instances?on_conflict=location_id,show_date,show_time",
          [payload],
          {
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          }
        );
        loadShowsForRange(startISO, endISO, { bypassCache: true });
      } catch (e) {
        setShowsError(String(e?.message || e));
      }
    },
    [location, supabasePost, loadShowsForRange, startISO, endISO]
  );

  const updateShow = useCallback(
    async (showId, timeValue) => {
      if (!showId || typeof supabasePatch !== "function") return;
      if (!timeValue) return;
      setShowsError("");
      const current = (shows || []).find(
        (s) => Number(s.id) === Number(showId)
      );
      if (current) {
        const curDate = safeISODate(current.show_date);
        const dup = (shows || []).find(
          (s) =>
            Number(s.id) !== Number(showId) &&
            safeISODate(s.show_date) === curDate &&
            String(s.show_time) === String(timeValue)
        );
        if (dup) {
          setShowsError("Show time already exists for this day.");
          return;
        }
      }
      try {
        await supabasePatch(`/rest/v1/show_instances?id=eq.${Number(showId)}`, {
          show_time: timeValue,
        });
        loadShowsForRange(startISO, endISO, { bypassCache: true });
      } catch (e) {
        setShowsError(String(e?.message || e));
      }
    },
    [supabasePatch, loadShowsForRange, startISO, endISO, shows]
  );

  const deleteShow = useCallback(
    async (showId, dateISO) => {
      if (!showId || typeof supabaseDelete !== "function") return;
      const d = safeISODate(dateISO);
      if (!d) return;
      setShowsError("");
      try {
        await supabaseDelete(
          `/rest/v1/work_roster_assignments?location_id=eq.${Number(
            location
          )}&work_date=eq.${d}&show_id=eq.${Number(showId)}`
        );
        await supabaseDelete(`/rest/v1/show_instances?id=eq.${Number(showId)}`);
        loadShowsForRange(startISO, endISO, { bypassCache: true });
      } catch (e) {
        setShowsError(String(e?.message || e));
      }
    },
    [location, supabaseDelete, loadShowsForRange, startISO, endISO]
  );

  const getAutoShowDescriptionForCrewOnDay = useCallback(
    (dateISO, crewId, sourceMap, shiftStartTime = null) => {
      const d = safeISODate(dateISO);
      if (!d) return null;
      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return null;

      const showsForDay = (showsByDate.get(d) || []).slice(0, 4);
      if (!showsForDay.length) return null;

      let firstAssignedShowMinutes = null;
      for (const show of showsForDay) {
        const entry = sourceMap.get(keyOf(d, show.id, cid));
        if (!entry?.isWorking) continue;
        if (!normalizeTrackId(entry?.trackId)) continue;
        const showMinutes = parseSqlClockMinutes(show?.time);
        if (showMinutes == null) continue;
        if (firstAssignedShowMinutes == null || showMinutes < firstAssignedShowMinutes) {
          firstAssignedShowMinutes = showMinutes;
        }
      }

      if (firstAssignedShowMinutes == null) return null;

      const startMinutes = parseSqlClockMinutes(shiftStartTime);
      if (startMinutes == null) return null;

      const leadInMinutes = firstAssignedShowMinutes - startMinutes;
      return leadInMinutes > WC_SHOWS_MINUTES_THRESHOLD ? "WC/Shows" : "Shows";
    },
    [showsByDate]
  );

  const setAssignmentFor = useCallback(
    (dateISO, crewId, showId, next, opts = {}) => {
      const recordHistory = opts?.recordHistory !== false;
      const allowWhenPaused = opts?.allowWhenPaused === true;
      if (!allowWhenPaused && savePaused) return false;

      const d = safeISODate(dateISO);
      if (!d) return false;

      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return false;

      const lid = Number(location);
      if (!Number.isFinite(lid)) return false;

      const sid = normalizeShowId(showId);
      const nextIsWorking = !!next?.isWorking;
      const nextTrackId = nextIsWorking ? normalizeTrackId(next?.trackId) : null;
      const beforeRaw = getAssignment(d, cid, sid);
      const before = {
        isWorking: !!beforeRaw?.isWorking,
        trackId: normalizeTrackId(beforeRaw?.trackId),
      };
      const after = {
        isWorking: nextIsWorking,
        trackId: nextTrackId,
      };
      if (sameAssignmentState(before, after)) return false;

      if (recordHistory) {
        pushHistoryEntry({
          type: "assignment",
          dateISO: d,
          crewId: cid,
          showId: sid,
          before,
          after,
        });
      }

      const k = keyOf(d, sid, cid);

      setAssignMap((prev) => {
        const m = new Map(prev);
        m.set(k, { isWorking: nextIsWorking, trackId: nextTrackId, showId: sid });
        return m;
      });
      pendingAutoShowsRef.current.add(`${d}|${cid}`);

      dirtyRef.current.set(k, {
        location_id: lid,
        work_date: d,
        crew_id: cid,
        show_id: sid,
        is_working: nextIsWorking,
        track_id: nextTrackId,
      });

      scheduleSave();
      return true;
    },
    [location, savePaused, getAssignment, pushHistoryEntry, scheduleSave]
  );

  const setWorkingFor = useCallback(
    (dateISO, crewId, showId, nextVal) => {
      const current = getAssignment(dateISO, crewId, showId);
      const nextIsWorking = !!nextVal;
      setAssignmentFor(dateISO, crewId, showId, {
        isWorking: nextIsWorking,
        trackId: nextIsWorking ? current.trackId : null,
      });
    },
    [getAssignment, setAssignmentFor]
  );

  const setTrackFor = useCallback(
    (dateISO, crewId, showId, nextTrackId) => {
      const current = getAssignment(dateISO, crewId, showId);
      if (!current.isWorking) return;
      setAssignmentFor(dateISO, crewId, showId, {
        isWorking: true,
        trackId: nextTrackId,
      });
    },
    [getAssignment, setAssignmentFor]
  );

  useEffect(() => {
    for (const [assignKey, entry] of assignMap.entries()) {
      if (!entry?.isWorking) continue;
      if (!normalizeTrackId(entry?.trackId)) continue;
      const parts = String(assignKey || "").split("|");
      const dRaw = parts[0];
      const crewRaw = parts[2];
      const d = safeISODate(dRaw);
      const cid = Number(crewRaw);
      if (!d || !Number.isFinite(cid)) continue;
      pendingAutoShowsRef.current.add(`${d}|${cid}`);
    }
  }, [assignMap, showsByDate, shiftMap]);

  useEffect(() => {
    const pending = Array.from(pendingAutoShowsRef.current);
    if (!pending.length) return;
    pendingAutoShowsRef.current.clear();

    let canceled = false;
    (async () => {
      for (const key of pending) {
        if (canceled) return;

        const [dRaw, crewRaw] = String(key || "").split("|");
        const d = safeISODate(dRaw);
        const cid = Number(crewRaw);
        if (!d || !Number.isFinite(cid)) continue;

        const currentShift = getShift(d, cid);
        const currentDescription = normalizeDayDescription(currentShift?.dayDescription);
        const shiftStateKey = shiftKey(d, cid);
        const isAutoManaged =
          autoManagedShowDescriptionsRef.current.has(shiftStateKey);
        if (
          currentDescription &&
          (!AUTO_SHOW_DAY_DESCRIPTIONS.has(currentDescription) || !isAutoManaged)
        ) {
          continue;
        }

        const nextDescription = normalizeDayDescription(
          getAutoShowDescriptionForCrewOnDay(
            d,
            cid,
            assignMap,
            currentShift?.startTime || null
          )
        );

        if (currentDescription === nextDescription) continue;

        await setShiftFor(
          d,
          cid,
          currentShift?.startTime || null,
          currentShift?.endTime || null,
          nextDescription,
          { recordHistory: false, autoManaged: true }
        );
      }
    })();

    return () => {
      canceled = true;
    };
  }, [
    assignMap,
    shiftMap,
    showsByDate,
    getAutoShowDescriptionForCrewOnDay,
    getShift,
    setShiftFor,
  ]);

  const assignCrewToTrack = useCallback(
    (dateISO, crewId, showId, nextTrackId) => {
      setAssignmentFor(dateISO, crewId, showId, {
        isWorking: true,
        trackId: nextTrackId,
      });
    },
    [setAssignmentFor]
  );

  const applyHistoryEntry = useCallback(
    async (entry, direction) => {
      if (!entry || (direction !== "undo" && direction !== "redo")) return false;
      const target = direction === "undo" ? entry.before : entry.after;
      if (entry.type === "assignment") {
        return setAssignmentFor(
          entry.dateISO,
          entry.crewId,
          entry.showId,
          {
            isWorking: !!target?.isWorking,
            trackId: normalizeTrackId(target?.trackId),
          },
          { recordHistory: false }
        );
      }
      if (entry.type === "shift") {
        return setShiftFor(
          entry.dateISO,
          entry.crewId,
          target?.startTime || null,
          target?.endTime || null,
          normalizeDayDescription(target?.dayDescription),
          { recordHistory: false }
        );
      }
      return false;
    },
    [setAssignmentFor, setShiftFor]
  );

  const undo = useCallback(async () => {
    if (savePaused || historyApplyingRef.current) return false;
    const entry = undoStackRef.current.pop();
    if (!entry) return false;

    historyApplyingRef.current = true;
    setHistoryApplying(true);
    historyMutedRef.current = true;
    try {
      const applied = await applyHistoryEntry(entry, "undo");
      if (!applied) {
        undoStackRef.current.push(entry);
        syncHistoryState();
        return false;
      }
      redoStackRef.current.push(entry);
      syncHistoryState();
      return true;
    } finally {
      historyMutedRef.current = false;
      historyApplyingRef.current = false;
      setHistoryApplying(false);
    }
  }, [applyHistoryEntry, savePaused, syncHistoryState]);

  const redo = useCallback(async () => {
    if (savePaused || historyApplyingRef.current) return false;
    const entry = redoStackRef.current.pop();
    if (!entry) return false;

    historyApplyingRef.current = true;
    setHistoryApplying(true);
    historyMutedRef.current = true;
    try {
      const applied = await applyHistoryEntry(entry, "redo");
      if (!applied) {
        redoStackRef.current.push(entry);
        syncHistoryState();
        return false;
      }
      undoStackRef.current.push(entry);
      syncHistoryState();
      return true;
    } finally {
      historyMutedRef.current = false;
      historyApplyingRef.current = false;
      setHistoryApplying(false);
    }
  }, [applyHistoryEntry, savePaused, syncHistoryState]);

  const canUndo = historyVersion >= 0 && undoStackRef.current.length > 0;
  const canRedo = historyVersion >= 0 && redoStackRef.current.length > 0;

  const toggleCell = useCallback(
    (dateISO, crewId, showId) => {
      if (savePaused) return;

      const d = safeISODate(dateISO);
      if (!d) return;

      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return;

      const current = isWorking(d, cid, showId);
      setWorkingFor(d, cid, showId, !current);
    },
    [isWorking, savePaused, setWorkingFor]
  );

  const clearDay = useCallback(
    (dateISO) => {
      if (savePaused) return;

      const d = safeISODate(dateISO);
      if (!d) return;

      const showList = getShowsForDate(d);
      const showsToClear = showList.length ? showList : [{ id: null }];
      for (const c of crew) {
        for (const s of showsToClear) {
          setWorkingFor(d, c.id, s.id ?? null, false);
        }
      }
    },
    [crew, savePaused, setWorkingFor, getShowsForDate]
  );

  const copyPreviousWeek = useCallback(async () => {
    if (savePaused) return;
    if (!dateList || dateList.length === 0) return;

    const prevStart = safeISODate(addDaysISO(startISO, -rangeDays));
    const prevEnd = safeISODate(addDaysISO(endISO, -rangeDays));
    if (!prevStart || !prevEnd) return;

    // Load previous week assignments (not into visible state)
    let prevRows = [];
    try {
        const path =
          "/rest/v1/work_roster_assignments" +
          `?select=work_date,crew_id,show_id,is_working,track_id,location_id` +
          `&location_id=eq.${Number(location)}` +
          `&work_date=gte.${prevStart}` +
          `&work_date=lte.${prevEnd}`;

      const rows = await supabaseGet(path, {
        cacheTag: `roster:assign:${location}:${prevStart}:${prevEnd}`,
      });
      prevRows = Array.isArray(rows) ? rows : [];
    } catch {
      prevRows = [];
    }

    let prevShiftRows = [];
    try {
      const shiftPath =
        "/rest/v1/crew_work_shifts" +
        `?select=work_date,crew_id,start_time,end_time,day_description,location_id` +
        `&location_id=eq.${Number(location)}` +
        `&work_date=gte.${prevStart}` +
        `&work_date=lte.${prevEnd}`;
      const rows = await supabaseGet(shiftPath, {
        cacheTag: `roster:shifts:${location}:${prevStart}:${prevEnd}`,
      });
      prevShiftRows = Array.isArray(rows) ? rows : [];
    } catch {
      prevShiftRows = [];
    }

    const prevMap = new Map();
    for (const r of prevRows) {
      const d = safeISODate(r.work_date);
      const cid = Number(r.crew_id);
      if (!d || !Number.isFinite(cid)) continue;
      prevMap.set(keyOf(d, r.show_id, cid), {
        isWorking: !!r.is_working,
        trackId: normalizeTrackId(r.track_id),
        showId: normalizeShowId(r.show_id),
      });
    }

    const prevShiftMap = new Map();
    for (const r of prevShiftRows) {
      const d = safeISODate(r.work_date);
      const cid = Number(r.crew_id);
      if (!d || !Number.isFinite(cid)) continue;
      prevShiftMap.set(shiftKey(d, cid), {
        startTime: r.start_time || null,
        endTime: r.end_time || null,
        dayDescription: normalizeDayDescription(r.day_description),
      });
    }

    // Apply shift +7 into current week
    for (const c of crew) {
      for (let i = 0; i < dateList.length; i++) {
        const curDay = safeISODate(dateList[i]);
        if (!curDay) continue;
        const prevDay = safeISODate(addDaysISO(curDay, -rangeDays));
        if (!prevDay) continue;
        const showList = getShowsForDate(curDay);
        const showsToCopy = showList.length ? showList : [{ id: null }];
        for (const s of showsToCopy) {
          const prevEntry =
            prevMap.get(keyOf(prevDay, s.id ?? null, c.id)) || {
              isWorking: false,
              trackId: null,
            };
          setAssignmentFor(curDay, c.id, s.id ?? null, prevEntry);
        }

        const prevShift = prevShiftMap.get(shiftKey(prevDay, c.id));
        if (prevShift) {
          setShiftFor(
            curDay,
            c.id,
            prevShift.startTime,
            prevShift.endTime,
            prevShift.dayDescription
          );
        }
      }
    }
  }, [
    crew,
    dateList,
    endISO,
    location,
    rangeDays,
    savePaused,
    setAssignmentFor,
    setShiftFor,
    startISO,
    supabaseGet,
    getShowsForDate,
  ]);

  const shiftWeek = useCallback((deltaWeeks) => {
    const dw = Number(deltaWeeks) || 0;
    if (!dw) return;
    clearHistory();
    setStartISO((prev) => addDaysISO(prev, dw * rangeDays));
  }, [clearHistory, rangeDays]);

  const refreshAssignments = useCallback((force = false) => {
    if (!canRun) return;
    if (!startISO || !endISO) return;
    if (force) {
      clearHistory();
      setAssignMap(new Map());
      setDayHoursMap(new Map());
      setWeekHoursMap(new Map());
    }
    loadAssignmentsForRange(startISO, endISO, force ? { bypassCache: true } : {});
    loadShowsForRange(startISO, endISO, force ? { bypassCache: true } : {});
    loadShiftsForRange(startISO, endISO, force ? { bypassCache: true } : {});
    loadWeekHoursForRange(startISO, endISO, force ? { bypassCache: true } : {});
  }, [
    canRun,
    startISO,
    endISO,
    loadAssignmentsForRange,
    loadShowsForRange,
    loadShiftsForRange,
    loadWeekHoursForRange,
    clearHistory,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return {
    // range
    startISO,
    endISO,
    dateList,

    // crew
    crew,
    crewLoading,
    crewError,

    // shows
    showsLoading,
    showsError,
    getShowsForDate,
    createShow,
    updateShow,
    deleteShow,

    // shifts
    shiftLoading,
    shiftError,
    getShift,
    getDayHours,
    getWeekHours,
    setShiftFor,
    setDayDescriptionFor,

    // assignments
    assignLoading,
    assignError,
    isWorking,
    getTrackId,

    // actions
    toggleCell,
    setWorkingFor,
    setTrackFor,
    assignCrewToTrack,
    undo,
    redo,
    clearDay,
    copyPreviousWeek,
    shiftWeek,
    refreshAssignments,

    // saving status
    isSaving,
    savedPulse,
    savePaused,
    saveError,
    retrySaving,
    canUndo,
    canRedo,
    historyApplying,
  };
}
