// src/hooks/useHistoryModal.ts
import { useCallback, useMemo, useState } from "react";
import { useLocation } from "../context/LocationContext";

type SupabaseGet = (path: string, opts?: any) => Promise<any>;
type SupabaseDelete = (path: string, opts?: any) => Promise<any>;
type RecordRow = { id?: number; [key: string]: any };
type HistoryRow = { id?: number; [key: string]: any };

function getErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export function useHistoryModal({
  supabaseGet,
  supabaseDelete,
}: {
  supabaseGet: SupabaseGet;
  supabaseDelete: SupabaseDelete;
}) {
  const { withLoc, cacheTag } = useLocation();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyContext, setHistoryContext] = useState<RecordRow | null>(null);

  const opts = useMemo(() => ({ cacheTag }), [cacheTag]);

  const loadHistoryForRecord = useCallback(
    async (recordRow: RecordRow | null) => {
      if (!recordRow?.id) return;

      setHistoryBusy(true);
      setHistoryError("");

      try {
        const data = await supabaseGet(
          withLoc(
            `/rest/v1/crew_training_record_history?record_id=eq.${recordRow.id}&select=id,completed_on,completed_by,notes,created_at&order=completed_on.desc,created_at.desc`
          ),
          opts
        );
        setHistoryRows(data || []);
      } catch (e) {
        setHistoryError(getErrorMessage(e));
      } finally {
        setHistoryBusy(false);
      }
    },
    [opts, supabaseGet, withLoc]
  );

  const openHistory = useCallback(
    (recordRow: RecordRow | null) => {
      setHistoryContext(recordRow);
      setHistoryRows([]);
      setHistoryError("");
      setHistoryOpen(true);
      loadHistoryForRecord(recordRow);
    },
    [loadHistoryForRecord]
  );

  const closeHistory = useCallback(() => {
    if (historyBusy) return;
    setHistoryOpen(false);
    setHistoryContext(null);
  }, [historyBusy]);

  const deleteHistoryRow = useCallback(
    async (historyRow: HistoryRow) => {
      if (!historyRow?.id) return;

      const ok = window.confirm("Delete this history entry?");
      if (!ok) return;

      try {
        setHistoryBusy(true);
        setHistoryError("");

        await supabaseDelete(
          `/rest/v1/crew_training_record_history?id=eq.${historyRow.id}`
        );

        await loadHistoryForRecord(historyContext);
      } catch (e) {
        setHistoryError(getErrorMessage(e));
      } finally {
        setHistoryBusy(false);
      }
    },
    [historyContext, loadHistoryForRecord, supabaseDelete]
  );

  const refreshHistory = useCallback(() => {
    loadHistoryForRecord(historyContext);
  }, [historyContext, loadHistoryForRecord]);

  return {
    historyOpen,
    historyBusy,
    historyError,
    historyRows,
    historyContext,
    openHistory,
    closeHistory,
    deleteHistoryRow,
    refreshHistory,
  };
}
