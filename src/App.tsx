// App.tsx
import blueprintIcon from "./assets/blueprint-icon.png";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { createSupabaseRestClient } from "./lib/supabaseRest";
import { createStyles } from "./components/ui/Styles";

import {
  DEPARTMENTS,
  LOCATION_SCOPED_CACHE_KEYS,
  REFRESH_MS,
  TABS,
  type TabId,
} from "./app/constants";
import { AppHeader } from "./app/AppHeader";
import { AppModals } from "./app/AppModals";
import { useAppState } from "./app/useAppState";
import { useAppDerived } from "./app/useAppDerived";

import { useLocation } from "./context/LocationContext";
import { useDataLoaders } from "./hooks/useDataLoaders";
import { useHistoryModal } from "./hooks/useHistoryModal";
import { useMarkComplete } from "./hooks/useMarkComplete";
import type {
  Crew,
  Requirement,
  Signoff,
  Track,
  Training,
  TrainingGroup,
  TrainingRecord,
} from "./types/domain";

import CrewTab from "./tabs/CrewTab";
import TracksTab from "./tabs/TracksTab";
import TrainingsTab from "./tabs/TrainingsTab";
import SignoffsTab from "./tabs/SignoffsTab";
import RequirementsTab from "./tabs/RequirementsTab";
import RecordsTab from "./tabs/RecordsTab";
import PlannerTab from "./tabs/PlannerTab";

const SUPABASE_URL = "https://aoybyypndyvuxxjymkyf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveWJ5eXBuZHl2dXh4anlta3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDYyOTYsImV4cCI6MjA4NDMyMjI5Nn0.wfDbPsP5ItA4mn572ZtZeqjRN2X6bmbpRzUjVrnC0m0";

function getErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function App() {
  const {
    supabaseGet,
    supabasePatch,
    supabasePost,
    supabaseDelete,
    invalidateGetCache,
  } = createSupabaseRestClient({
    supabaseUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  });

  const S = useMemo(() => createStyles(), []);

  useEffect(() => {
    document.title = "BluePrint";
  }, []);

  // Prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback((setter: () => void) => {
    if (!isMountedRef.current) return;
    setter();
  }, []);

  const invalidateMany = useCallback(
    (paths: readonly string[]) => {
      paths.forEach((p) => invalidateGetCache(p));
    },
    [invalidateGetCache]
  );

  const {
    activeTab,
    setActiveTab,

    locations,
    setLocations,
    locationsLoading,
    setLocationsLoading,
    locationsError,
    setLocationsError,

    crew,
    setCrew,
    crewLoading,
    setCrewLoading,
    crewError,
    setCrewError,

    tracks,
    setTracks,
    tracksLoading,
    setTracksLoading,
    tracksError,
    setTracksError,

    trainings,
    setTrainings,
    trainingsLoading,
    setTrainingsLoading,
    trainingsError,
    setTrainingsError,

    trainingGroups,
    setTrainingGroups,
    trainingGroupsLoading,
    setTrainingGroupsLoading,
    trainingGroupsError,
    setTrainingGroupsError,

    requirements,
    setRequirements,
    requirementsLoading,
    setRequirementsLoading,
    requirementsError,
    setRequirementsError,

    signoffs,
    setSignoffs,
    signoffsLoading,
    setSignoffsLoading,
    signoffsError,
    setSignoffsError,

    trainingRecords,
    setTrainingRecords,
    recordsLoading,
    setRecordsLoading,
    recordsError,
    setRecordsError,

    signoffsCrewId,
    setSignoffsCrewId,
    signoffsTrackId,
    setSignoffsTrackId,
    signoffsStatusFilter,
    setSignoffsStatusFilter,

    crewNameFilter,
    setCrewNameFilter,
    crewDeptFilter,
    setCrewDeptFilter,
    crewStatusFilter,
    setCrewStatusFilter,

    recordsCrewId,
    setRecordsCrewId,
    recordsTrackId,
    setRecordsTrackId,
    recordsTrainingId,
    setRecordsTrainingId,

    editingCrewId,
    setEditingCrewId,
    editCrewName,
    setEditCrewName,
    editCrewDept,
    setEditCrewDept,
    editCrewStatus,
    setEditCrewStatus,
    editCrewSaving,
    setEditCrewSaving,

    editingTrainingId,
    setEditingTrainingId,
    editTrainingName,
    setEditTrainingName,
    editTrainingActive,
    setEditTrainingActive,
    editTrainingSaving,
    setEditTrainingSaving,
    editTrainingExpiryWeeks,
    setEditTrainingExpiryWeeks,
    editTrainingGroupId,
    setEditTrainingGroupId,

    editingTrackId,
    setEditingTrackId,
    editTrackName,
    setEditTrackName,
    editTrackActive,
    setEditTrackActive,
    editTrackSaving,
    setEditTrackSaving,

    reqNewTrackId,
    setReqNewTrackId,
    reqNewTrainingId,
    setReqNewTrainingId,
    reqNewActive,
    setReqNewActive,
    reqAdding,
    setReqAdding,

    requirementsViewMode,
    setRequirementsViewMode,
    expandedTrainingIds,
    setExpandedTrainingIds,
    expandedReqTrackIds,
    setExpandedReqTrackIds,

    addTrainingOpen,
    setAddTrainingOpen,
    newTrainingId,
    setNewTrainingId,
    newTrainingName,
    setNewTrainingName,
    newTrainingActive,
    setNewTrainingActive,
    newTrainingExpiryMode,
    setNewTrainingExpiryMode,
    newTrainingExpiryWeeks,
    setNewTrainingExpiryWeeks,
    newTrainingGroupId,
    setNewTrainingGroupId,
    addingTraining,
    setAddingTraining,

    addTrackOpen,
    setAddTrackOpen,
    newTrackId,
    setNewTrackId,
    newTrackName,
    setNewTrackName,
    newTrackActive,
    setNewTrackActive,
    addingTrack,
    setAddingTrack,

    addCrewOpen,
    setAddCrewOpen,
    newCrewName,
    setNewCrewName,
    newCrewDept,
    setNewCrewDept,
    newCrewStatus,
    setNewCrewStatus,
    addingCrew,
    setAddingCrew,
  } = useAppState();

  // LocationContext (global)
  const { activeLocationId, setActiveLocationId } = useLocation();

  // Add location scoping helpers (used in a couple manual queries)
  const withLoc = useCallback(
    (path: string) => {
      if (!activeLocationId) return path;
      const join = path.includes("?") ? "&" : "?";
      return `${path}${join}location_id=eq.${activeLocationId}`;
    },
    [activeLocationId]
  );

  const cacheTag = useMemo(
    () => `loc:${activeLocationId || "none"}`,
    [activeLocationId]
  );

  const supabaseRpc = useCallback(
    async (fnName: string, payload: any) => {
      return await supabasePost(`/rest/v1/rpc/${fnName}`, payload);
    },
    [supabasePost]
  );

  // ---- Loaders (now read location from LocationContext internally) ----
  const {
    loadLocations,
    loadCrew,
    loadTracks,
    loadTrainings,
    loadTrainingGroups,
    loadRequirements,
    loadSignoffs,
    loadTrainingRecords,
  } = useDataLoaders({
    supabaseGet,
    safeSet,
    refreshMs: REFRESH_MS,

    setLocations,
    setLocationsLoading,
    setLocationsError,

    setCrew,
    setCrewLoading,
    setCrewError,

    setTracks,
    setTracksLoading,
    setTracksError,

    setTrainings,
    setTrainingsLoading,
    setTrainingsError,

    setTrainingGroups,
    setTrainingGroupsLoading,
    setTrainingGroupsError,

    setRequirements,
    setRequirementsLoading,
    setRequirementsError,

    setSignoffs,
    setSignoffsLoading,
    setSignoffsError,

    setTrainingRecords,
    setRecordsLoading,
    setRecordsError,
  });

  // ---- History modal (now reads location from LocationContext internally) ----
  const {
    historyOpen,
    historyBusy,
    historyError,
    historyRows,
    historyContext,
    openHistory,
    closeHistory,
    deleteHistoryRow,
    refreshHistory,
  } = useHistoryModal({
    supabaseGet,
    supabaseDelete,
  });

  // ---- Mark Complete (now reads location from LocationContext internally) ----
  const {
    markCompleteOpen,
    markCompleteRow,
    markCompleteDate,
    setMarkCompleteDate,
    markCompleteBy,
    setMarkCompleteBy,
    markCompleteNotes,
    setMarkCompleteNotes,
    markCompleteSaving,
    openMarkComplete,
    closeMarkComplete,
    confirmMarkComplete,
  } = useMarkComplete({
    supabasePost,
    supabasePatch,
    invalidateMany,
    loadTrainingRecords,
  });

  function openAddTraining() {
    setNewTrainingId("");
    setNewTrainingName("");
    setNewTrainingActive("TRUE");
    setNewTrainingExpiryMode("NEVER");
    setNewTrainingExpiryWeeks("");
    setNewTrainingGroupId("");
    setAddTrainingOpen(true);
  }

  function closeAddTraining() {
    if (addingTraining) return;
    setAddTrainingOpen(false);
  }

  async function confirmAddTraining() {
    const idRaw = (newTrainingId || "").trim();
    if (!idRaw) {
      alert("Training ID is required.");
      return;
    }
    const idNum = Number(idRaw);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      alert("Training ID must be a positive number.");
      return;
    }

    const name = (newTrainingName || "").trim();
    if (!name) {
      alert("Training name is required.");
      return;
    }

    const is_training_active =
      (newTrainingActive || "TRUE").toUpperCase() === "TRUE";

    let expires_after_weeks = 0; // Never Expires
    if (newTrainingExpiryMode === "WEEKS") {
      const raw = (newTrainingExpiryWeeks || "").trim();
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 1) {
        alert(
          'Expire In must be a positive number of weeks, or choose "Never Expires".'
        );
        return;
      }
      expires_after_weeks = Math.floor(num);
    }

    const groupRaw = String(newTrainingGroupId || "").trim();
    const training_group_id =
      groupRaw === ""
        ? null
        : Number.isFinite(Number(groupRaw))
        ? Number(groupRaw)
        : null;
    if (groupRaw !== "" && training_group_id == null) {
      alert("Training group must be a valid number.");
      return;
    }

    const exists = trainings.some((t) => Number(t.localId) === idNum);
    if (exists) {
      alert("That Training ID already exists.");
      return;
    }

    try {
      setAddingTraining(true);
      setTrainingsError("");

      await supabasePost("/rest/v1/training_definitions", {
        local_id: idNum,
        location_id: activeLocationId,
        training_name: name,
        is_training_active,
        expires_after_weeks,
        training_group_id,
      });

      invalidateMany([
        "/rest/v1/training_definitions",
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([
        loadTrainings(true),
        loadRequirements(true),
        loadTrainingRecords(true),
      ]);

      setAddTrainingOpen(false);
    } catch (e) {
      alert("Failed to add training:\n" + getErrorMessage(e));
      setTrainingsError(getErrorMessage(e));
    } finally {
      setAddingTraining(false);
    }
  }

  function openAddTrack() {
    setNewTrackId("");
    setNewTrackName("");
    setNewTrackActive("TRUE");
    setAddTrackOpen(true);
  }

  function closeAddTrack() {
    if (addingTrack) return;
    setAddTrackOpen(false);
  }

  // Prevent double initial load in React 18 dev StrictMode
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    (async () => {
      await Promise.all([
        loadLocations(true),
        loadCrew(true),
        loadTracks(true),
        loadTrainings(true),
        loadTrainingGroups(true),
        loadRequirements(true),
        loadSignoffs(true),
        loadTrainingRecords(true),
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (activeTab === "crew") await loadCrew(true);
      if (activeTab === "trackDefs") await loadTracks(true);

      if (activeTab === "trainingDefs") {
        await Promise.all([loadTrainings(true), loadTrainingGroups(true)]);
      }

      if (activeTab === "signoffs") {
        await Promise.all([
          loadCrew(true),
          loadTracks(true),
          loadSignoffs(true),
        ]);
      }

      if (activeTab === "requirements") {
        await Promise.all([
          loadTracks(true),
          loadTrainings(true),
          loadRequirements(true),
        ]);
      }

      if (activeTab === "records") {
        await Promise.all([
          loadCrew(true),
          loadTracks(true),
          loadTrainings(true),
          loadTrainingRecords(true),
        ]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!activeLocationId) return;

    // clear location-scoped state immediately to avoid flashes
    setCrew([]);
    setTracks([]);
    setTrainings([]);
    setTrainingGroups([]);
    setRequirements([]);
    setSignoffs([]);
    setTrainingRecords([]);

    // reset location-dependent filters
    setSignoffsCrewId("ALL");
    setSignoffsTrackId("ALL");
    setRecordsCrewId("ALL");
    setRecordsTrackId("ALL");
    setRecordsTrainingId("ALL");
    setCrewNameFilter("ALL");

    invalidateMany(LOCATION_SCOPED_CACHE_KEYS);

    (async () => {
      await Promise.all([
        loadCrew(true),
        loadTracks(true),
        loadTrainings(true),
        loadTrainingGroups(true),
        loadRequirements(true),
        loadSignoffs(true),
        loadTrainingRecords(true),
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocationId]);

  // Crew actions
  function openAddCrew() {
    setNewCrewName("");
    setNewCrewDept(DEPARTMENTS[0] || "");
    setNewCrewStatus("Active");
    setAddCrewOpen(true);
  }

  function closeAddCrew() {
    if (addingCrew) return;
    setAddCrewOpen(false);
  }

  async function confirmAddCrewMember() {
    const crew_name = (newCrewName || "").trim();
    if (!crew_name) {
      alert("Crew name is required.");
      return;
    }
    const home_department = (newCrewDept || "").trim();
    if (!home_department) {
      alert("Department is required.");
      return;
    }
    const status = newCrewStatus === "Not Active" ? "Not Active" : "Active";

    try {
      setAddingCrew(true);
      setCrewError("");

      await supabasePost("/rest/v1/crew_roster", {
        crew_name,
        home_department,
        status,
        location_id: activeLocationId,
      });

      invalidateMany(["/rest/v1/crew_roster"]);
      await loadCrew(true);
      setAddCrewOpen(false);
    } catch (e) {
      alert("Failed to add crew member:\n" + getErrorMessage(e));
      setCrewError(getErrorMessage(e));
    } finally {
      setAddingCrew(false);
    }
  }

  async function deleteCrewMember(crewRow: Crew) {
    const crewId = crewRow.id;
    const crewName = crewRow.name || `ID ${crewId}`;

    const ok = window.confirm(
      `Delete ${crewName}?\n\nThis will also remove their signoffs and training records.`
    );
    if (!ok) return;

    try {
      setCrewLoading(true);
      setCrewError("");

      await supabaseDelete(`/rest/v1/crew_roster?id=eq.${crewId}`);

      invalidateMany([
        "/rest/v1/crew_roster",
        "/rest/v1/crew_track_signoffs",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([
        loadCrew(true),
        loadSignoffs(true),
        loadTrainingRecords(true),
      ]);

      if (String(signoffsCrewId) === String(crewId)) setSignoffsCrewId("ALL");
      if (String(crewNameFilter) === String(crewId)) setCrewNameFilter("ALL");
      if (String(recordsCrewId) === String(crewId)) setRecordsCrewId("ALL");
      if (editingCrewId === crewId) setEditingCrewId(null);
    } catch (e) {
      alert("Failed to delete crew member:\n" + getErrorMessage(e));
      setCrewError(getErrorMessage(e));
      setCrewLoading(false);
    }
  }

  function startEditCrew(c: Crew) {
    setEditingCrewId(c.id);
    setEditCrewName(c.name || "");
    setEditCrewDept(c.dept || "");
    setEditCrewStatus(c.active ? "Active" : "Not Active");
  }

  function cancelEditCrew() {
    setEditingCrewId(null);
    setEditCrewName("");
    setEditCrewDept("");
    setEditCrewStatus("Active");
  }

  async function saveEditCrew(c: Crew) {
    const newName = (editCrewName || "").trim();
    if (!newName) {
      alert("Name cannot be blank.");
      return;
    }
    const newDept = (editCrewDept || "").trim();
    const newStatus = editCrewStatus === "Not Active" ? "Not Active" : "Active";

    setEditCrewSaving(true);
    try {
      await supabasePatch(`/rest/v1/crew_roster?id=eq.${c.id}`, {
        crew_name: newName,
        home_department: newDept,
        status: newStatus,
      });

      invalidateMany([
        "/rest/v1/crew_roster",
        "/rest/v1/crew_track_signoffs",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([
        loadCrew(true),
        loadSignoffs(true),
        loadTrainingRecords(true),
      ]);
      cancelEditCrew();
    } catch (e) {
      alert("Failed to save crew member:\n" + getErrorMessage(e));
    } finally {
      setEditCrewSaving(false);
    }
  }

  // Training group create
  async function createTrainingGroup(name: string) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("Group name cannot be blank.");

    await supabasePost("/rest/v1/training_groups", {
      name: clean,
      active: true,
      sort_order: 100,
      location_id: activeLocationId,
    });

    invalidateMany(["/rest/v1/training_groups"]);
    await loadTrainingGroups(true);

    const found = (trainingGroups || []).find(
      (g: TrainingGroup) =>
        String(g.name || "").toLowerCase() === clean.toLowerCase()
    );
    if (found?.id != null) return found.id;

    const fresh = await supabaseGet(
      withLoc(
        "/rest/v1/training_groups?select=id,name,location_id&order=sort_order.asc,name.asc"
      ),
      { cacheTag }
    );

    const freshFound = (fresh || []).find(
      (g: TrainingGroup) =>
        String(g.name || "").toLowerCase() === clean.toLowerCase()
    );
    return freshFound?.id ?? null;
  }

  async function updateTrainingGroup(
    id: number,
    patch: { name?: string; sort_order?: number | null }
  ) {
    const payload: Record<string, unknown> = {};
    if (patch.name != null) payload.name = patch.name;
    if ("sort_order" in patch) payload.sort_order = patch.sort_order;

    if (Object.keys(payload).length === 0) return;

    await supabasePatch(`/rest/v1/training_groups?id=eq.${id}`, payload);

    invalidateMany(["/rest/v1/training_groups"]);
    await loadTrainingGroups(true);
  }

  async function deleteTrainingGroup(group: TrainingGroup) {
    const ok = window.confirm(
      `Delete training group?\n\n${group.name || "(Unnamed)"}\n\nTrainings in this group will be moved to Ungrouped.`
    );
    if (!ok) return;

    try {
      await supabasePatch(
        `/rest/v1/training_definitions?training_group_id=eq.${group.id}`,
        { training_group_id: null },
        { prefer: "return=minimal" }
      );

      await supabaseDelete(`/rest/v1/training_groups?id=eq.${group.id}`);

      invalidateMany([
        "/rest/v1/training_groups",
        "/rest/v1/training_definitions",
      ]);

      await Promise.all([loadTrainingGroups(true), loadTrainings(true)]);
    } catch (e) {
      alert("Failed to delete group:\n" + getErrorMessage(e));
    }
  }

  async function deleteTrainingDefinition(t: Training) {
    const ok = window.confirm(
      `Delete training?\n\nID: ${t.id}\nName: ${t.name}\n\nThis may also remove related requirements and training records if your database is set to cascade.`
    );
    if (!ok) return;

    try {
      setTrainingsLoading(true);
      setTrainingsError("");

      await supabaseDelete(`/rest/v1/training_definitions?id=eq.${t.id}`);

      invalidateMany([
        "/rest/v1/training_definitions",
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([
        loadTrainings(true),
        loadRequirements(true),
        loadTrainingRecords(true),
      ]);

      if (String(recordsTrainingId) === String(t.id))
        setRecordsTrainingId("ALL");
      if (editingTrainingId === t.id) cancelEditTraining();
    } catch (e) {
      alert("Failed to delete training:\n" + getErrorMessage(e));
      setTrainingsError(getErrorMessage(e));
      setTrainingsLoading(false);
    }
  }

  function startEditTraining(t: Training) {
    setEditingTrainingId(t.id);
    setEditTrainingName(t.name || "");
    setEditTrainingActive(t.active ? "TRUE" : "FALSE");
    const v = t.expiresAfterWeeks;
    setEditTrainingExpiryWeeks(v == null || Number(v) === 0 ? "" : String(v));
    setEditTrainingGroupId(
      t.trainingGroupId == null ? "" : String(t.trainingGroupId)
    );
  }

  function cancelEditTraining() {
    setEditingTrainingId(null);
    setEditTrainingName("");
    setEditTrainingActive("TRUE");
    setEditTrainingExpiryWeeks("");
    setEditTrainingGroupId("");
  }

  async function saveEditTraining(t: Training) {
    const newName = (editTrainingName || "").trim();
    if (!newName) {
      alert("Training name cannot be blank.");
      return;
    }

    const newActiveBool =
      (editTrainingActive || "TRUE").toUpperCase() === "TRUE";

    const expRaw = (editTrainingExpiryWeeks || "").trim();
    let expires_after_weeks = 0;
    if (expRaw !== "") {
      const expNum = Number(expRaw);
      if (!Number.isFinite(expNum) || expNum < 1) {
        alert(
          'Expires After (weeks) must be blank for "Never Expires" or a positive number.'
        );
        return;
      }
      expires_after_weeks = Math.floor(expNum);
    }

    const groupRaw = String(editTrainingGroupId || "").trim();
    const training_group_id =
      groupRaw === ""
        ? null
        : Number.isFinite(Number(groupRaw))
        ? Number(groupRaw)
        : null;

    setEditTrainingSaving(true);
    try {
      await supabasePatch(`/rest/v1/training_definitions?id=eq.${t.id}`, {
        training_name: newName,
        is_training_active: newActiveBool,
        expires_after_weeks,
        training_group_id,
      });

      invalidateMany([
        "/rest/v1/training_definitions",
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([
        loadTrainings(true),
        loadRequirements(true),
        loadTrainingRecords(true),
      ]);

      if (String(recordsTrainingId) === String(t.id))
        setRecordsTrainingId("ALL");

      cancelEditTraining();
    } catch (e) {
      alert("Failed to save training:\n" + getErrorMessage(e));
    } finally {
      setEditTrainingSaving(false);
    }
  }

  // Tracks actions
  async function confirmAddTrack() {
    const idRaw = (newTrackId || "").trim();
    if (!idRaw) {
      alert("Track ID is required.");
      return;
    }
    const idNum = Number(idRaw);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      alert("Track ID must be a positive number.");
      return;
    }

    const name = (newTrackName || "").trim();
    if (!name) {
      alert("Track name is required.");
      return;
    }

    const is_track_active = (newTrackActive || "TRUE").toUpperCase() === "TRUE";

    const exists = tracks.some((t) => Number(t.localId) === idNum);
    if (exists) {
      alert("That Track ID already exists.");
      return;
    }

    try {
      setAddingTrack(true);
      setTracksError("");

      await supabasePost("/rest/v1/track_definitions", {
        local_id: idNum,
        location_id: activeLocationId,
        track_name: name,
        is_track_active,
      });

      invalidateMany([
        "/rest/v1/track_definitions",
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_track_signoffs",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([
        loadTracks(true),
        loadRequirements(true),
        loadSignoffs(true),
        loadTrainingRecords(true),
      ]);

      setAddTrackOpen(false);
    } catch (e) {
      alert("Failed to add track:\n" + getErrorMessage(e));
      setTracksError(getErrorMessage(e));
    } finally {
      setAddingTrack(false);
    }
  }

  function startEditTrack(t: Track) {
    setEditingTrackId(t.id);
    setEditTrackName(t.name || "");
    setEditTrackActive(t.active ? "TRUE" : "FALSE");
  }

  function cancelEditTrack() {
    setEditingTrackId(null);
    setEditTrackName("");
    setEditTrackActive("TRUE");
  }

  async function saveEditTrack(t: Track) {
    const newName = (editTrackName || "").trim();
    if (!newName) {
      alert("Track name cannot be blank.");
      return;
    }
    const newActiveBool = (editTrackActive || "TRUE").toUpperCase() === "TRUE";

    setEditTrackSaving(true);
    try {
      await supabasePatch(`/rest/v1/track_definitions?id=eq.${t.id}`, {
        track_name: newName,
        is_track_active: newActiveBool,
      });

      invalidateMany([
        "/rest/v1/track_definitions",
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_track_signoffs",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([
        loadTracks(true),
        loadRequirements(true),
        loadSignoffs(true),
        loadTrainingRecords(true),
      ]);

      cancelEditTrack();
    } catch (e) {
      alert("Failed to save track:\n" + getErrorMessage(e));
    } finally {
      setEditTrackSaving(false);
    }
  }

  async function deleteTrackDefinition(t: Track) {
    const ok = window.confirm(
      `Delete track?\n\nID: ${t.id}\nName: ${t.name}\n\nThis may also remove related requirements, signoffs, and training records if your database is set to cascade.`
    );
    if (!ok) return;

    try {
      setTracksLoading(true);
      setTracksError("");

      await supabaseDelete(`/rest/v1/track_definitions?id=eq.${t.id}`);

      invalidateMany([
        "/rest/v1/track_definitions",
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_track_signoffs",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([
        loadTracks(true),
        loadRequirements(true),
        loadSignoffs(true),
        loadTrainingRecords(true),
      ]);

      if (String(signoffsTrackId) === String(t.id)) setSignoffsTrackId("ALL");
      if (String(recordsTrackId) === String(t.id)) setRecordsTrackId("ALL");
      if (editingTrackId === t.id) cancelEditTrack();
    } catch (e) {
      alert("Failed to delete track:\n" + getErrorMessage(e));
      setTracksError(getErrorMessage(e));
      setTracksLoading(false);
    }
  }

  async function toggleTrackActive(trackRow: Track) {
    if (editingTrackId === trackRow.id) return;

    const newActive = !trackRow.active;

    setTracks((prev) =>
      prev.map((t) => (t.id === trackRow.id ? { ...t, active: newActive } : t))
    );

    try {
      await supabasePatch(`/rest/v1/track_definitions?id=eq.${trackRow.id}`, {
        is_track_active: newActive,
      });

      invalidateMany([
        "/rest/v1/track_definitions",
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([
        loadTracks(true),
        loadRequirements(true),
        loadTrainingRecords(true),
      ]);
    } catch (e) {
      alert("Failed to update track active:\n" + getErrorMessage(e));
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackRow.id ? { ...t, active: trackRow.active } : t
        )
      );
    }
  }

  async function updateTrackColor(
    trackRow: Track,
    nextHexOrEmpty: string | null,
    opts: { preview?: boolean } = {}
  ) {
    const previewOnly = !!opts.preview;

    const next = (nextHexOrEmpty || "").trim();
    const valueToStore = next ? next : null;

    setTracks((prev) =>
      prev.map((t) => (t.id === trackRow.id ? { ...t, color: next } : t))
    );

    if (previewOnly) return;
    if (editTrackSaving) return;

    try {
      await supabasePatch(`/rest/v1/track_definitions?id=eq.${trackRow.id}`, {
        track_color: valueToStore,
      });

      invalidateMany([
        "/rest/v1/track_definitions",
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_track_signoffs",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);
    } catch (e) {
      alert("Failed to update track color:\n" + getErrorMessage(e));
      await loadTracks(true);
    }
  }

  const {
    isQualifiedStatus,
    crewById,
    trackById,
    trainingById,
    crewDepartments,
    visibleCrew,
    visibleSignoffs,
    visibleTrainingRecords,
    requirementsGroupedByTraining,
    requirementsGroupedByTrack,
  } = useAppDerived({
    crew,
    tracks,
    trainings,
    requirements,
    signoffs,
    trainingRecords,
    crewNameFilter,
    crewDeptFilter,
    crewStatusFilter,
    signoffsCrewId,
    signoffsTrackId,
    signoffsStatusFilter,
    recordsCrewId,
    recordsTrackId,
    recordsTrainingId,
  });

  async function deleteRequirement(row: Requirement) {
    const trackName = trackById.get(row.trackId)?.name || row.trackId;
    const trainingName =
      trainingById.get(row.trainingId)?.name || row.trainingId;

    const ok = window.confirm(
      `Delete requirement?\n\nTraining: ${trainingName}\nTrack: ${trackName}`
    );
    if (!ok) return;

    try {
      setRequirementsLoading(true);
      setRequirementsError("");

      await supabaseDelete(
        `/rest/v1/track_training_requirements?id=eq.${row.id}`
      );

      invalidateMany([
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([loadRequirements(true), loadTrainingRecords(true)]);
    } catch (e) {
      alert("Failed to delete requirement:\n" + getErrorMessage(e));
      setRequirementsError(getErrorMessage(e));
      setRequirementsLoading(false);
    }
  }

  async function toggleRequirementRow(row: Requirement) {
    const nextActive = !row.active;

    setRequirements((prev) =>
      prev.map((r: Requirement) =>
        r.id === row.id ? { ...r, active: nextActive } : r
      )
    );

    try {
      await supabasePatch(
        `/rest/v1/track_training_requirements?id=eq.${row.id}`,
        { is_requirement_active: nextActive }
      );

      invalidateMany([
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([loadRequirements(true), loadTrainingRecords(true)]);
    } catch (e) {
      alert("Failed to update requirement:\n" + getErrorMessage(e));
      setRequirementsError(getErrorMessage(e));
      setRequirements((prev) =>
        prev.map((r: Requirement) =>
          r.id === row.id ? { ...r, active: row.active } : r
        )
      );
    }
  }

  async function addTrainingRequirement() {
    const trackIdNum = Number(reqNewTrackId);
    const trainingIdNum = Number(reqNewTrainingId);

    if (reqNewTrackId === "ALL" || !Number.isFinite(trackIdNum)) {
      alert("Pick a Track.");
      return;
    }
    if (reqNewTrainingId === "ALL" || !Number.isFinite(trainingIdNum)) {
      alert("Pick a Training.");
      return;
    }

    const exists = requirements.some(
      (r) => r.trackId === trackIdNum && r.trainingId === trainingIdNum
    );
    if (exists) {
      alert("That requirement already exists.");
      return;
    }

    const is_requirement_active =
      (reqNewActive || "TRUE").toUpperCase() === "TRUE";

    setReqAdding(true);
    try {
      await supabasePost("/rest/v1/track_training_requirements", {
        track_id: trackIdNum,
        training_id: trainingIdNum,
        is_requirement_active,
        location_id: activeLocationId,
      });

      invalidateMany([
        "/rest/v1/track_training_requirements",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([loadRequirements(true), loadTrainingRecords(true)]);
    } catch (e) {
      alert("Failed to add requirement:\n" + getErrorMessage(e));
      setRequirementsError(getErrorMessage(e));
    } finally {
      setReqAdding(false);
    }
  }

  async function updateSignoffStatus(signoffRow: Signoff, newStatus: string) {
    setSignoffs((prev) =>
      prev.map((s) =>
        s.id === signoffRow.id ? { ...s, status: newStatus } : s
      )
    );

    try {
      await supabasePatch(
        `/rest/v1/crew_track_signoffs?id=eq.${signoffRow.id}`,
        {
          signoff_status: newStatus,
        }
      );

      invalidateMany([
        "/rest/v1/crew_track_signoffs",
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await Promise.all([loadSignoffs(true), loadTrainingRecords(true)]);
    } catch (e) {
      alert("Failed to update signoff:\n" + getErrorMessage(e));
      setSignoffs((prev) =>
        prev.map((s) =>
          s.id === signoffRow.id ? { ...s, status: signoffRow.status } : s
        )
      );
    }
  }

  function isTrainingExpanded(trainingId: number) {
    return expandedTrainingIds.has(trainingId);
  }
  function toggleTrainingExpanded(trainingId: number) {
    setExpandedTrainingIds((prev) => {
      const next = new Set(prev);
      if (next.has(trainingId)) next.delete(trainingId);
      else next.add(trainingId);
      return next;
    });
  }
  function expandAllTrainings() {
    setExpandedTrainingIds(
      new Set(requirementsGroupedByTraining.map((g) => g.trainingId))
    );
  }
  function collapseAllTrainings() {
    setExpandedTrainingIds(new Set());
  }

  function isReqTrackExpanded(trackId: number) {
    return expandedReqTrackIds.has(trackId);
  }
  function toggleReqTrackExpanded(trackId: number) {
    setExpandedReqTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }
  function expandAllReqTracks() {
    setExpandedReqTrackIds(
      new Set(requirementsGroupedByTrack.map((g) => g.trackId))
    );
  }
  function collapseAllReqTracks() {
    setExpandedReqTrackIds(new Set());
  }

  const tabLabel = (key: TabId) => {
    if (key === "crew") return "Crew";
    if (key === "trackDefs") return "Tracks";
    if (key === "trainingDefs") return "Trainings";
    if (key === "signoffs") return "Signoffs";
    if (key === "requirements") return "Requirements";
    if (key === "records") return "Records";
    if (key === "planner") return "Planner";
    return key;
  };

  const markCompleteCrewName =
    markCompleteRow?.crewName ||
    (markCompleteRow?.crewId != null
      ? crewById.get(markCompleteRow.crewId)?.name
      : "") ||
    "";
  const markCompleteTrackName =
    markCompleteRow?.trackName ||
    (markCompleteRow?.trackId != null
      ? trackById.get(markCompleteRow.trackId)?.name
      : "") ||
    "";
  const markCompleteTrainingName =
    markCompleteRow?.trainingName ||
    (markCompleteRow?.trainingId != null
      ? trainingById.get(markCompleteRow.trainingId)?.name
      : "") ||
    "";

  const historyTitle = historyContext?.trainingName || "";
  const historySubtitle = `${historyContext?.crewName || ""} · ${
    historyContext?.trackName || ""
  }`;

  return (
    <div style={S.page}>
      <AppModals
        S={S}
        departments={DEPARTMENTS}
        addCrewOpen={addCrewOpen}
        closeAddCrew={closeAddCrew}
        addingCrew={addingCrew}
        newCrewName={newCrewName}
        setNewCrewName={setNewCrewName}
        newCrewDept={newCrewDept}
        setNewCrewDept={setNewCrewDept}
        newCrewStatus={newCrewStatus}
        setNewCrewStatus={setNewCrewStatus}
        confirmAddCrewMember={confirmAddCrewMember}
        addTrainingOpen={addTrainingOpen}
        closeAddTraining={closeAddTraining}
        addingTraining={addingTraining}
        newTrainingId={newTrainingId}
        setNewTrainingId={setNewTrainingId}
        newTrainingName={newTrainingName}
        setNewTrainingName={setNewTrainingName}
        newTrainingActive={newTrainingActive}
        setNewTrainingActive={setNewTrainingActive}
        trainingGroups={trainingGroups}
        newTrainingGroupId={newTrainingGroupId}
        setNewTrainingGroupId={setNewTrainingGroupId}
        newTrainingExpiryMode={newTrainingExpiryMode}
        setNewTrainingExpiryMode={setNewTrainingExpiryMode}
        newTrainingExpiryWeeks={newTrainingExpiryWeeks}
        setNewTrainingExpiryWeeks={setNewTrainingExpiryWeeks}
        confirmAddTraining={confirmAddTraining}
        addTrackOpen={addTrackOpen}
        closeAddTrack={closeAddTrack}
        addingTrack={addingTrack}
        newTrackId={newTrackId}
        setNewTrackId={setNewTrackId}
        newTrackName={newTrackName}
        setNewTrackName={setNewTrackName}
        newTrackActive={newTrackActive}
        setNewTrackActive={setNewTrackActive}
        confirmAddTrack={confirmAddTrack}
        markCompleteOpen={markCompleteOpen}
        closeMarkComplete={closeMarkComplete}
        markCompleteSaving={markCompleteSaving}
        markCompleteCrewName={markCompleteCrewName}
        markCompleteTrackName={markCompleteTrackName}
        markCompleteTrainingName={markCompleteTrainingName}
        markCompleteDate={markCompleteDate}
        setMarkCompleteDate={setMarkCompleteDate}
        markCompleteBy={markCompleteBy}
        setMarkCompleteBy={setMarkCompleteBy}
        markCompleteNotes={markCompleteNotes}
        setMarkCompleteNotes={setMarkCompleteNotes}
        confirmMarkComplete={confirmMarkComplete}
        historyOpen={historyOpen}
        closeHistory={closeHistory}
        historyBusy={historyBusy}
        historyTitle={historyTitle}
        historySubtitle={historySubtitle}
        historyRows={historyRows}
        historyError={historyError}
        refreshHistory={refreshHistory}
        deleteHistoryRow={deleteHistoryRow}
      />

      <div style={S.shell}>
        <AppHeader
          S={S}
          blueprintIcon={blueprintIcon}
          activeLocationId={activeLocationId}
          setActiveLocationId={setActiveLocationId}
          locations={locations}
          locationsLoading={locationsLoading}
          locationsError={locationsError}
          tabs={TABS}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabLabel={tabLabel}
        />

        <div style={S.contentGrid}>
          {activeTab === "crew" && (
            <CrewTab
              S={S}
              crew={crew}
              visibleCrew={visibleCrew}
              crewDepartments={crewDepartments}
              crewLoading={crewLoading}
              crewError={crewError}
              crewNameFilter={crewNameFilter}
              setCrewNameFilter={setCrewNameFilter}
              crewDeptFilter={crewDeptFilter}
              setCrewDeptFilter={setCrewDeptFilter}
              crewStatusFilter={crewStatusFilter}
              setCrewStatusFilter={setCrewStatusFilter}
              editingCrewId={editingCrewId}
              editCrewName={editCrewName}
              setEditCrewName={setEditCrewName}
              editCrewDept={editCrewDept}
              setEditCrewDept={setEditCrewDept}
              editCrewStatus={editCrewStatus}
              setEditCrewStatus={setEditCrewStatus}
              editCrewSaving={editCrewSaving}
              openAddCrew={openAddCrew}
              loadCrew={loadCrew}
              startEditCrew={startEditCrew}
              cancelEditCrew={cancelEditCrew}
              saveEditCrew={saveEditCrew}
              deleteCrewMember={deleteCrewMember}
            />
          )}

          {activeTab === "trackDefs" && (
            <TracksTab
              S={S}
              tracks={tracks}
              tracksLoading={tracksLoading}
              tracksError={tracksError}
              editingTrackId={editingTrackId}
              editTrackName={editTrackName}
              setEditTrackName={setEditTrackName}
              editTrackActive={editTrackActive}
              setEditTrackActive={setEditTrackActive}
              openAddTrack={openAddTrack}
              editTrackSaving={editTrackSaving}
              loadTracks={loadTracks}
              startEditTrack={startEditTrack}
              cancelEditTrack={cancelEditTrack}
              saveEditTrack={saveEditTrack}
              deleteTrackDefinition={deleteTrackDefinition}
              toggleTrackActive={toggleTrackActive}
              updateTrackColor={updateTrackColor}
            />
          )}

          {activeTab === "trainingDefs" && (
            <TrainingsTab
              S={S}
              trainings={trainings}
              trainingsLoading={trainingsLoading}
              trainingsError={trainingsError}
              trainingGroups={trainingGroups}
              trainingGroupsLoading={trainingGroupsLoading}
              trainingGroupsError={trainingGroupsError}
              createTrainingGroup={createTrainingGroup}
              updateTrainingGroup={updateTrainingGroup}
              deleteTrainingGroup={deleteTrainingGroup}
              editingTrainingId={editingTrainingId}
              editTrainingName={editTrainingName}
              setEditTrainingName={setEditTrainingName}
              editTrainingActive={editTrainingActive}
              setEditTrainingActive={setEditTrainingActive}
              editTrainingSaving={editTrainingSaving}
              editTrainingExpiryWeeks={editTrainingExpiryWeeks}
              setEditTrainingExpiryWeeks={setEditTrainingExpiryWeeks}
              editTrainingGroupId={editTrainingGroupId}
              setEditTrainingGroupId={setEditTrainingGroupId}
              addTrainingDefinition={openAddTraining}
              deleteTrainingDefinition={deleteTrainingDefinition}
              startEditTraining={startEditTraining}
              cancelEditTraining={cancelEditTraining}
              saveEditTraining={saveEditTraining}
              loadTrainings={loadTrainings}
            />
          )}

          {activeTab === "signoffs" && (
            <SignoffsTab
              S={S}
              crew={crew}
              tracks={tracks}
              signoffs={signoffs}
              visibleSignoffs={visibleSignoffs}
              signoffsLoading={signoffsLoading}
              signoffsError={signoffsError}
              signoffsCrewId={signoffsCrewId}
              setSignoffsCrewId={setSignoffsCrewId}
              signoffsTrackId={signoffsTrackId}
              setSignoffsTrackId={setSignoffsTrackId}
              signoffsStatusFilter={signoffsStatusFilter}
              setSignoffsStatusFilter={setSignoffsStatusFilter}
              loadSignoffs={loadSignoffs}
              updateSignoffStatus={updateSignoffStatus}
              isQualifiedStatus={isQualifiedStatus}
            />
          )}

          {activeTab === "requirements" && (
            <RequirementsTab
              S={S}
              tracks={tracks}
              trainings={trainings}
              requirements={requirements}
              trainingsLoading={trainingsLoading}
              trainingsError={trainingsError}
              requirementsLoading={requirementsLoading}
              requirementsError={requirementsError}
              reqNewTrackId={reqNewTrackId}
              setReqNewTrackId={setReqNewTrackId}
              reqNewTrainingId={reqNewTrainingId}
              setReqNewTrainingId={setReqNewTrainingId}
              reqNewActive={reqNewActive}
              setReqNewActive={setReqNewActive}
              reqAdding={reqAdding}
              addTrainingRequirement={addTrainingRequirement}
              requirementsViewMode={requirementsViewMode}
              setRequirementsViewMode={setRequirementsViewMode}
              requirementsGroupedByTraining={requirementsGroupedByTraining}
              requirementsGroupedByTrack={requirementsGroupedByTrack}
              isTrainingExpanded={isTrainingExpanded}
              toggleTrainingExpanded={toggleTrainingExpanded}
              expandAllTrainings={expandAllTrainings}
              collapseAllTrainings={collapseAllTrainings}
              isReqTrackExpanded={isReqTrackExpanded}
              toggleReqTrackExpanded={toggleReqTrackExpanded}
              expandAllReqTracks={expandAllReqTracks}
              collapseAllReqTracks={collapseAllReqTracks}
              loadTracks={loadTracks}
              loadTrainings={loadTrainings}
              loadRequirements={loadRequirements}
              toggleRequirementRow={toggleRequirementRow}
              deleteRequirement={deleteRequirement}
            />
          )}

          {activeTab === "records" && (
            <RecordsTab
              S={S}
              crew={crew}
              tracks={tracks}
              trainings={trainings}
              visibleTrainingRecords={visibleTrainingRecords}
              recordsLoading={recordsLoading}
              recordsError={recordsError}
              recordsCrewId={recordsCrewId}
              setRecordsCrewId={setRecordsCrewId}
              recordsTrackId={recordsTrackId}
              setRecordsTrackId={setRecordsTrackId}
              recordsTrainingId={recordsTrainingId}
              setRecordsTrainingId={setRecordsTrainingId}
              loadTrainingRecords={loadTrainingRecords}
              markRecordComplete={openMarkComplete}
              openHistory={openHistory}
            />
          )}

          {activeTab === "planner" && (
            <PlannerTab
              S={S}
              activeLocationId={activeLocationId}
              supabaseRpc={supabaseRpc}
              supabaseGet={supabaseGet}
              supabasePost={supabasePost}
              supabasePatch={supabasePatch}
              trainingGroups={trainingGroups}
            />
          )}
        </div>
      </div>
    </div>
  );
}
