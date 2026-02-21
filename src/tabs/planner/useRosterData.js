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

function normalizeDayDescription(value) {
  const s = String(value || "").trim();
  return s ? s : null;
}

function normalizeHourNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function keyOf(dateISO, showId, crewId) {
  const sid = normalizeShowId(showId) ?? 0;
  return `${dateISO}|${sid}|${Number(crewId)}`;
}

function shiftKey(dateISO, crewId) {
  return `${dateISO}|${Number(crewId)}`;
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

  const canRun =
    !!location &&
    typeof supabaseGet === "function" &&
    typeof supabasePost === "function";

  const loadCrew = useCallback(async () => {
    if (!canRun) return;
    setCrewLoading(true);
    setCrewError("");

    try {
      const withLeadPath =
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
        rows = await supabaseGet(withLeadPath, {
          cacheTag: `roster:crew:${location}`,
        });
      } catch (firstErr) {
        const msg = String(firstErr?.message || firstErr || "").toLowerCase();
        const missingLeadCol =
          msg.includes("is_department_lead") ||
          msg.includes("42703") ||
          msg.includes("column");
        if (!missingLeadCol) throw firstErr;

        rows = await supabaseGet(legacyPath, {
          cacheTag: `roster:crew:${location}`,
        });
      }
      setCrew(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          ...r,
          is_department_lead: isTruthyFlag(r?.is_department_lead),
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

  useEffect(() => {
    if (!canRun) return;
    loadCrew();
  }, [canRun, loadCrew]);

  useEffect(() => {
    if (!canRun) return;
    loadAssignmentsForRange(startISO, endISO);
    loadShowsForRange(startISO, endISO);
    loadShiftsForRange(startISO, endISO);
  }, [
    canRun,
    loadAssignmentsForRange,
    loadShowsForRange,
    loadShiftsForRange,
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
        totalHours: normalizeHourNumber(entry?.totalHours),
        leadHours: normalizeHourNumber(entry?.leadHours),
        regularHours: normalizeHourNumber(entry?.regularHours),
        regularOvertimeHours: normalizeHourNumber(entry?.regularOvertimeHours),
        leadOvertimeHours: normalizeHourNumber(entry?.leadOvertimeHours),
      };
    },
    [dayHoursMap]
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
              totalHours: normalizeHourNumber(row.total_hours),
              leadHours: normalizeHourNumber(row.lead_hours),
              regularHours: normalizeHourNumber(row.hours),
              regularOvertimeHours: normalizeHourNumber(row.regular_overtime_hours),
              leadOvertimeHours: normalizeHourNumber(row.lead_overtime_hours),
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
    async (dateISO, crewId, startTime, endTime, dayDescription = undefined) => {
      if (!location || typeof supabasePost !== "function") return;
      const d = safeISODate(dateISO);
      if (!d) return;
      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return;

      const current = getShift(d, cid);
      const nextStart = startTime || null;
      const nextEnd = endTime || null;
      const nextDayDescription =
        dayDescription === undefined
          ? normalizeDayDescription(current?.dayDescription)
          : normalizeDayDescription(dayDescription);

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
          return;
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
      } catch (e) {
        setShiftError(String(e?.message || e));
      }
    },
    [location, supabasePost, supabaseDelete, getShift, refreshDayHoursForDate]
  );

  const setDayDescriptionFor = useCallback(
    async (dateISO, crewId, dayDescription) => {
      const current = getShift(dateISO, crewId);
      await setShiftFor(
        dateISO,
        crewId,
        current?.startTime || null,
        current?.endTime || null,
        dayDescription
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

  const allShowsTrackedForCrewOnDay = useCallback(
    (dateISO, crewId, sourceMap) => {
      const d = safeISODate(dateISO);
      if (!d) return false;
      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return false;

      const showsForDay = (showsByDate.get(d) || []).slice(0, 4);
      if (!showsForDay.length) return false;

      for (const show of showsForDay) {
        const entry = sourceMap.get(keyOf(d, show.id, cid));
        if (!entry?.isWorking) return false;
        if (!normalizeTrackId(entry?.trackId)) return false;
      }
      return true;
    },
    [showsByDate]
  );

  const setAssignmentFor = useCallback(
    (dateISO, crewId, showId, next) => {
      if (savePaused) return;

      const d = safeISODate(dateISO);
      if (!d) return;

      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return;

      const lid = Number(location);
      if (!Number.isFinite(lid)) return;

      const sid = normalizeShowId(showId);
      const nextIsWorking = !!next?.isWorking;
      const nextTrackId = nextIsWorking
        ? normalizeTrackId(next?.trackId)
        : null;

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
    },
    [location, savePaused, scheduleSave]
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
    const pending = Array.from(pendingAutoShowsRef.current);
    if (!pending.length) return;
    pendingAutoShowsRef.current.clear();

    for (const key of pending) {
      const [dRaw, crewRaw] = String(key || "").split("|");
      const d = safeISODate(dRaw);
      const cid = Number(crewRaw);
      if (!d || !Number.isFinite(cid)) continue;

      if (!allShowsTrackedForCrewOnDay(d, cid, assignMap)) continue;

      const currentShift = getShift(d, cid);
      if (normalizeDayDescription(currentShift?.dayDescription) === "Shows") continue;

      setShiftFor(
        d,
        cid,
        currentShift?.startTime || null,
        currentShift?.endTime || null,
        "Shows"
      );
    }
  }, [assignMap, allShowsTrackedForCrewOnDay, getShift, setShiftFor]);

  const assignCrewToTrack = useCallback(
    (dateISO, crewId, showId, nextTrackId) => {
      setAssignmentFor(dateISO, crewId, showId, {
        isWorking: true,
        trackId: nextTrackId,
      });
    },
    [setAssignmentFor]
  );

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
    setStartISO((prev) => addDaysISO(prev, dw * rangeDays));
  }, [rangeDays]);

  const refreshAssignments = useCallback((force = false) => {
    if (!canRun) return;
    if (!startISO || !endISO) return;
    if (force) {
      setAssignMap(new Map());
      setDayHoursMap(new Map());
    }
    loadAssignmentsForRange(startISO, endISO, force ? { bypassCache: true } : {});
    loadShowsForRange(startISO, endISO, force ? { bypassCache: true } : {});
    loadShiftsForRange(startISO, endISO, force ? { bypassCache: true } : {});
  }, [
    canRun,
    startISO,
    endISO,
    loadAssignmentsForRange,
    loadShowsForRange,
    loadShiftsForRange,
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
  };
}
