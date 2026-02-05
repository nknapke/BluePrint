import { useCallback, useMemo } from "react";
import type {
  Crew,
  Requirement,
  Signoff,
  Track,
  Training,
  TrainingRecord,
} from "../types/domain";

type RequirementWithTrack = Requirement & { trackName: string };
type RequirementWithTraining = Requirement & { trainingName: string };

type RequirementsByTraining = {
  trainingId: number;
  trainingName: string;
  items: RequirementWithTrack[];
};

type RequirementsByTrack = {
  trackId: number;
  trackName: string;
  items: RequirementWithTraining[];
};

type Params = {
  crew: Crew[];
  tracks: Track[];
  trainings: Training[];
  requirements: Requirement[];
  signoffs: Signoff[];
  trainingRecords: TrainingRecord[];

  crewNameFilter: string;
  crewDeptFilter: string;
  crewStatusFilter: string;

  signoffsCrewId: string;
  signoffsTrackId: string;
  signoffsStatusFilter: string;

  recordsCrewId: string;
  recordsTrackId: string;
  recordsTrainingId: string;
};

export function useAppDerived({
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
}: Params) {
  const isQualifiedStatus = useCallback(
    (status: string) => status === "Yes" || status === "Training",
    []
  );

  const crewById = useMemo(() => new Map(crew.map((c) => [c.id, c])), [crew]);
  const trackById = useMemo(
    () => new Map(tracks.map((t) => [t.id, t])),
    [tracks]
  );
  const trainingById = useMemo(
    () => new Map(trainings.map((t) => [t.id, t])),
    [trainings]
  );

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

    const rank = (r: TrainingRecord) => {
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
  }, [
    trainingRecords,
    recordsCrewId,
    recordsTrackId,
    recordsTrainingId,
  ]);

  const requirementsGroupedByTraining = useMemo(() => {
    const map = new Map<number, RequirementsByTraining>();

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
      map.get(r.trainingId)?.items.push({ ...r, trackName });
    }

    for (const g of Array.from(map.values())) {
      g.items.sort((a, b) =>
        String(a.trackName).localeCompare(String(b.trackName))
      );
    }

    return Array.from(map.values()).sort((a, b) =>
      String(a.trainingName).localeCompare(String(b.trainingName))
    );
  }, [requirements, trainingById, trackById]);

  const requirementsGroupedByTrack = useMemo(() => {
    const map = new Map<number, RequirementsByTrack>();

    for (const r of requirements) {
      const trackName = trackById.get(r.trackId)?.name || String(r.trackId);
      const trainingName =
        trainingById.get(r.trainingId)?.name || String(r.trainingId);

      if (!map.has(r.trackId)) {
        map.set(r.trackId, { trackId: r.trackId, trackName, items: [] });
      }
      map.get(r.trackId)?.items.push({ ...r, trainingName });
    }

    for (const g of Array.from(map.values())) {
      g.items.sort((a, b) =>
        String(a.trainingName).localeCompare(String(b.trainingName))
      );
    }

    return Array.from(map.values()).sort((a, b) =>
      String(a.trackName).localeCompare(String(b.trackName))
    );
  }, [requirements, trainingById, trackById]);

  return {
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
  };
}
