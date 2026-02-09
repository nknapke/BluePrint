import AddCrewModal from "../components/modals/AddCrewModal";
import AddTrackModal from "../components/modals/AddTrackModal";
import AddTrainingModal from "../components/modals/AddTrainingModal";
import MarkCompleteModal from "../components/modals/MarkCompleteModal";
import HistoryModal from "../components/modals/HistoryModal";
import type { Dispatch, SetStateAction } from "react";
import type { ExpiryMode, YesNo } from "./constants";
import type { TrainingGroup } from "../types/domain";

type Props = {
  S: any;
  departments: readonly string[];

  addCrewOpen: boolean;
  closeAddCrew: () => void;
  addingCrew: boolean;
  newCrewName: string;
  setNewCrewName: (value: string) => void;
  newCrewDept: string;
  setNewCrewDept: Dispatch<SetStateAction<string>>;
  newCrewStatus: string;
  setNewCrewStatus: Dispatch<SetStateAction<string>>;
  confirmAddCrewMember: () => void;

  addTrainingOpen: boolean;
  closeAddTraining: () => void;
  addingTraining: boolean;
  newTrainingId: string;
  setNewTrainingId: (value: string) => void;
  newTrainingName: string;
  setNewTrainingName: Dispatch<SetStateAction<string>>;
  newTrainingActive: YesNo;
  setNewTrainingActive: Dispatch<SetStateAction<YesNo>>;
  trainingGroups: TrainingGroup[];
  newTrainingGroupId: string;
  setNewTrainingGroupId: Dispatch<SetStateAction<string>>;
  newTrainingExpiryMode: ExpiryMode;
  setNewTrainingExpiryMode: Dispatch<SetStateAction<ExpiryMode>>;
  newTrainingExpiryWeeks: string;
  setNewTrainingExpiryWeeks: Dispatch<SetStateAction<string>>;
  confirmAddTraining: () => void;

  addTrackOpen: boolean;
  closeAddTrack: () => void;
  addingTrack: boolean;
  newTrackId: string;
  setNewTrackId: Dispatch<SetStateAction<string>>;
  newTrackName: string;
  setNewTrackName: Dispatch<SetStateAction<string>>;
  newTrackActive: YesNo;
  setNewTrackActive: Dispatch<SetStateAction<YesNo>>;
  confirmAddTrack: () => void;

  markCompleteOpen: boolean;
  closeMarkComplete: () => void;
  markCompleteSaving: boolean;
  markCompleteCrewName: string;
  markCompleteTrackName: string;
  markCompleteTrainingName: string;
  markCompleteDate: string;
  setMarkCompleteDate: Dispatch<SetStateAction<string>>;
  markCompleteBy: string;
  setMarkCompleteBy: Dispatch<SetStateAction<string>>;
  markCompleteNotes: string;
  setMarkCompleteNotes: Dispatch<SetStateAction<string>>;
  confirmMarkComplete: () => void;

  historyOpen: boolean;
  closeHistory: () => void;
  historyBusy: boolean;
  historyTitle: string;
  historySubtitle: string;
  historyRows: any[];
  historyError: string;
  refreshHistory: () => void;
  deleteHistoryRow: (row: any) => void;
};

export function AppModals({
  S,
  departments,

  addCrewOpen,
  closeAddCrew,
  addingCrew,
  newCrewName,
  setNewCrewName,
  newCrewDept,
  setNewCrewDept,
  newCrewStatus,
  setNewCrewStatus,
  confirmAddCrewMember,

  addTrainingOpen,
  closeAddTraining,
  addingTraining,
  newTrainingId,
  setNewTrainingId,
  newTrainingName,
  setNewTrainingName,
  newTrainingActive,
  setNewTrainingActive,
  trainingGroups,
  newTrainingGroupId,
  setNewTrainingGroupId,
  newTrainingExpiryMode,
  setNewTrainingExpiryMode,
  newTrainingExpiryWeeks,
  setNewTrainingExpiryWeeks,
  confirmAddTraining,

  addTrackOpen,
  closeAddTrack,
  addingTrack,
  newTrackId,
  setNewTrackId,
  newTrackName,
  setNewTrackName,
  newTrackActive,
  setNewTrackActive,
  confirmAddTrack,

  markCompleteOpen,
  closeMarkComplete,
  markCompleteSaving,
  markCompleteCrewName,
  markCompleteTrackName,
  markCompleteTrainingName,
  markCompleteDate,
  setMarkCompleteDate,
  markCompleteBy,
  setMarkCompleteBy,
  markCompleteNotes,
  setMarkCompleteNotes,
  confirmMarkComplete,

  historyOpen,
  closeHistory,
  historyBusy,
  historyTitle,
  historySubtitle,
  historyRows,
  historyError,
  refreshHistory,
  deleteHistoryRow,
}: Props) {
  return (
    <>
      <AddCrewModal
        S={S}
        isOpen={addCrewOpen}
        onClose={closeAddCrew}
        isBusy={addingCrew}
        departments={departments}
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
        trainingGroups={trainingGroups}
        newTrainingGroupId={newTrainingGroupId}
        setNewTrainingGroupId={setNewTrainingGroupId}
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
        crewName={markCompleteCrewName}
        trackName={markCompleteTrackName}
        trainingName={markCompleteTrainingName}
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
        title={historyTitle}
        subtitle={historySubtitle}
        rows={historyRows}
        error={historyError}
        onRefresh={refreshHistory}
        onDeleteRow={deleteHistoryRow}
      />
    </>
  );
}
