// src/tabs/planner/useRosterData.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function iso(d) {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeISODate(x) {
  const d = String(x || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return d;
}

function addDays(dateISO, n) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
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

  const [startISO, setStartISO] = useState(() => {
    const today = new Date();
    return iso(today);
  });

  const endISO = useMemo(
    () => addDays(startISO, Number(days) - 1),
    [startISO, days]
  );
  const dateList = useMemo(() => {
    const n = Math.max(1, Number(days) || 7);
    return Array.from({ length: n }, (_, i) => addDays(startISO, i));
  }, [startISO, days]);

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
  const dirtyRef = useRef(new Map()); // key -> { location_id, work_date, crew_id, is_working }
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
          `?select=id,location_id,work_date,crew_id,is_working` +
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
          next.set(keyOf(d, cid), !!r.is_working);
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

  const isWorking = useCallback(
    (dateISO, crewId) => {
      const d = safeISODate(dateISO);
      if (!d) return false;
      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return false;
      const k = keyOf(d, cid);
      return !!assignMap.get(k);
    },
    [assignMap]
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

  const setWorkingFor = useCallback(
    (dateISO, crewId, nextVal) => {
      if (savePaused) return;

      const d = safeISODate(dateISO);
      if (!d) return;

      const cid = Number(crewId);
      if (!Number.isFinite(cid)) return;

      const lid = Number(location);
      if (!Number.isFinite(lid)) return;

      const k = keyOf(d, cid);
      const v = !!nextVal;

      setAssignMap((prev) => {
        const m = new Map(prev);
        m.set(k, v);
        return m;
      });

      dirtyRef.current.set(k, {
        location_id: lid,
        work_date: d,
        crew_id: cid,
        is_working: v,
      });

      scheduleSave();
    },
    [location, savePaused, scheduleSave]
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

    const prevStart = safeISODate(addDays(startISO, -7));
    const prevEnd = safeISODate(addDays(endISO, -7));
    if (!prevStart || !prevEnd) return;

    // Load previous week assignments (not into visible state)
    let prevRows = [];
    try {
      const path =
        "/rest/v1/work_roster_assignments" +
        `?select=work_date,crew_id,is_working,location_id` +
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
      prevMap.set(keyOf(d, cid), !!r.is_working);
    }

    // Apply shift +7 into current week
    for (const c of crew) {
      for (let i = 0; i < dateList.length; i++) {
        const curDay = safeISODate(dateList[i]);
        if (!curDay) continue;
        const prevDay = safeISODate(addDays(curDay, -7));
        if (!prevDay) continue;
        const v = !!prevMap.get(keyOf(prevDay, c.id));
        setWorkingFor(curDay, c.id, v);
      }
    }
  }, [
    crew,
    dateList,
    endISO,
    location,
    savePaused,
    setWorkingFor,
    startISO,
    supabaseGet,
  ]);

  const shiftWeek = useCallback((deltaWeeks) => {
    const dw = Number(deltaWeeks) || 0;
    if (!dw) return;
    setStartISO((prev) => addDays(prev, dw * 7));
  }, []);

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

    // actions
    toggleCell,
    setWorkingFor,
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
