// src/hooks/useMarkComplete.ts
import { useCallback, useMemo, useState } from "react";
import { useLocation } from "../context/LocationContext";

type SupabasePost = (path: string, body: any, opts?: any) => Promise<any>;
type SupabasePatch = (path: string, body: any, opts?: any) => Promise<any>;
type InvalidateMany = (paths: string[]) => void;
type LoadTrainingRecords = (force?: boolean) => Promise<void>;

type RecordRow = {
  id: number;
  locationId?: number | null;
  crewId: number;
  trackId: number;
  trainingId: number;
  crewName?: string;
  trackName?: string;
  trainingName?: string;
};

export function useMarkComplete({
  supabasePost,
  supabasePatch,
  invalidateMany,
  loadTrainingRecords,
}: {
  supabasePost: SupabasePost;
  supabasePatch: SupabasePatch;
  invalidateMany: InvalidateMany;
  loadTrainingRecords: LoadTrainingRecords;
}) {
  const { activeLocationId } = useLocation();

  const [markCompleteOpen, setMarkCompleteOpen] = useState(false);
  const [markCompleteRow, setMarkCompleteRow] = useState<RecordRow | null>(
    null
  );

  const [markCompleteDate, setMarkCompleteDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [markCompleteBy, setMarkCompleteBy] = useState("");
  const [markCompleteNotes, setMarkCompleteNotes] = useState("");

  const [markCompleteSaving, setMarkCompleteSaving] = useState(false);

  const defaultDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const openMarkComplete = useCallback(
    (recordRow: RecordRow) => {
      setMarkCompleteRow(recordRow);
      setMarkCompleteDate(defaultDate);
      setMarkCompleteBy("");
      setMarkCompleteNotes("");
      setMarkCompleteOpen(true);
    },
    [defaultDate]
  );

  const closeMarkComplete = useCallback(() => {
    if (markCompleteSaving) return;
    setMarkCompleteOpen(false);
    setMarkCompleteRow(null);
  }, [markCompleteSaving]);

  const confirmMarkComplete = useCallback(async () => {
    if (!markCompleteRow) return;

    if (!markCompleteDate) {
      alert("Pick a completed date.");
      return;
    }

    try {
      setMarkCompleteSaving(true);

      const by = (markCompleteBy || "").trim();
      const notes = (markCompleteNotes || "").trim();

      await supabasePost("/rest/v1/crew_training_record_history", {
        location_id: markCompleteRow.locationId ?? activeLocationId,
        record_id: markCompleteRow.id,
        crew_id: markCompleteRow.crewId,
        track_id: markCompleteRow.trackId,
        training_id: markCompleteRow.trainingId,
        completed_on: markCompleteDate,
        completed_by: by || null,
        notes: notes || null,
      });

      const patch: {
        last_completed: string;
        is_record_active: boolean;
        signoff_by?: string;
        notes?: string;
      } = {
        last_completed: markCompleteDate,
        is_record_active: true,
      };
      if (by) patch.signoff_by = by;
      if (notes) patch.notes = notes;

      await supabasePatch(
        `/rest/v1/crew_training_records?id=eq.${markCompleteRow.id}`,
        patch
      );

      invalidateMany([
        "/rest/v1/crew_training_records",
        "/rest/v1/v_training_dashboard_with_signer",
      ]);

      await loadTrainingRecords(true);

      setMarkCompleteOpen(false);
      setMarkCompleteRow(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      alert("Failed to mark training complete:\n" + message);
    } finally {
      setMarkCompleteSaving(false);
    }
  }, [
    activeLocationId,
    invalidateMany,
    loadTrainingRecords,
    markCompleteBy,
    markCompleteDate,
    markCompleteNotes,
    markCompleteRow,
    supabasePatch,
    supabasePost,
  ]);

  return {
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
  };
}
