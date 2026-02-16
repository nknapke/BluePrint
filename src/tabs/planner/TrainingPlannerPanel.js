import { useCallback, useEffect, useMemo, useState } from "react";

import ExecuteDayModal from "./ExecuteDayModal";
import ManagePlansModal from "./ManagePlansModal";
import PlannerInfoModal from "./PlannerInfoModal";
import ReopenDayModal from "./ReopenDayModal";
import {
  formatShortDate,
  formatShortWeekdayDate,
  isoDate,
} from "../../utils/dates";

/* ---------------- helpers ---------------- */

function todayLocalISO() {
  return isoDate(new Date());
}

function clampText(s, n = 180) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

function formatPrintDate(dateISO) {
  if (!dateISO) return "";
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isTruthyFlag(value) {
  return value === true || value === "true" || value === "t" || value === 1;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseReasoningSummary(summary) {
  const text = String(summary || "");
  if (!text.includes("=")) return null;
  const getNum = (pattern) => {
    const match = text.match(pattern);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isNaN(value) ? null : value;
  };
  const score = getNum(/score=([0-9.]+)/i);
  const people = getNum(/people=([0-9]+)/i);
  const extreme = getNum(/extreme=([0-9]+)/i);
  const windowDays = getNum(/window=([0-9]+)/i);
  if (score === null && people === null && extreme === null && windowDays === null) {
    return null;
  }
  return { score, people, extreme, windowDays };
}

function buildCompletionLabel(simDate, actualDate) {
  if (!simDate) return "Up to Date";
  const simTime = new Date(`${simDate}T00:00:00`).getTime();
  const actualTime = actualDate
    ? new Date(`${actualDate}T00:00:00`).getTime()
    : null;
  const isPredictive =
    actualTime === null || Number.isNaN(actualTime)
      ? true
      : simTime > actualTime;
  const prefix = isPredictive ? "Will be Completed on" : "Last Completed";
  return `Up to Date — ${prefix} ${formatShortDate(simDate)}`;
}

function buildAttendeeReasonLines(attendee) {
  const lines = [];
  const hasNoPrior = attendee.noPriorTraining === true;
  const hasOutOfDate = attendee.isOutOfDate === true && !hasNoPrior;

  if (hasOutOfDate) lines.push({ text: "Out of Date", tone: "bad" });
  if (hasNoPrior) {
    lines.push({ text: "No Prior Training History", tone: "bad" });
  }
  if (attendee.isExtremeOverdue) {
    lines.push({ text: "30+ Days Overdue", tone: "bad" });
  }

  if (lines.length === 0) {
    lines.push({
      text: buildCompletionLabel(
        attendee.simulatedLastCompleted || null,
        attendee.actualLastCompleted || null
      ),
      tone: "good",
      bold: true,
    });
  }

  return lines;
}

function formatReasoningSummaryParts(day) {
  const parsed = parseReasoningSummary(day?.reasoning_summary);
  const priorityScore =
    day?.priority_score ?? (parsed ? parsed.score : null);
  const requiredCrew = day?.required_crew_count ?? null;
  const scheduledCrew = day?.scheduled_crew_count ?? null;
  const updateCrew =
    day?.update_crew_count ??
    day?.people_affected ??
    (parsed ? parsed.people : null);
  const overdueCrew = day?.overdue_crew_count ?? null;
  const neverTrained = day?.never_trained_count ?? null;
  const extremeOverdue =
    day?.extreme_overdue_crew_count ?? (parsed ? parsed.extreme : null);

  const fmtScore =
    priorityScore === null
      ? null
      : Number.isInteger(priorityScore)
      ? priorityScore
      : Number(priorityScore).toFixed(1);

  const headline =
    fmtScore === null
      ? "Highest impact for this day's crew"
      : `Highest impact for this day's crew: Priority score ${fmtScore}`;

  const lines = [];
  if (scheduledCrew !== null && Number(scheduledCrew) > 0) {
    lines.push(
      `${scheduledCrew} Crew Member${
        scheduledCrew === 1 ? "" : "s"
      } - Scheduled`
    );
  }
  if (requiredCrew !== null && Number(requiredCrew) > 0) {
    lines.push(
      `${requiredCrew} Crew Member${
        requiredCrew === 1 ? "" : "s"
      } - Need Update`
    );
  }
  if (overdueCrew !== null && Number(overdueCrew) > 0) {
    lines.push(
      `${overdueCrew} Crew Member${
        overdueCrew === 1 ? "" : "s"
      } - Out of Date`
    );
  } else if (updateCrew !== null && Number(updateCrew) > 0) {
    lines.push(
      `${updateCrew} Crew Member${updateCrew === 1 ? "" : "s"} - Out of Date`
    );
  }
  if (neverTrained !== null && Number(neverTrained) > 0) {
    lines.push(
      `${neverTrained} Crew Member${neverTrained === 1 ? "" : "s"} - No Prior Training`
    );
  }
  if (extremeOverdue !== null && Number(extremeOverdue) > 0) {
    lines.push(
      `${extremeOverdue} Crew Member${
        extremeOverdue === 1 ? "" : "s"
      } - 30+ Days Overdue`
    );
  }
  // Intentionally omit look-ahead window from the UI summary.

  if (lines.length === 0) {
    return { headline: clampText(day?.reasoning_summary), lines: [] };
  }

  return { headline, lines };
}

/* ---------------- TrainingPlannerPanel ---------------- */

export default function TrainingPlannerPanel({
  S,
  locId,
  supabaseRpc,
  supabaseGet,
  supabasePatch,
  supabasePost,
  supabaseDelete,
  trainingGroups = [],
  refreshSignal = 0,
}) {
  /* ---------- generate ---------- */
  const [startDate, setStartDate] = useState(() => {
    return todayLocalISO();
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [planId, setPlanId] = useState(null);
  const [genError, setGenError] = useState("");
  const [planList, setPlanList] = useState([]);
  const [planListLoading, setPlanListLoading] = useState(false);
  const [planListError, setPlanListError] = useState("");
  const [planStatusBusy, setPlanStatusBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageBusyId, setManageBusyId] = useState(null);
  const [manageError, setManageError] = useState("");

  /* ---------- days ---------- */
  const [days, setDays] = useState([]);
  const [daysLoading, setDaysLoading] = useState(false);
  const [daysError, setDaysError] = useState("");
  const [selectedDayId, setSelectedDayId] = useState(null);

  /* ---------- attendees ---------- */
  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesError, setAttendeesError] = useState("");
  const [savingCrewId, setSavingCrewId] = useState(null);

  /* ---------- execute modal ---------- */
  const [executeOpen, setExecuteOpen] = useState(false);
  const [executeBusy, setExecuteBusy] = useState(false);
  const [executeCompletedBy, setExecuteCompletedBy] = useState("");
  const [executeCompletedOn, setExecuteCompletedOn] = useState("");
  const [executeNotes, setExecuteNotes] = useState("");
  const [executeError, setExecuteError] = useState("");
  const [executeRows, setExecuteRows] = useState([]);
  const [executeRowsLoading, setExecuteRowsLoading] = useState(false);
  const [executeRowsError, setExecuteRowsError] = useState("");

  /* ---------- info modal ---------- */
  const [infoOpen, setInfoOpen] = useState(false);

  /* ---------- reopen modal ---------- */
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenBusy, setReopenBusy] = useState(false);
  const [reopenConfirmed, setReopenConfirmed] = useState(false);
  const [reopenBy, setReopenBy] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState("");

  const trainingGroupById = useMemo(
    () => new Map(trainingGroups.map((g) => [Number(g.id), g])),
    [trainingGroups]
  );

  const selectedDay = useMemo(
    () => days.find((d) => d.id === selectedDayId) || null,
    [days, selectedDayId]
  );

  const selectedPlan = useMemo(
    () => planList.find((p) => Number(p.id) === Number(planId)) || null,
    [planList, planId]
  );

  const attendeeCounts = useMemo(() => {
    let included = 0;
    let excluded = 0;
    for (const a of attendees) {
      if (a.included) included += 1;
      else excluded += 1;
    }
    return { included, excluded };
  }, [attendees]);

  /* ---------------- data loading ---------------- */

  const loadPlanList = useCallback(async () => {
    if (!locId) return;
    setPlanListLoading(true);
    setPlanListError("");

    try {
      const rows = await supabaseGet(
        `/rest/v1/training_plans?select=id,start_date,end_date,status,title,updated_at&location_id=eq.${locId}&order=start_date.desc`,
        { bypassCache: true }
      );
      setPlanList(rows || []);
    } catch (e) {
      setPlanListError(String(e?.message || e));
      setPlanList([]);
    } finally {
      setPlanListLoading(false);
    }
  }, [locId, supabaseGet]);

  const loadDays = useCallback(async () => {
    if (!planId) return;
    setDaysLoading(true);
    setDaysError("");

    try {
      const rows = await supabaseGet(
        `/rest/v1/training_plan_days?select=id,plan_date,training_group_id,status,people_affected,extreme_overdue_count,reasoning_summary,required_crew_count,update_crew_count,overdue_crew_count,never_trained_count,extreme_overdue_crew_count,look_ahead_window_days,priority_score,scheduled_crew_count&plan_id=eq.${planId}&order=plan_date.asc`
      );
      const dayRows = rows || [];
      if (!dayRows.length) {
        setDays([]);
        return;
      }

      const dayIds = dayRows.map((d) => d.id).filter(Boolean);
      let dayStats = new Map();

      if (dayIds.length) {
        const attendeeRows = await supabaseGet(
          `/rest/v1/v_plan_day_attendee_review?select=day_id,included,is_working,is_out_of_date,no_prior_training,is_extreme_overdue&day_id=in.(${dayIds.join(
            ","
          )})`,
          { bypassCache: true }
        );

        for (const r of attendeeRows || []) {
          if (!r?.day_id) continue;
          if (!isTruthyFlag(r.included) || !isTruthyFlag(r.is_working)) continue;

          const noPrior = isTruthyFlag(r.no_prior_training);
          const outOfDate = isTruthyFlag(r.is_out_of_date) && !noPrior;
          const extreme = isTruthyFlag(r.is_extreme_overdue);

          const current = dayStats.get(r.day_id) || {
            scheduled: 0,
            needUpdate: 0,
            outOfDate: 0,
            noPrior: 0,
            extreme: 0,
          };

          current.scheduled += 1;
          if (outOfDate) current.outOfDate += 1;
          if (noPrior) current.noPrior += 1;
          if (extreme) current.extreme += 1;
          if (outOfDate || noPrior || extreme) current.needUpdate += 1;

          dayStats.set(r.day_id, current);
        }
      }

      setDays(
        dayRows.map((d) => {
          const stats = dayStats.get(d.id);
          return {
            ...d,
            scheduled_crew_count:
              stats?.scheduled ?? d.scheduled_crew_count ?? null,
            required_crew_count:
              stats?.needUpdate ?? d.required_crew_count ?? d.people_affected ?? null,
            people_affected:
              stats?.needUpdate ?? d.people_affected ?? d.required_crew_count ?? null,
            update_crew_count:
              stats?.outOfDate ?? d.update_crew_count ?? d.overdue_crew_count ?? null,
            overdue_crew_count:
              stats?.outOfDate ?? d.overdue_crew_count ?? d.update_crew_count ?? null,
            never_trained_count: stats?.noPrior ?? d.never_trained_count ?? null,
            extreme_overdue_crew_count:
              stats?.extreme ?? d.extreme_overdue_crew_count ?? null,
          };
        })
      );
    } catch (e) {
      setDaysError(String(e?.message || e));
    } finally {
      setDaysLoading(false);
    }
  }, [planId, supabaseGet]);

  const loadAttendees = useCallback(async () => {
    if (!selectedDayId) return;
    setAttendeesLoading(true);
    setAttendeesError("");
    setAttendees([]);

    try {
      const rows = await supabaseGet(
        `/rest/v1/v_plan_day_attendee_review?select=attendee_id,crew_id,crew_name,crew_status,included,source,is_working,track_id,track_name,is_out_of_date,no_prior_training,is_extreme_overdue,simulated_last_completed,actual_last_completed&day_id=eq.${selectedDayId}&order=crew_name.asc`
      );

      setAttendees(
        (rows || []).map((r) => ({
          rowId: r.attendee_id,
          crewId: r.crew_id,
          name: r.crew_name || "",
          crewStatus: r.crew_status || "",
          included: r.included,
          source: r.source,
          trackId: r.track_id ?? null,
          trackName: r.track_name || "",
          isOutOfDate: r.is_out_of_date ?? false,
          noPriorTraining: r.no_prior_training ?? false,
          isExtremeOverdue: r.is_extreme_overdue ?? false,
          simulatedLastCompleted: r.simulated_last_completed || null,
          actualLastCompleted: r.actual_last_completed || null,
        }))
      );
    } catch (e) {
      setAttendeesError(String(e?.message || e));
    } finally {
      setAttendeesLoading(false);
    }
  }, [selectedDayId, supabaseGet]);

  const loadExecuteRows = useCallback(async () => {
    if (!selectedDayId) return;
    setExecuteRowsLoading(true);
    setExecuteRowsError("");

    try {
      const rows = await supabaseGet(
        `/rest/v1/v_plan_day_attendee_review?select=attendee_id,crew_id,crew_name,crew_status,included,source,is_working,track_id,track_name,is_out_of_date,no_prior_training,is_extreme_overdue,simulated_last_completed,actual_last_completed&day_id=eq.${selectedDayId}&order=crew_name.asc`
      );
      setExecuteRows(rows || []);
    } catch (e) {
      setExecuteRowsError(String(e?.message || e));
    } finally {
      setExecuteRowsLoading(false);
    }
  }, [selectedDayId, supabaseGet]);

  async function generatePlan(nextStartDate) {
    if (!locId) return;

    setIsGenerating(true);
    setGenError("");

    try {
      const effectiveStart = nextStartDate || startDate;
      if (nextStartDate) setStartDate(nextStartDate);
      const existing = planList.find((p) => p.start_date === effectiveStart);
      if (existing?.status === "Posted") {
        const ok = window.confirm(
          "This plan is Posted. Regenerating will overwrite the schedule and set it back to Draft. Continue?"
        );
        if (!ok) {
          setIsGenerating(false);
          return;
        }
      }

      setPlanId(null);
      setDays([]);
      setSelectedDayId(null);

      await supabaseRpc("generate_training_plan_v2", {
        p_location_id: Number(locId),
        p_start_date: effectiveStart,
      });

      const rows = await supabaseGet(
        `/rest/v1/training_plans?select=id&location_id=eq.${locId}&start_date=eq.${effectiveStart}&order=created_at.desc&limit=1`
      );

      if (rows?.[0]?.id) setPlanId(rows[0].id);
      await loadPlanList();
    } catch (e) {
      setGenError(String(e?.message || e));
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    loadPlanList();
  }, [loadPlanList]);

  useEffect(() => {
    setPlanId(null);
    setPlanList([]);
    setPlanListError("");
    setDays([]);
    setSelectedDayId(null);
  }, [locId]);

  useEffect(() => {
    if (isGenerating) return;
    if (!planId && planList.length > 0) {
      const first = planList[0];
      setPlanId(first.id);
      if (first.start_date) setStartDate(first.start_date);
    }
  }, [planId, planList, isGenerating]);

  useEffect(() => {
    loadDays();
  }, [loadDays]);

  useEffect(() => {
    loadAttendees();
  }, [loadAttendees]);

  useEffect(() => {
    if (!executeOpen) return;
    if (!executeCompletedOn) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setExecuteCompletedOn(`${yyyy}-${mm}-${dd}`);
    }
    loadExecuteRows();
  }, [executeOpen, executeCompletedOn, loadExecuteRows]);

  useEffect(() => {
    if (!refreshSignal) return;
    if (planId) loadDays();
    if (selectedDayId) loadAttendees();
  }, [refreshSignal, planId, selectedDayId, loadDays, loadAttendees]);

  /* ---------------- actions ---------------- */

  const handleSelectPlan = (value) => {
    if (!value) return;
    const nextId = Number(value);
    if (!Number.isFinite(nextId)) return;
    const nextPlan = planList.find((p) => Number(p.id) === nextId);
    setPlanId(nextId);
    setSelectedDayId(null);
    setDays([]);
    if (nextPlan?.start_date) setStartDate(nextPlan.start_date);
  };

  const updatePlanStatus = async (nextStatus) => {
    if (!selectedPlan || planStatusBusy) return;
    setPlanStatusBusy(true);
    setPlanListError("");

    try {
      await supabasePatch(`/rest/v1/training_plans?id=eq.${selectedPlan.id}`, {
        status: nextStatus,
      });
      setPlanList((prev) =>
        prev.map((p) =>
          Number(p.id) === Number(selectedPlan.id)
            ? { ...p, status: nextStatus }
            : p
        )
      );
    } catch (e) {
      setPlanListError(String(e?.message || e));
    } finally {
      setPlanStatusBusy(false);
    }
  };

  const deletePlan = async (plan) => {
    if (!plan?.id || !supabaseDelete) return;
    setManageBusyId(plan.id);
    setManageError("");

    try {
      const dayRows = await supabaseGet(
        `/rest/v1/training_plan_days?select=id&plan_id=eq.${plan.id}`
      );
      const dayIds = (dayRows || []).map((d) => d.id).filter(Boolean);
      if (dayIds.length) {
        await supabaseDelete(
          `/rest/v1/training_plan_day_attendees?day_id=in.(${dayIds.join(",")})`
        );
      }
      await supabaseDelete(`/rest/v1/training_plan_days?plan_id=eq.${plan.id}`);
      await supabaseDelete(`/rest/v1/training_plans?id=eq.${plan.id}`);

      setPlanList((prev) => prev.filter((p) => Number(p.id) !== Number(plan.id)));
      if (Number(planId) === Number(plan.id)) {
        setPlanId(null);
        setDays([]);
        setSelectedDayId(null);
      }
      await loadPlanList();
    } catch (e) {
      setManageError(String(e?.message || e));
    } finally {
      setManageBusyId(null);
    }
  };

  async function setAttendeeIncluded(rowId, crewId, nextIncluded) {
    setSavingCrewId(crewId);

    try {
      await supabasePatch(
        `/rest/v1/training_plan_day_attendees?id=eq.${rowId}`,
        {
          included: nextIncluded,
          source: nextIncluded ? "ManualAdd" : "ManualRemove",
        }
      );

      setAttendees((prev) =>
        prev.map((x) =>
          x.rowId === rowId ? { ...x, included: nextIncluded } : x
        )
      );
      setExecuteRows((prev) =>
        prev.map((x) =>
          x.attendee_id === rowId
            ? { ...x, included: nextIncluded, source: nextIncluded ? "ManualAdd" : "ManualRemove" }
            : x
        )
      );
    } finally {
      setSavingCrewId(null);
    }
  }

  async function toggleAttendee(a) {
    await setAttendeeIncluded(a.rowId, a.crewId, !a.included);
  }

  async function toggleExecuteRow(row) {
    if (!row?.attendee_id || !row?.crew_id) return;
    await setAttendeeIncluded(row.attendee_id, row.crew_id, !row.included);
  }

  async function executeDay() {
    if (!executeCompletedBy.trim()) return;

    setExecuteBusy(true);
    setExecuteError("");

    try {
      await supabaseRpc("execute_training_plan_day", {
        p_day_id: Number(selectedDayId),
        p_completed_on: executeCompletedOn || null,
        p_completed_by: executeCompletedBy,
        p_notes: executeNotes || null,
      });

      setExecuteOpen(false);
      loadDays();
    } catch (e) {
      setExecuteError(String(e?.message || e));
    } finally {
      setExecuteBusy(false);
    }
  }

  async function reopenDay() {
    if (!reopenConfirmed || !reopenBy.trim() || !reopenReason.trim()) return;

    setReopenBusy(true);
    setReopenError("");

    try {
      await supabaseRpc("reopen_training_plan_day", {
        p_day_id: Number(selectedDayId),
        p_reopened_by: reopenBy,
        p_reason: reopenReason,
      });

      setReopenOpen(false);
    } catch (e) {
      setReopenError(String(e?.message || e));
    } finally {
      setReopenBusy(false);
    }
  }

  /* ---------------- render ---------------- */

  const planRangeLabel = selectedPlan?.start_date
    ? `${formatPrintDate(selectedPlan.start_date)}${
        selectedPlan?.end_date ? ` – ${formatPrintDate(selectedPlan.end_date)}` : ""
      }`
    : "";

  const handlePrint = async () => {
    if (!planId || printBusy) return;
    setPrintBusy(true);
    const title = selectedPlan?.title || "Training Plan";
    const status = selectedPlan?.status || "Draft";
    const header = planRangeLabel ? `${planRangeLabel} (${status})` : status;
    try {
      const printDays = await supabaseGet(
        `/rest/v1/training_plan_days?select=id,plan_date,training_group_id,status,people_affected,extreme_overdue_count,reasoning_summary,required_crew_count,update_crew_count,overdue_crew_count,never_trained_count,extreme_overdue_crew_count,look_ahead_window_days,priority_score,scheduled_crew_count&plan_id=eq.${planId}&order=plan_date.asc`,
        { bypassCache: true }
      );
      const dayRows = Array.isArray(printDays) ? printDays : [];
      if (!dayRows.length) return;
      const dayIds = dayRows.map((d) => d.id).filter(Boolean);
      const attendeesByDay = new Map();
      const groupTrainingMap = new Map();

      if (dayIds.length) {
        const rows = await supabaseGet(
          `/rest/v1/v_plan_day_attendee_review?select=day_id,crew_name,track_name,track_id,included,is_working,is_out_of_date,no_prior_training,is_extreme_overdue,simulated_last_completed,actual_last_completed&day_id=in.(${dayIds.join(
            ","
          )})&order=crew_name.asc`,
          { bypassCache: true }
        );

        for (const r of rows || []) {
          if (!r || !r.day_id) continue;
          if (!r.included || !r.is_working) continue;
          const list = attendeesByDay.get(r.day_id) || [];
          list.push(r);
          attendeesByDay.set(r.day_id, list);
        }
      }

      const groupIds = Array.from(
        new Set(dayRows.map((d) => d.training_group_id).filter(Boolean))
      );

      if (locId && groupIds.length) {
        const tRows = await supabaseGet(
          `/rest/v1/training_definitions?select=id,training_name,training_group_id,is_training_active,location_id&location_id=eq.${Number(
            locId
          )}&training_group_id=in.(${groupIds.join(
            ","
          )})&is_training_active=eq.true&order=training_name.asc`,
          { bypassCache: true }
        );

        for (const t of tRows || []) {
          if (!t?.training_group_id) continue;
          const list = groupTrainingMap.get(t.training_group_id) || [];
          list.push(t.training_name || "Unnamed training");
          groupTrainingMap.set(t.training_group_id, list);
        }
      }

      const rowsHtml = dayRows
        .map((d) => {
          const groupName = trainingGroupById.get(d.training_group_id)?.name;
          const scheduledCrewCount =
            d.scheduled_crew_count ?? d.scheduledCrewCount ?? null;
          const noCrewScheduled =
            scheduledCrewCount !== null && Number(scheduledCrewCount) === 0;
          const noRequiredTraining = Number(d.people_affected || 0) === 0;
          const requirementLabel = noCrewScheduled
            ? "No Crew"
            : noRequiredTraining
            ? "Optional"
            : "Required";

          const crewList = (attendeesByDay.get(d.id) || []).slice();
          crewList.sort((a, b) => {
            const aTrack = (a.track_name || a.track_id || "").toString();
            const bTrack = (b.track_name || b.track_id || "").toString();
            const trackCmp = aTrack.localeCompare(bTrack, undefined, {
              sensitivity: "base",
              numeric: true,
            });
            if (trackCmp !== 0) return trackCmp;
            const aName = (a.crew_name || "").toString();
            const bName = (b.crew_name || "").toString();
            return aName.localeCompare(bName, undefined, {
              sensitivity: "base",
              numeric: true,
            });
          });
          const crewHtml = crewList.length
            ? crewList
                .map((r) => {
                  const track = r.track_name || r.track_id || "No track";
                  const needsUpdate =
                    isTruthyFlag(r.is_out_of_date) ||
                    isTruthyFlag(r.no_prior_training) ||
                    isTruthyFlag(r.is_extreme_overdue);
                  const lineText = `${escapeHtml(
                    r.crew_name || "Unknown"
                  )} — ${escapeHtml(String(track).toUpperCase())}`;
                  return needsUpdate
                    ? `<div class="crew-line"><span class="crew-need">${lineText}</span></div>`
                    : `<div class="crew-line">${lineText}</div>`;
                })
                .join("")
            : `<div class="crew-none">No crew scheduled</div>`;

          const trainingList = d.training_group_id
            ? groupTrainingMap.get(d.training_group_id) || []
            : [];
          const trainingHtml = trainingList.length
            ? `<ul class="group-list">${trainingList
                .map((name) => `<li>${escapeHtml(name)}</li>`)
                .join("")}</ul>`
            : `<div class="crew-none">No trainings listed</div>`;

          const scoreVal =
            d.priority_score !== null && d.priority_score !== undefined
              ? Number(d.priority_score)
              : null;
          const scoreText =
            scoreVal !== null && Number.isFinite(scoreVal)
              ? Number.isInteger(scoreVal)
                ? scoreVal
                : scoreVal.toFixed(1)
              : null;

          const requirementHeader =
            scoreText !== null
              ? `${requirementLabel.toUpperCase()} [ Score = ${scoreText} ]`
              : requirementLabel.toUpperCase();

          const reasonParts = formatReasoningSummaryParts(d);
          let reasonHtml = "";
          if (noCrewScheduled) {
            reasonHtml = `<div class="reason-line">No Crew Members Scheduled for this Day</div>`;
          } else if (noRequiredTraining) {
            reasonHtml =
              `<div class="reason-line">All Trainings Complete for Today's Crew Members — Optional Trainings Today by Request</div>`;
          } else {
            reasonHtml += `<div class="reason-line">${escapeHtml(reasonParts.headline)}</div>`;
            if (reasonParts.lines.length) {
              reasonHtml += `<div class="reason-sub">${reasonParts.lines
                .map((line) => `<div class="reason-line">- ${escapeHtml(line)}</div>`)
                .join("")}</div>`;
            } else if (d.reasoning_summary) {
              reasonHtml += `<div class="reason-sub"><div class="reason-line">- ${escapeHtml(
                clampText(d.reasoning_summary, 260)
              )}</div></div>`;
            }
          }

          if (!reasonHtml) {
            reasonHtml = `<div class="reason-none">No urgent reasons</div>`;
          }

          return `
            <tr>
              <td>${escapeHtml(formatShortWeekdayDate(d.plan_date))}</td>
              <td>
                <div class="group-title">${escapeHtml(
                  groupName || "No required training"
                )}</div>
                ${trainingHtml}
              </td>
              <td>${crewHtml}</td>
              <td>
                <div class="reason-title">${escapeHtml(requirementHeader)}</div>
                ${reasonHtml}
              </td>
            </tr>
          `;
        })
        .join("");

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 22px; margin: 0 0 6px; }
      h2 { font-size: 14px; font-weight: 600; margin: 0 0 20px; color: #555; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { padding: 10px 8px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
      th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }
      .group-title { font-weight: 700; margin-bottom: 6px; }
      .group-list { margin: 0; padding-left: 18px; }
      .group-list li { margin-bottom: 4px; }
      .crew-line { margin-bottom: 4px; }
      .crew-need {
        background: rgba(255, 210, 120, 0.12);
        border: 1px solid rgba(255, 210, 120, 0.25);
        border-radius: 6px;
        padding: 2px 6px;
        display: inline-block;
      }
      .crew-none { color: #777; font-style: italic; }
      .reason-title { font-weight: 700; margin-bottom: 6px; }
      .reason-line { margin-bottom: 4px; }
      .reason-sub { margin-left: 16px; }
      .reason-none { color: #777; font-style: italic; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <h2>${escapeHtml(header)}</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Training Group</th>
          <th>Crew + Track</th>
          <th>Reasoning</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
</html>`;

      const win = window.open("", "_blank", "width=920,height=720");
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } finally {
      setPrintBusy(false);
    }
  };

  const sectionCard = {
    ...S.card,
    padding: 16,
    borderRadius: 20,
  };

  const sectionTitle = {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "-0.01em",
  };

  const sectionSub = {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.6)",
  };

  const stickySide = {
    position: "sticky",
    top: 110,
    alignSelf: "start",
  };

  return (
    <div style={{ marginTop: 14 }}>
      {/* Generate */}
      <div style={sectionCard}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={sectionTitle}>Generate plan</div>
            <div style={sectionSub}>
              Build a 14-day plan from the selected start date.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={S.button("primary", isGenerating || !locId)}
              onClick={() => generatePlan()}
              disabled={isGenerating || !locId}
            >
              {isGenerating ? "Generating…" : "Generate 14-day plan"}
            </button>
            <button
              style={S.button("subtle", isGenerating || !locId)}
              onClick={() => generatePlan(todayLocalISO())}
              disabled={isGenerating || !locId}
              title="Use today's date as the plan start"
            >
              Generate from today
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ minWidth: 160, flex: "0 0 auto" }}>
            <div style={{ ...S.helper, marginBottom: 6 }}>Start date</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ ...S.input, width: 160 }}
            />
          </div>

          <div style={{ minWidth: 240, flex: "1 1 240px" }}>
            <div style={{ ...S.helper, marginBottom: 6 }}>Plan library</div>
            <select
              value={planId ?? ""}
              onChange={(e) => handleSelectPlan(e.target.value)}
              style={{ ...S.select, width: "100%" }}
              disabled={planListLoading || !planList.length}
            >
              {!planList.length ? (
                <option value="">No plans yet</option>
              ) : null}
              {planList.map((p) => {
                const start = p.start_date ? formatShortDate(p.start_date) : "";
                const end = p.end_date ? formatShortDate(p.end_date) : "";
                const range = start && end ? `${start}–${end}` : start || "";
                const label = `${range}${p.status ? ` (${p.status})` : ""}`;
                return (
                  <option key={p.id} value={p.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              style={S.button("subtle", !planList.length)}
              disabled={!planList.length}
              onClick={() => setManageOpen(true)}
            >
              Manage plans
            </button>
          </div>

          {planId ? (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {selectedPlan ? (
                <button
                  style={S.button("ghost", planStatusBusy)}
                  disabled={planStatusBusy}
                  onClick={() =>
                    updatePlanStatus(
                      selectedPlan.status === "Posted" ? "Draft" : "Posted"
                    )
                  }
                >
                  {selectedPlan.status === "Posted"
                    ? "Unpost plan"
                    : "Post plan"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {planListError ? (
          <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
            {planListError}
          </div>
        ) : null}
        {genError && (
          <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
            {genError}
          </div>
        )}
      </div>

      {/* Planner body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(280px, 0.9fr)",
          gap: 14,
          marginTop: 14,
        }}
      >
        {/* Days list */}
        <div style={sectionCard}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={sectionTitle}>14-day schedule</div>
              <div style={sectionSub}>
                Select a day to review the attendee list.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={S.button("ghost")} onClick={() => setInfoOpen(true)}>
                Info
              </button>
              <button
                style={S.button("ghost", !days.length || printBusy)}
                onClick={handlePrint}
                disabled={!days.length || printBusy}
              >
                {printBusy ? "Preparing…" : "Print schedule"}
              </button>
            </div>
          </div>

          {daysLoading && <div style={S.helper}>Loading…</div>}
          {daysError && (
            <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
              {daysError}
            </div>
          )}

          {days.length === 0 && !daysLoading ? (
            <div style={{ marginTop: 12, ...S.helper }}>
              Generate a plan to see the schedule.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {days.map((d) => {
                const g = trainingGroupById.get(d.training_group_id);
                const hasGroup = Boolean(d.training_group_id);
                const scheduledCrewCount =
                  d.scheduled_crew_count ?? d.scheduledCrewCount ?? null;
                const noCrewScheduled =
                  scheduledCrewCount !== null &&
                  Number(scheduledCrewCount) === 0;
                const noRequiredTraining = Number(d.people_affected || 0) === 0;
                const isSelected = d.id === selectedDayId;
                const groupPill = {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.08)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                  color: "rgba(255,255,255,0.88)",
                };
                const labelChip = {
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.6)",
                };
                const requirementBadge = (() => {
                  if (noCrewScheduled) {
                    return { label: "No Crew", tone: "bad" };
                  }
                  if (noRequiredTraining) {
                    return { label: "Optional", tone: "info" };
                  }
                  return { label: "Required", tone: "warn" };
                })();
                const requirementStyle = requirementBadge.tone
                  ? S.badge(requirementBadge.tone)
                  : S.badge();

                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDayId(d.id)}
                    style={{
                      textAlign: "left",
                      padding: 14,
                      borderRadius: 16,
                      border: isSelected
                        ? "1px solid rgba(0,122,255,0.55)"
                        : "1px solid rgba(255,255,255,0.10)",
                      background: isSelected
                        ? "linear-gradient(180deg, rgba(0,122,255,0.18) 0%, rgba(0,122,255,0.08) 100%)"
                        : "rgba(255,255,255,0.05)",
                      boxShadow: isSelected
                        ? "0 14px 30px rgba(0,122,255,0.18)"
                        : "none",
                      cursor: "pointer",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 14.5,
                          color: "rgba(255,255,255,0.92)",
                        }}
                      >
                        {formatShortWeekdayDate(d.plan_date)}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={requirementStyle}>
                          {requirementBadge.label}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={labelChip}>Group</span>
                      <span style={groupPill}>
                        {g?.name || "No required training"}
                      </span>
                    </div>

                    {(() => {
                      const { headline, lines } =
                        formatReasoningSummaryParts(d);
                      const hasReasonLines = lines.length > 0;
                      const showReasonBox =
                        noCrewScheduled ||
                        noRequiredTraining ||
                        (hasGroup && !noRequiredTraining && hasReasonLines);

                      if (!showReasonBox) return null;

                      return (
                      <div
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.06)",
                          display: "grid",
                          gap: 4,
                        }}
                      >
                        <span style={labelChip}>REASON</span>
                        {noCrewScheduled ? (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "rgba(255,255,255,0.82)",
                              lineHeight: 1.35,
                            }}
                          >
                            No Crew Members Scheduled for this Day
                          </div>
                        ) : hasGroup && !noRequiredTraining ? (
                          <div
                            style={{
                              display: "grid",
                              gap: 4,
                              fontSize: 12.5,
                              color: "rgba(255,255,255,0.82)",
                              lineHeight: 1.35,
                            }}
                          >
                            <div>{headline}</div>
                            <div
                              style={{
                                display: "grid",
                                gap: 2,
                                paddingLeft: 10,
                              }}
                            >
                              {lines.map((line) => (
                                <div
                                  key={line}
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <span
                                    style={{
                                      color: "rgba(255,255,255,0.55)",
                                      lineHeight: 1.2,
                                    }}
                                  >
                                    •
                                  </span>
                                  <span>{line}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "rgba(255,255,255,0.82)",
                              lineHeight: 1.35,
                            }}
                          >
                            All Trainings Complete for Today&apos;s Crew
                            Members — Optional Trainings Today by Request
                          </div>
                        )}
                      </div>
                      );
                    })()}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendees */}
        <div style={stickySide}>
          <div style={sectionCard}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={sectionTitle}>
                {selectedDay
                  ? formatShortWeekdayDate(selectedDay.plan_date)
                  : "Attendees"}
              </div>
              <div style={sectionSub}>
                {selectedDay ? "" : "Select a day to view attendees."}
              </div>
            </div>

          </div>

          {!selectedDay ? (
            <div style={{ marginTop: 12, ...S.helper }}>Select a day.</div>
          ) : attendeesLoading ? (
            <div style={{ marginTop: 12, ...S.helper }}>Loading attendees…</div>
          ) : attendeesError ? (
            <div
              style={{
                marginTop: 12,
                ...S.helper,
                color: "rgba(255,120,120,0.95)",
              }}
            >
              {attendeesError}
            </div>
          ) : attendees.length === 0 ? (
            <div style={{ marginTop: 12, ...S.helper }}>
              No eligible crew for this day.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {attendees.map((a) => {
                const includeAction = a.included ? "Exclude" : "Include";
                const actionVariant = a.included ? "ghost" : "primary";

                return (
                  <div
                    key={a.crewId}
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: a.included
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800 }}>{a.name}</div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,0.7)",
                          }}
                        >
                          {String(a.trackName || a.trackId || "Unknown").toUpperCase()}
                        </div>
                      </div>

                      <button
                        onClick={() => toggleAttendee(a)}
                        disabled={savingCrewId === a.crewId}
                        style={S.button(actionVariant, savingCrewId === a.crewId)}
                      >
                        {includeAction}
                      </button>
                    </div>

                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.05)",
                        display: "grid",
                        gap: 4,
                        fontSize: 12.5,
                        color: "rgba(255,255,255,0.8)",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "rgba(255,255,255,0.55)",
                        }}
                      >
                        Reason
                      </div>
                      {buildAttendeeReasonLines(a).map((line) => {
                        const text = typeof line === "string" ? line : line.text;
                        const tone = typeof line === "string" ? null : line.tone;
                        const bold = true;
                        const textStyle =
                          tone === "good"
                            ? { color: "rgba(120,255,180,0.95)" }
                            : tone === "bad"
                            ? { color: "rgba(255,120,120,0.95)" }
                            : null;
                        return (
                          <div
                            key={text}
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "flex-start",
                            }}
                          >
                            <span style={{ color: "rgba(255,255,255,0.5)" }}>
                              •
                            </span>
                            <span
                              style={{
                                ...(textStyle || {}),
                                fontWeight: bold ? 700 : undefined,
                              }}
                            >
                              {text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {selectedDay ? (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button style={S.button("primary")} onClick={() => setExecuteOpen(true)}>
                Mark Training Complete
              </button>
              <button style={S.button("ghost")} onClick={() => setReopenOpen(true)}>
                Reopen day
              </button>
            </div>
          ) : null}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ExecuteDayModal
        S={S}
        open={executeOpen}
        busy={executeBusy}
        error={executeError}
        rows={executeRows}
        rowsLoading={executeRowsLoading}
        rowsError={executeRowsError}
        onToggleRow={toggleExecuteRow}
        completedOn={executeCompletedOn}
        setCompletedOn={setExecuteCompletedOn}
        completedBy={executeCompletedBy}
        setCompletedBy={setExecuteCompletedBy}
        notes={executeNotes}
        setNotes={setExecuteNotes}
        onConfirm={executeDay}
        onClose={() => setExecuteOpen(false)}
      />

      <ManagePlansModal
        S={S}
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        plans={planList}
        activePlanId={planId}
        busyId={manageBusyId}
        error={manageError}
        onDelete={deletePlan}
      />

      <PlannerInfoModal S={S} open={infoOpen} onClose={() => setInfoOpen(false)} />

      <ReopenDayModal
        S={S}
        open={reopenOpen}
        busy={reopenBusy}
        error={reopenError}
        reopenedBy={reopenBy}
        setReopenedBy={setReopenBy}
        reason={reopenReason}
        setReason={setReopenReason}
        confirmed={reopenConfirmed}
        setConfirmed={setReopenConfirmed}
        onConfirm={reopenDay}
        onClose={() => setReopenOpen(false)}
      />
    </div>
  );
}
