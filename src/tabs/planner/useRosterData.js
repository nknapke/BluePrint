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

function keyOf(dateISO, crewId) {
  return `${dateISO}|${Number(crewId)}`;
}

export default function useRosterData({
  locId,
  locationId,
  supabaseGet,
  supabasePost,
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
  const dirtyRef = useRef(new Map()); // key -> { location_id, work_date, crew_id, is_working, track_id }
  const saveTimerRef = useRef(null);

  const canRun =
    !!location &&
    typeof supabaseGet === "function" &&
    typeof supabasePost === "function";

  const loadCrew = useCallback(async () => {
    if (!canRun) return;
    setCrewLoading(true);
    setCrewError("");

    try {
      const path =
        "/rest/v1/crew_roster" +
        `?select=id,crew_name,home_department,status,location_id` +
        `&location_id=eq.${Number(location)}` +
        `&status=eq.Active` +
        `&order=crew_name.asc`;

      const rows = await supabaseGet(path, {
        cacheTag: `roster:crew:${location}`,
      });
      setCrew(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setCrewError(String(e?.message || e));
      setCrew([]);
    } finally {
      setCrewLoading(false);
    }
  }, [canRun, location, supabaseGet]);

  const loadAssignmentsForRange = useCallback(
    async (rangeStartISO, rangeEndISO) => {
      if (!canRun) return;

      const rs = safeISODate(rangeStartISO);
      const re = safeISODate(rangeEndISO);
      if (!rs || !re) return;

      setAssignLoading(true);
      setAssignError("");

      try {
        const path =
          "/rest/v1/work_roster_assignments" +
          `?select=id,location_id,work_date,crew_id,is_working,track_id` +
          `&location_id=eq.${Number(location)}` +
          `&work_date=gte.${rs}` +
          `&work_date=lte.${re}`;

        const rows = await supabaseGet(path, {
          cacheTag: `roster:assign:${location}:${rs}:${re}`,
        });

        const next = new Map();
        for (const r of Array.isArray(rows) ? rows : []) {
          const d = safeISODate(r.work_date);
          const cid = Number(r.crew_id);
          if (!d || !Number.isFinite(cid)) continue;
          next.set(keyOf(d, cid), {
            isWorking: !!r.is_working,
            trackId: normalizeTrackId(r.track_id),
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

  useEffect(() => {
    if (!canRun) return;
    loadCrew();
  }, [canRun, loadCrew]);

  useEffect(() => {
    if (!canRun) return;
    loadAssignmentsForRange(startISO, endISO);
  }, [canRun, loadAssignmentsForRange, startISO, endISO]);

  const getAssignment = useCallback(
    (dateISO, crewId) => {
      const d = safeISODate(dateISO);
      if (!d) return { isWorking: false, trackId: null };
      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return { isWorking: false, trackId: null };
      const k = keyOf(d, cid);
      const entry = assignMap.get(k);
      return {
        isWorking: !!entry?.isWorking,
        trackId: normalizeTrackId(entry?.trackId),
      };
    },
    [assignMap]
  );

  const isWorking = useCallback(
    (dateISO, crewId) => getAssignment(dateISO, crewId).isWorking,
    [getAssignment]
  );

  const getTrackId = useCallback(
    (dateISO, crewId) => getAssignment(dateISO, crewId).trackId,
    [getAssignment]
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
        "/rest/v1/work_roster_assignments?on_conflict=location_id,work_date,crew_id",
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

  const setAssignmentFor = useCallback(
    (dateISO, crewId, next) => {
      if (savePaused) return;

      const d = safeISODate(dateISO);
      if (!d) return;

      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return;

      const lid = Number(location);
      if (!Number.isFinite(lid)) return;

      const nextIsWorking = !!next?.isWorking;
      const nextTrackId = nextIsWorking
        ? normalizeTrackId(next?.trackId)
        : null;

      const k = keyOf(d, cid);

      setAssignMap((prev) => {
        const m = new Map(prev);
        m.set(k, { isWorking: nextIsWorking, trackId: nextTrackId });
        return m;
      });

      dirtyRef.current.set(k, {
        location_id: lid,
        work_date: d,
        crew_id: cid,
        is_working: nextIsWorking,
        track_id: nextTrackId,
      });

      scheduleSave();
    },
    [location, savePaused, scheduleSave]
  );

  const setWorkingFor = useCallback(
    (dateISO, crewId, nextVal) => {
      const current = getAssignment(dateISO, crewId);
      const nextIsWorking = !!nextVal;
      setAssignmentFor(dateISO, crewId, {
        isWorking: nextIsWorking,
        trackId: nextIsWorking ? current.trackId : null,
      });
    },
    [getAssignment, setAssignmentFor]
  );

  const setTrackFor = useCallback(
    (dateISO, crewId, nextTrackId) => {
      const current = getAssignment(dateISO, crewId);
      if (!current.isWorking) return;
      setAssignmentFor(dateISO, crewId, {
        isWorking: true,
        trackId: nextTrackId,
      });
    },
    [getAssignment, setAssignmentFor]
  );

  const toggleCell = useCallback(
    (dateISO, crewId) => {
      if (savePaused) return;

      const d = safeISODate(dateISO);
      if (!d) return;

      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return;

      const current = isWorking(d, cid);
      setWorkingFor(d, cid, !current);
    },
    [isWorking, savePaused, setWorkingFor]
  );

  const clearDay = useCallback(
    (dateISO) => {
      if (savePaused) return;

      const d = safeISODate(dateISO);
      if (!d) return;

      for (const c of crew) {
        setWorkingFor(d, c.id, false);
      }
    },
    [crew, savePaused, setWorkingFor]
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
          `?select=work_date,crew_id,is_working,track_id,location_id` +
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

    const prevMap = new Map();
    for (const r of prevRows) {
      const d = safeISODate(r.work_date);
      const cid = Number(r.crew_id);
      if (!d || !Number.isFinite(cid)) continue;
      prevMap.set(keyOf(d, cid), {
        isWorking: !!r.is_working,
        trackId: normalizeTrackId(r.track_id),
      });
    }

    // Apply shift +7 into current week
    for (const c of crew) {
      for (let i = 0; i < dateList.length; i++) {
        const curDay = safeISODate(dateList[i]);
        if (!curDay) continue;
        const prevDay = safeISODate(addDaysISO(curDay, -rangeDays));
        if (!prevDay) continue;
        const prevEntry =
          prevMap.get(keyOf(prevDay, c.id)) || {
            isWorking: false,
            trackId: null,
          };
        setAssignmentFor(curDay, c.id, prevEntry);
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
    startISO,
    supabaseGet,
  ]);

  const shiftWeek = useCallback((deltaWeeks) => {
    const dw = Number(deltaWeeks) || 0;
    if (!dw) return;
    setStartISO((prev) => addDaysISO(prev, dw * rangeDays));
  }, [rangeDays]);

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

    // assignments
    assignLoading,
    assignError,
    isWorking,
    getTrackId,

    // actions
    toggleCell,
    setWorkingFor,
    setTrackFor,
    clearDay,
    copyPreviousWeek,
    shiftWeek,

    // saving status
    isSaving,
    savedPulse,
    savePaused,
    saveError,
    retrySaving,
  };
}
