// App.js
import blueprintIcon from "./assets/blueprint-icon.png";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSupabaseRestClient } from "./lib/supabaseRest";
import { createStyles } from "./components/ui/Styles";

import { useLocation } from "./context/LocationContext";
import { useDataLoaders } from "./hooks/useDataLoaders";
import { useHistoryModal } from "./hooks/useHistoryModal";
import { useMarkComplete } from "./hooks/useMarkComplete";

import HistoryModal from "./components/modals/HistoryModal";
import AddCrewModal from "./components/modals/AddCrewModal";
import AddTrackModal from "./components/modals/AddTrackModal";
import AddTrainingModal from "./components/modals/AddTrainingModal";
import MarkCompleteModal from "./components/modals/MarkCompleteModal";

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

const REFRESH_MS = 10000;

const TABS = [
  "crew",
  "trackDefs",
  "trainingDefs",
  "signoffs",
  "requirements",
  "records",
  "planner",
];

const DEPARTMENTS = [
  "Automation",
  "Carpentry",
  "Video",
  "Props",
  "Lighting",
  "Wardrobe",
  "Audio",
  "Stage Management",
  "Production Management",
  "Front of House",
  "Upper Management",
];

const LOCATION_SCOPED_CACHE_KEYS = [
  "/rest/v1/crew_roster",
  "/rest/v1/track_definitions",
  "/rest/v1/training_definitions",
  "/rest/v1/training_groups",
  "/rest/v1/track_training_requirements",
  "/rest/v1/crew_track_signoffs",
  "/rest/v1/crew_training_records",
  "/rest/v1/v_training_dashboard_with_signer",
  "/rest/v1/crew_training_record_history",
];

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

  const safeSet = useCallback((setter) => {
    if (!isMountedRef.current) return;
    setter();
  }, []);

  const invalidateMany = useCallback(
    (paths) => {
      paths.forEach((p) => invalidateGetCache(p));
    },
    [invalidateGetCache]
  );

  const [activeTab, setActiveTab] = useState("crew");

  // LocationContext (global)
  const { activeLocationId, setActiveLocationId } = useLocation();

  // Add location scoping helpers (used in a couple manual queries)
  const withLoc = useCallback(
    (path) => {
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

  // Locations list (for the dropdown)
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState("");

  const supabaseRpc = useCallback(
    async (fnName, payload) => {
      return await supabasePost(`/rest/v1/rpc/${fnName}`, payload);
    },
    [supabasePost]
  );

  // Crew
  const [crew, setCrew] = useState([]);
  const [crewLoading, setCrewLoading] = useState(true);
  const [crewError, setCrewError] = useState("");

  // Tracks
  const [tracks, setTracks] = useState([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracksError, setTracksError] = useState("");

  // Trainings
  const [trainings, setTrainings] = useState([]);
  const [trainingsLoading, setTrainingsLoading] = useState(true);
  const [trainingsError, setTrainingsError] = useState("");

  // Training Groups
  const [trainingGroups, setTrainingGroups] = useState([]);
  const [trainingGroupsLoading, setTrainingGroupsLoading] = useState(true);
  const [trainingGroupsError, setTrainingGroupsError] = useState("");

  // Requirements
  const [requirements, setRequirements] = useState([]);
  const [requirementsLoading, setRequirementsLoading] = useState(true);
  const [requirementsError, setRequirementsError] = useState("");

  // Signoffs
  const [signoffs, setSignoffs] = useState([]);
  const [signoffsLoading, setSignoffsLoading] = useState(true);
  const [signoffsError, setSignoffsError] = useState("");

  // Training Records
  const [trainingRecords, setTrainingRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");

  // Track Signoffs filters
  const [signoffsCrewId, setSignoffsCrewId] = useState("ALL");
  const [signoffsTrackId, setSignoffsTrackId] = useState("ALL");
  const [signoffsStatusFilter, setSignoffsStatusFilter] = useState("ALL"); // ALL / No / Training / Yes

  // Crew Roster filters
  const [crewNameFilter, setCrewNameFilter] = useState("ALL");
  const [crewDeptFilter, setCrewDeptFilter] = useState("ALL");
  const [crewStatusFilter, setCrewStatusFilter] = useState("Active");

  // Training Records filters
  const [recordsCrewId, setRecordsCrewId] = useState("ALL");
  const [recordsTrackId, setRecordsTrackId] = useState("ALL");
  const [recordsTrainingId, setRecordsTrainingId] = useState("ALL");

  // Inline edit (crew)
  const [editingCrewId, setEditingCrewId] = useState(null);
  const [editCrewName, setEditCrewName] = useState("");
  const [editCrewDept, setEditCrewDept] = useState("");
  const [editCrewStatus, setEditCrewStatus] = useState("Active");
  const [editCrewSaving, setEditCrewSaving] = useState(false);

  // Inline edit (training definitions)
  const [editingTrainingId, setEditingTrainingId] = useState(null);
  const [editTrainingName, setEditTrainingName] = useState("");
  const [editTrainingActive, setEditTrainingActive] = useState("TRUE"); // TRUE / FALSE
  const [editTrainingSaving, setEditTrainingSaving] = useState(false);
  const [editTrainingExpiryWeeks, setEditTrainingExpiryWeeks] = useState(""); // blank = Never (0)
  const [editTrainingGroupId, setEditTrainingGroupId] = useState(""); // "" = Ungrouped (null)

  // Inline edit (tracks)
  const [editingTrackId, setEditingTrackId] = useState(null);
  const [editTrackName, setEditTrackName] = useState("");
  const [editTrackActive, setEditTrackActive] = useState("TRUE"); // TRUE / FALSE
  const [editTrackSaving, setEditTrackSaving] = useState(false);

  // Add Training Requirement
  const [reqNewTrackId, setReqNewTrackId] = useState("ALL");
  const [reqNewTrainingId, setReqNewTrainingId] = useState("ALL");
  const [reqNewActive, setReqNewActive] = useState("TRUE"); // TRUE / FALSE
  const [reqAdding, setReqAdding] = useState(false);

  // Requirements view + accordion
  const [requirementsViewMode, setRequirementsViewMode] = useState("training"); // training | track
  const [expandedTrainingIds, setExpandedTrainingIds] = useState(
    () => new Set()
  );
  const [expandedReqTrackIds, setExpandedReqTrackIds] = useState(
    () => new Set()
  );

  // Add Training modal
  const [addTrainingOpen, setAddTrainingOpen] = useState(false);
  const [newTrainingId, setNewTrainingId] = useState("");
  const [newTrainingName, setNewTrainingName] = useState("");
  const [newTrainingActive, setNewTrainingActive] = useState("TRUE"); // TRUE / FALSE
  const [newTrainingExpiryMode, setNewTrainingExpiryMode] = useState("NEVER"); // NEVER | WEEKS
  const [newTrainingExpiryWeeks, setNewTrainingExpiryWeeks] = useState(""); // string
  const [addingTraining, setAddingTraining] = useState(false);

  // Add Track modal
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [newTrackId, setNewTrackId] = useState("");
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackActive, setNewTrackActive] = useState("TRUE"); // TRUE / FALSE
  const [addingTrack, setAddingTrack] = useState(false);

  // Add Crew Member modal
  const [addCrewOpen, setAddCrewOpen] = useState(false);
  const [newCrewName, setNewCrewName] = useState("");
  const [newCrewDept, setNewCrewDept] = useState(DEPARTMENTS[0] || "");
  const [newCrewStatus, setNewCrewStatus] = useState("Active");
  const [addingCrew, setAddingCrew] = useState(false);

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
        training_group_id: null,
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
      alert("Failed to add training:\n" + String(e.message || e));
      setTrainingsError(String(e.message || e));
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
      alert("Failed to add crew member:\n" + String(e.message || e));
      setCrewError(String(e.message || e));
    } finally {
      setAddingCrew(false);
    }
  }

  async function deleteCrewMember(crewRow) {
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
      alert("Failed to delete crew member:\n" + String(e.message || e));
      setCrewError(String(e.message || e));
      setCrewLoading(false);
    }
  }

  function startEditCrew(c) {
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

  async function saveEditCrew(c) {
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
      alert("Failed to save crew member:\n" + String(e.message || e));
    } finally {
      setEditCrewSaving(false);
    }
  }

  // Training group create
  async function createTrainingGroup(name) {
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
      (g) => String(g.name || "").toLowerCase() === clean.toLowerCase()
    );
    if (found?.id != null) return found.id;

    const fresh = await supabaseGet(
      withLoc(
        "/rest/v1/training_groups?select=id,name,location_id&order=sort_order.asc,name.asc"
      ),
      { cacheTag }
    );

    const freshFound = (fresh || []).find(
      (g) => String(g.name || "").toLowerCase() === clean.toLowerCase()
    );
    return freshFound?.id ?? null;
  }

  async function deleteTrainingDefinition(t) {
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
      alert("Failed to delete training:\n" + String(e.message || e));
      setTrainingsError(String(e.message || e));
      setTrainingsLoading(false);
    }
  }

  function startEditTraining(t) {
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

  async function saveEditTraining(t) {
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
      alert("Failed to save training:\n" + String(e.message || e));
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
      alert("Failed to add track:\n" + String(e.message || e));
      setTracksError(String(e.message || e));
    } finally {
      setAddingTrack(false);
    }
  }

  function startEditTrack(t) {
    setEditingTrackId(t.id);
    setEditTrackName(t.name || "");
    setEditTrackActive(t.active ? "TRUE" : "FALSE");
  }

  function cancelEditTrack() {
    setEditingTrackId(null);
    setEditTrackName("");
    setEditTrackActive("TRUE");
  }

  async function saveEditTrack(t) {
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
      alert("Failed to save track:\n" + String(e.message || e));
    } finally {
      setEditTrackSaving(false);
    }
  }

  async function deleteTrackDefinition(t) {
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
      alert("Failed to delete track:\n" + String(e.message || e));
      setTracksError(String(e.message || e));
      setTracksLoading(false);
    }
  }

  async function toggleTrackActive(trackRow) {
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
      alert("Failed to update track active:\n" + String(e.message || e));
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackRow.id ? { ...t, active: trackRow.active } : t
        )
      );
    }
  }

  async function updateTrackColor(trackRow, nextHexOrEmpty, opts = {}) {
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
      alert("Failed to update track color:\n" + String(e.message || e));
      await loadTracks(true);
    }
  }

  const isQualifiedStatus = (status) =>
    status === "Yes" || status === "Training";

  const crewById = useMemo(() => new Map(crew.map((c) => [c.id, c])), [crew]);
  const trackById = useMemo(
    () => new Map(tracks.map((t) => [t.id, t])),
    [tracks]
  );
  const trainingById = useMemo(
    () => new Map(trainings.map((t) => [t.id, t])),
    [trainings]
  );

  async function deleteRequirement(row) {
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
      alert("Failed to delete requirement:\n" + String(e.message || e));
      setRequirementsError(String(e.message || e));
      setRequirementsLoading(false);
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
      alert("Failed to add requirement:\n" + String(e.message || e));
      setRequirementsError(String(e.message || e));
    } finally {
      setReqAdding(false);
    }
  }

  async function updateSignoffStatus(signoffRow, newStatus) {
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
      alert("Failed to update signoff:\n" + String(e.message || e));
      setSignoffs((prev) =>
        prev.map((s) =>
          s.id === signoffRow.id ? { ...s, status: signoffRow.status } : s
        )
      );
    }
  }

  const crewDepartments = useMemo(() => {
    const set = new Set();
    crew.forEach((c) => {
      const d = (c.dept || "").trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [crew]);

  const visibleCrew = useMemo(() => {
    let rows = crew;

    if (crewNameFilter !== "ALL") {
      const idNum = Number(crewNameFilter);
      rows = rows.filter((c) => c.id === idNum);
    }
    if (crewDeptFilter !== "ALL") {
      rows = rows.filter((c) => (c.dept || "") === crewDeptFilter);
    }
    if (crewStatusFilter !== "ALL") {
      rows = rows.filter((c) =>
        crewStatusFilter === "Active" ? c.active : !c.active
      );
    }
    return rows;
  }, [crew, crewNameFilter, crewDeptFilter, crewStatusFilter]);

  const visibleSignoffs = useMemo(() => {
    let rows = signoffs;

    if (signoffsCrewId !== "ALL") {
      const crewIdNum = Number(signoffsCrewId);
      rows = rows.filter((s) => s.crewId === crewIdNum);
    }
    if (signoffsTrackId !== "ALL") {
      const trackIdNum = Number(signoffsTrackId);
      rows = rows.filter((s) => s.trackId === trackIdNum);
    }
    if (signoffsStatusFilter !== "ALL") {
      rows = rows.filter((s) => s.status === signoffsStatusFilter);
    }
    return rows;
  }, [signoffs, signoffsCrewId, signoffsTrackId, signoffsStatusFilter]);

  const visibleTrainingRecords = useMemo(() => {
    let rows = trainingRecords;

    if (recordsCrewId !== "ALL") {
      const idNum = Number(recordsCrewId);
      rows = rows.filter((r) => r.crewId === idNum);
    }
    if (recordsTrackId !== "ALL") {
      const idNum = Number(recordsTrackId);
      rows = rows.filter((r) => r.trackId === idNum);
    }
    if (recordsTrainingId !== "ALL") {
      const idNum = Number(recordsTrainingId);
      rows = rows.filter((r) => r.trainingId === idNum);
    }

    const rank = (r) => {
      if (r.status === "Training Overdue") return 0;
      if (r.status === "Training Due") return 1;
      return 2;
    };

    rows = [...rows].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;

      if (ra === 0) {
        const ao = Number(a.daysOverdue ?? 0);
        const bo = Number(b.daysOverdue ?? 0);
        if (ao !== bo) return bo - ao;
      }

      if (ra === 1) {
        const au =
          a.daysUntilDue == null
            ? Number.POSITIVE_INFINITY
            : Number(a.daysUntilDue);
        const bu =
          b.daysUntilDue == null
            ? Number.POSITIVE_INFINITY
            : Number(b.daysUntilDue);
        if (au !== bu) return au - bu;
      }

      const ac = String(a.crewName || "");
      const bc = String(b.crewName || "");
      const ccmp = ac.localeCompare(bc);
      if (ccmp !== 0) return ccmp;

      const at = String(a.trackName || "");
      const bt = String(b.trackName || "");
      const tcmp = at.localeCompare(bt);
      if (tcmp !== 0) return tcmp;

      const atr = String(a.trainingName || "");
      const btr = String(b.trainingName || "");
      return atr.localeCompare(btr);
    });

    return rows;
  }, [trainingRecords, recordsCrewId, recordsTrackId, recordsTrainingId]);

  const requirementsGroupedByTraining = useMemo(() => {
    const map = new Map();

    for (const r of requirements) {
      const trainingName =
        trainingById.get(r.trainingId)?.name || String(r.trainingId);
      const trackName = trackById.get(r.trackId)?.name || String(r.trackId);

      if (!map.has(r.trainingId)) {
        map.set(r.trainingId, {
          trainingId: r.trainingId,
          trainingName,
          items: [],
        });
      }
      map.get(r.trainingId).items.push({ ...r, trackName });
    }

    for (const g of map.values()) {
      g.items.sort((a, b) =>
        String(a.trackName).localeCompare(String(b.trackName))
      );
    }

    return Array.from(map.values()).sort((a, b) =>
      String(a.trainingName).localeCompare(String(b.trainingName))
    );
  }, [requirements, trainingById, trackById]);

  const requirementsGroupedByTrack = useMemo(() => {
    const map = new Map();

    for (const r of requirements) {
      const trackName = trackById.get(r.trackId)?.name || String(r.trackId);
      const trainingName =
        trainingById.get(r.trainingId)?.name || String(r.trainingId);

      if (!map.has(r.trackId)) {
        map.set(r.trackId, { trackId: r.trackId, trackName, items: [] });
      }
      map.get(r.trackId).items.push({ ...r, trainingName });
    }

    for (const g of map.values()) {
      g.items.sort((a, b) =>
        String(a.trainingName).localeCompare(String(b.trainingName))
      );
    }

    return Array.from(map.values()).sort((a, b) =>
      String(a.trackName).localeCompare(String(b.trackName))
    );
  }, [requirements, trainingById, trackById]);

  function isTrainingExpanded(trainingId) {
    return expandedTrainingIds.has(trainingId);
  }
  function toggleTrainingExpanded(trainingId) {
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

  function isReqTrackExpanded(trackId) {
    return expandedReqTrackIds.has(trackId);
  }
  function toggleReqTrackExpanded(trackId) {
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

  const tabLabel = (key) => {
    if (key === "crew") return "Crew";
    if (key === "trackDefs") return "Tracks";
    if (key === "trainingDefs") return "Trainings";
    if (key === "signoffs") return "Signoffs";
    if (key === "requirements") return "Requirements";
    if (key === "records") return "Records";
    if (key === "planner") return "Planner";
    return key;
  };

  return (
    <div style={S.page}>
      <AddCrewModal
        S={S}
        isOpen={addCrewOpen}
        onClose={closeAddCrew}
        isBusy={addingCrew}
        departments={DEPARTMENTS}
        newCrewName={newCrewName}
        setNewCrewName={setNewCrewName}
        newCrewDept={newCrewDept}
        setNewCrewDept={setNewCrewDept}
        newCrewStatus={newCrewStatus}
        setNewCrewStatus={setNewCrewStatus}
        onConfirm={confirmAddCrewMember}
      />

      <AddTrainingModal
        S={S}
        isOpen={addTrainingOpen}
        onClose={closeAddTraining}
        isBusy={addingTraining}
        newTrainingId={newTrainingId}
        setNewTrainingId={setNewTrainingId}
        newTrainingName={newTrainingName}
        setNewTrainingName={setNewTrainingName}
        newTrainingActive={newTrainingActive}
        setNewTrainingActive={setNewTrainingActive}
        newTrainingExpiryMode={newTrainingExpiryMode}
        setNewTrainingExpiryMode={setNewTrainingExpiryMode}
        newTrainingExpiryWeeks={newTrainingExpiryWeeks}
        setNewTrainingExpiryWeeks={setNewTrainingExpiryWeeks}
        onConfirm={confirmAddTraining}
      />

      <AddTrackModal
        S={S}
        isOpen={addTrackOpen}
        onClose={closeAddTrack}
        isBusy={addingTrack}
        newTrackId={newTrackId}
        setNewTrackId={setNewTrackId}
        newTrackName={newTrackName}
        setNewTrackName={setNewTrackName}
        newTrackActive={newTrackActive}
        setNewTrackActive={setNewTrackActive}
        onConfirm={confirmAddTrack}
      />

      <MarkCompleteModal
        S={S}
        isOpen={markCompleteOpen}
        onClose={closeMarkComplete}
        isBusy={markCompleteSaving}
        crewName={
          markCompleteRow?.crewName ||
          crewById.get(markCompleteRow?.crewId)?.name ||
          ""
        }
        trackName={
          markCompleteRow?.trackName ||
          trackById.get(markCompleteRow?.trackId)?.name ||
          ""
        }
        trainingName={
          markCompleteRow?.trainingName ||
          trainingById.get(markCompleteRow?.trainingId)?.name ||
          ""
        }
        completedDate={markCompleteDate}
        setCompletedDate={setMarkCompleteDate}
        signoffBy={markCompleteBy}
        setSignoffBy={setMarkCompleteBy}
        notes={markCompleteNotes}
        setNotes={setMarkCompleteNotes}
        onConfirm={confirmMarkComplete}
      />

      <HistoryModal
        S={S}
        isOpen={historyOpen}
        onClose={closeHistory}
        isBusy={historyBusy}
        title={historyContext?.trainingName || ""}
        subtitle={`${historyContext?.crewName || ""} · ${
          historyContext?.trackName || ""
        }`}
        rows={historyRows}
        error={historyError}
        onRefresh={refreshHistory}
        onDeleteRow={deleteHistoryRow}
      />

      <div style={S.shell}>
        <div style={S.topBar}>
          <div style={S.headerRow}>
            <div style={S.titleBlock}>
              <div
                style={{
                  height: 68,
                  padding: "0 14px",
                  borderRadius: 14,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.54) 100%)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxShadow:
                    "0 3px 8px rgba(0,0,0,0.20), inset 0 -1px 0 rgba(255,255,255,0.0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                  flexShrink: 0,
                }}
                title="BluePrint"
              >
                <img
                  src={blueprintIcon}
                  alt="BluePrint"
                  style={{
                    height: 54,
                    maxWidth: 190,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: 16,
                    fontWeight: 600,
                    color: "rgba(10,18,32,0.9)",
                    letterSpacing: "0.4px",
                  }}
                >
                  test
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ opacity: 0.85, fontSize: 13 }}>Location</div>

              <select
                value={activeLocationId ?? ""}
                onChange={(e) => setActiveLocationId(Number(e.target.value))}
                disabled={locationsLoading || !locations.length}
                style={{
                  height: 36,
                  borderRadius: 10,
                  padding: "0 10px",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.12)",
                  outline: "none",
                }}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id} style={{ color: "black" }}>
                    {l.name}
                  </option>
                ))}
              </select>

              {!!locationsError && (
                <div style={{ color: "rgba(255,120,120,0.95)", fontSize: 12 }}>
                  {locationsError}
                </div>
              )}
            </div>

            <div style={S.pillBar}>
              {TABS.map((t) => (
                <div
                  key={t}
                  style={S.tabPill(activeTab === t)}
                  onClick={() => setActiveTab(t)}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "scale(0.98)";
                    setTimeout(() => {
                      if (e.currentTarget)
                        e.currentTarget.style.transform = "scale(1)";
                    }, 120);
                  }}
                  title={tabLabel(t)}
                >
                  {tabLabel(t)}
                </div>
              ))}
            </div>
          </div>
        </div>

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
              deleteRequirement={deleteRequirement}
            />
          )}

          {activeTab === "records" && (
            <RecordsTab
              S={S}
              crew={crew}
              tracks={tracks}
              trainings={trainings}
              trainingRecords={trainingRecords}
              visibleTrainingRecords={visibleTrainingRecords}
              crewById={crewById}
              trackById={trackById}
              trainingById={trainingById}
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
