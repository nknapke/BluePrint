// src/hooks/useDataLoaders.js
import { useCallback, useMemo, useRef } from "react";
import { useLocation } from "../context/LocationContext";

export function useDataLoaders({
  supabaseGet,
  safeSet,
  refreshMs = 10000,

  // Locations
  setLocations,
  setLocationsLoading,
  setLocationsError,

  // Crew
  setCrew,
  setCrewLoading,
  setCrewError,

  // Tracks
  setTracks,
  setTracksLoading,
  setTracksError,

  // Trainings
  setTrainings,
  setTrainingsLoading,
  setTrainingsError,

  // Training Groups
  setTrainingGroups,
  setTrainingGroupsLoading,
  setTrainingGroupsError,

  // Requirements
  setRequirements,
  setRequirementsLoading,
  setRequirementsError,

  // Signoffs
  setSignoffs,
  setSignoffsLoading,
  setSignoffsError,

  // Records
  setTrainingRecords,
  setRecordsLoading,
  setRecordsError,
}) {
  const { activeLocationId, setActiveLocationId, cacheTag, withLoc } =
    useLocation();

  const lastFetchRef = useRef({
    locations: 0,
    crew: 0,
    trackDefs: 0,
    trainingDefs: 0,
    trainingGroups: 0,
    requirements: 0,
    signoffs: 0,
    records: 0,
  });

  const shouldFetch = useCallback(
    (key) => {
      const now = Date.now();
      return now - (lastFetchRef.current[key] || 0) > refreshMs;
    },
    [refreshMs]
  );

  const markFetched = useCallback((key) => {
    lastFetchRef.current[key] = Date.now();
  }, []);

  const opts = useMemo(() => ({ cacheTag }), [cacheTag]);

  const loadList = useCallback(
    async ({
      key,
      force = false,
      setLoading,
      setError,
      path,
      mapRow,
      setRows,
      useLocationFilter = true,
      useCache = true,
    }) => {
      if (key && !force && !shouldFetch(key)) return;

      safeSet(() => {
        setLoading(true);
        setError("");
      });

      try {
        const finalPath = useLocationFilter ? withLoc(path) : path;
        const data = await supabaseGet(finalPath, useCache ? opts : undefined);

        safeSet(() => setRows((data || []).map(mapRow)));

        if (key) markFetched(key);
      } catch (e) {
        safeSet(() => setError(String(e.message || e)));
      } finally {
        safeSet(() => setLoading(false));
      }
    },
    [markFetched, opts, safeSet, shouldFetch, supabaseGet, withLoc]
  );

  const loadLocations = useCallback(
    async (force = false) => {
      await loadList({
        key: "locations",
        force,
        setLoading: setLocationsLoading,
        setError: setLocationsError,
        path: "/rest/v1/locations?select=id,code,name,active&order=name.asc",
        mapRow: (l) => l,
        setRows: (rows) => {
          const active = (rows || []).filter((l) => l.active !== false);

          setLocations(active);

          if (!activeLocationId && active[0]?.id != null) {
            const firstId = Number(active[0].id);
            setActiveLocationId(firstId);
            localStorage.setItem("blueprint_location_id", String(firstId));
          }
        },
        useLocationFilter: false,
        useCache: false,
      });
    },
    [
      activeLocationId,
      loadList,
      setActiveLocationId,
      setLocations,
      setLocationsError,
      setLocationsLoading,
    ]
  );

  const loadCrew = useCallback(
    async (force = false) => {
      await loadList({
        key: "crew",
        force,
        setLoading: setCrewLoading,
        setError: setCrewError,
        path: "/rest/v1/crew_roster?select=id,crew_name,home_department,status,location_id&order=crew_name.asc",
        mapRow: (c) => ({
          id: c.id,
          name: c.crew_name,
          dept: c.home_department,
          active: c.status === "Active",
          statusRaw: c.status,
        }),
        setRows: setCrew,
      });
    },
    [loadList, setCrew, setCrewError, setCrewLoading]
  );

  const loadTracks = useCallback(
    async (force = false) => {
      await loadList({
        key: "trackDefs",
        force,
        setLoading: setTracksLoading,
        setError: setTracksError,
        path: "/rest/v1/track_definitions?select=id,local_id,track_name,is_track_active,track_color,location_id&order=local_id.asc",
        mapRow: (t) => ({
          id: t.id,
          localId: t.local_id,
          name: t.track_name,
          active: !!t.is_track_active,
          color: (t.track_color || "").trim(),
        }),
        setRows: setTracks,
      });
    },
    [loadList, setTracks, setTracksError, setTracksLoading]
  );

  const loadTrainingGroups = useCallback(
    async (force = false) => {
      await loadList({
        key: "trainingGroups",
        force,
        setLoading: setTrainingGroupsLoading,
        setError: setTrainingGroupsError,
        path: "/rest/v1/training_groups?select=id,local_id,name,active,sort_order,color,description,location_id&order=sort_order.asc,name.asc",
        mapRow: (g) => ({
          id: g.id,
          localId: g.local_id,
          name: g.name,
          active: g.active !== false,
          sortOrder: g.sort_order,
          color: (g.color || "").trim(),
          description: (g.description || "").trim(),
        }),
        setRows: setTrainingGroups,
      });
    },
    [
      loadList,
      setTrainingGroups,
      setTrainingGroupsError,
      setTrainingGroupsLoading,
    ]
  );

  const loadTrainings = useCallback(
    async (force = false) => {
      await loadList({
        key: "trainingDefs",
        force,
        setLoading: setTrainingsLoading,
        setError: setTrainingsError,
        path: "/rest/v1/training_definitions?select=id,local_id,location_id,training_name,is_training_active,expires_after_weeks,training_group_id&order=local_id.asc",
        mapRow: (t) => ({
          id: t.id,
          localId: t.local_id,
          name: t.training_name,
          active: !!t.is_training_active,
          expiresAfterWeeks:
            t.expires_after_weeks == null
              ? null
              : Number(t.expires_after_weeks),
          trainingGroupId:
            t.training_group_id == null ? null : Number(t.training_group_id),
        }),
        setRows: setTrainings,
      });
    },
    [loadList, setTrainings, setTrainingsError, setTrainingsLoading]
  );

  const loadRequirements = useCallback(
    async (force = false) => {
      await loadList({
        key: "requirements",
        force,
        setLoading: setRequirementsLoading,
        setError: setRequirementsError,
        path: "/rest/v1/track_training_requirements?select=id,track_id,training_id,is_requirement_active,location_id&order=track_id.asc,training_id.asc",
        mapRow: (r) => ({
          id: r.id,
          trackId: r.track_id,
          trainingId: r.training_id,
          active: r.is_requirement_active,
        }),
        setRows: setRequirements,
      });
    },
    [loadList, setRequirements, setRequirementsError, setRequirementsLoading]
  );

  const loadSignoffs = useCallback(
    async (force = false) => {
      await loadList({
        key: "signoffs",
        force,
        setLoading: setSignoffsLoading,
        setError: setSignoffsError,
        path: "/rest/v1/crew_track_signoffs?select=id,crew_id,track_id,signoff_status,is_signoff_active,location_id&order=crew_id.asc,track_id.asc",
        mapRow: (s) => ({
          id: s.id,
          crewId: s.crew_id,
          trackId: s.track_id,
          status: s.signoff_status,
          active: s.is_signoff_active,
        }),
        setRows: setSignoffs,
      });
    },
    [loadList, setSignoffs, setSignoffsError, setSignoffsLoading]
  );

  const loadTrainingRecords = useCallback(
    async (force = false) => {
      await loadList({
        key: "records",
        force,
        setLoading: setRecordsLoading,
        setError: setRecordsError,
        path: "/rest/v1/v_training_dashboard_with_signer?select=id,crew_id,track_id,training_id,is_record_active,last_completed,training_status,due_date,days_until_due,days_overdue,crew_name,home_department,crew_status,track_name,training_name,last_signed_off_by,last_signed_off_on,location_id&order=crew_name.asc,track_name.asc,training_name.asc",
        mapRow: (r) => ({
          id: r.id,
          locationId: r.location_id,
          crewId: r.crew_id,
          trackId: r.track_id,
          trainingId: r.training_id,
          active: !!r.is_record_active,
          lastCompleted: r.last_completed,
          status: r.training_status,
          dueDate: r.due_date,
          daysUntilDue: r.days_until_due,
          daysOverdue: r.days_overdue,
          crewName: r.crew_name,
          homeDepartment: r.home_department,
          trackName: r.track_name,
          trainingName: r.training_name,
          lastSignedOffBy: r.last_signed_off_by,
          lastSignedOffOn: r.last_signed_off_on,
        }),
        setRows: setTrainingRecords,
      });
    },
    [loadList, setRecordsError, setRecordsLoading, setTrainingRecords]
  );

  return {
    loadLocations,
    loadCrew,
    loadTracks,
    loadTrainings,
    loadTrainingGroups,
    loadRequirements,
    loadSignoffs,
    loadTrainingRecords,
  };
}
