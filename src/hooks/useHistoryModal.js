// src/hooks/useHistoryModal.js
import { useCallback, useMemo, useState } from "react";
import { useLocation } from "../context/LocationContext";

export function useHistoryModal({ supabaseGet, supabaseDelete }) {
  const { withLoc, cacheTag } = useLocation();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyContext, setHistoryContext] = useState(null);

  const opts = useMemo(() => ({ cacheTag }), [cacheTag]);

  const loadHistoryForRecord = useCallback(
    async (recordRow) => {
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
        setHistoryError(String(e.message || e));
      } finally {
        setHistoryBusy(false);
      }
    },
    [opts, supabaseGet, withLoc]
  );

  const openHistory = useCallback(
    (recordRow) => {
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
    async (historyRow) => {
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
        setHistoryError(String(e.message || e));
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
