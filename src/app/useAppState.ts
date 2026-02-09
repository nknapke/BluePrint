import { useState } from "react";
import type {
  Crew,
  Department,
  Location,
  Requirement,
  Signoff,
  Track,
  Training,
  TrainingGroup,
  TrainingRecord,
} from "../types/domain";
import {
  DEFAULT_DEPARTMENTS,
  type Dept,
  type ExpiryMode,
  type ReqViewMode,
  type TabId,
  type YesNo,
} from "./constants";

export function useAppState() {
  const [activeTab, setActiveTab] = useState<TabId>("crew");

  const [departments, setDepartments] = useState<Department[]>(
    DEFAULT_DEPARTMENTS.map((name) => ({ id: null, name, active: true }))
  );
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState("");
  const [departmentsFromDb, setDepartmentsFromDb] = useState(false);

  // Locations list (for the dropdown)
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState("");

  // Crew
  const [crew, setCrew] = useState<Crew[]>([]);
  const [crewLoading, setCrewLoading] = useState(true);
  const [crewError, setCrewError] = useState("");

  // Tracks
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracksError, setTracksError] = useState("");

  // Trainings
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainingsLoading, setTrainingsLoading] = useState(true);
  const [trainingsError, setTrainingsError] = useState("");

  // Training Groups
  const [trainingGroups, setTrainingGroups] = useState<TrainingGroup[]>([]);
  const [trainingGroupsLoading, setTrainingGroupsLoading] = useState(true);
  const [trainingGroupsError, setTrainingGroupsError] = useState("");

  // Requirements
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [requirementsLoading, setRequirementsLoading] = useState(true);
  const [requirementsError, setRequirementsError] = useState("");

  // Signoffs
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [signoffsLoading, setSignoffsLoading] = useState(true);
  const [signoffsError, setSignoffsError] = useState("");

  // Training Records
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
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
  const [editingCrewId, setEditingCrewId] = useState<number | null>(null);
  const [editCrewName, setEditCrewName] = useState("");
  const [editCrewDept, setEditCrewDept] = useState("");
  const [editCrewStatus, setEditCrewStatus] = useState("Active");
  const [editCrewSaving, setEditCrewSaving] = useState(false);

  // Inline edit (training definitions)
  const [editingTrainingId, setEditingTrainingId] = useState<number | null>(
    null
  );
  const [editTrainingName, setEditTrainingName] = useState("");
  const [editTrainingActive, setEditTrainingActive] = useState<YesNo>("TRUE");
  const [editTrainingSaving, setEditTrainingSaving] = useState(false);
  const [editTrainingExpiryWeeks, setEditTrainingExpiryWeeks] = useState("");
  const [editTrainingGroupId, setEditTrainingGroupId] = useState("");

  // Inline edit (tracks)
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [editTrackName, setEditTrackName] = useState("");
  const [editTrackActive, setEditTrackActive] = useState<YesNo>("TRUE");
  const [editTrackSaving, setEditTrackSaving] = useState(false);

  // Add Training Requirement
  const [reqNewTrackId, setReqNewTrackId] = useState("ALL");
  const [reqNewTrainingId, setReqNewTrainingId] = useState("ALL");
  const [reqNewActive, setReqNewActive] = useState<YesNo>("TRUE");
  const [reqAdding, setReqAdding] = useState(false);

  // Requirements view + accordion
  const [requirementsViewMode, setRequirementsViewMode] =
    useState<ReqViewMode>("training");
  const [expandedTrainingIds, setExpandedTrainingIds] = useState<Set<number>>(
    () => new Set()
  );
  const [expandedReqTrackIds, setExpandedReqTrackIds] = useState<Set<number>>(
    () => new Set()
  );

  // Add Training modal
  const [addTrainingOpen, setAddTrainingOpen] = useState(false);
  const [newTrainingId, setNewTrainingId] = useState("");
  const [newTrainingName, setNewTrainingName] = useState("");
  const [newTrainingActive, setNewTrainingActive] = useState<YesNo>("TRUE");
  const [newTrainingExpiryMode, setNewTrainingExpiryMode] =
    useState<ExpiryMode>("NEVER");
  const [newTrainingExpiryWeeks, setNewTrainingExpiryWeeks] = useState("");
  const [newTrainingGroupId, setNewTrainingGroupId] = useState("");
  const [addingTraining, setAddingTraining] = useState(false);

  // Add Track modal
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [newTrackId, setNewTrackId] = useState("");
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackActive, setNewTrackActive] = useState<YesNo>("TRUE");
  const [addingTrack, setAddingTrack] = useState(false);

  // Add Crew Member modal
  const [addCrewOpen, setAddCrewOpen] = useState(false);
  const [newCrewName, setNewCrewName] = useState("");
  const [newCrewDept, setNewCrewDept] = useState<Dept>(
    DEFAULT_DEPARTMENTS[0] || ""
  );
  const [newCrewStatus, setNewCrewStatus] = useState("Active");
  const [addingCrew, setAddingCrew] = useState(false);

  return {
    activeTab,
    setActiveTab,

    departments,
    setDepartments,
    departmentsLoading,
    setDepartmentsLoading,
    departmentsError,
    setDepartmentsError,
    departmentsFromDb,
    setDepartmentsFromDb,

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
  };
}
