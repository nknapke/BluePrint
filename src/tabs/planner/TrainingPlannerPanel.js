import { useEffect, useMemo, useState } from "react";

import ExecuteDayModal from "./ExecuteDayModal";
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
  if (attendee.isOutOfDate) lines.push({ text: "Out of Date", tone: "bad" });
  if (attendee.noPriorTraining) {
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
  if (requiredCrew !== null) {
    lines.push(
      `${requiredCrew} Crew Member${requiredCrew === 1 ? "" : "s"} - Required`
    );
  }
  if (overdueCrew !== null) {
    lines.push(
      `${overdueCrew} Crew Member${
        overdueCrew === 1 ? "" : "s"
      } - Out of Date`
    );
  } else if (updateCrew !== null) {
    lines.push(
      `${updateCrew} Crew Member${updateCrew === 1 ? "" : "s"} - Out of Date`
    );
  }
  if (neverTrained !== null) {
    lines.push(
      `${neverTrained} Crew Member${neverTrained === 1 ? "" : "s"} - No Prior Training`
    );
  }
  if (extremeOverdue !== null) {
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
  trainingGroups = [],
}) {
  /* ---------- generate ---------- */
  const [startDate, setStartDate] = useState(() => {
    return todayLocalISO();
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [planId, setPlanId] = useState(null);
  const [genError, setGenError] = useState("");

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
  const [executeConfirmed, setExecuteConfirmed] = useState(false);
  const [executeCompletedBy, setExecuteCompletedBy] = useState("");
  const [executeCompletedOn, setExecuteCompletedOn] = useState("");
  const [executeNotes, setExecuteNotes] = useState("");
  const [executeError, setExecuteError] = useState("");

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

  async function generatePlan(nextStartDate) {
    if (!locId) return;

    setIsGenerating(true);
    setGenError("");
    setPlanId(null);
    setDays([]);
    setSelectedDayId(null);

    try {
      const effectiveStart = nextStartDate || startDate;
      if (nextStartDate) setStartDate(nextStartDate);

      await supabaseRpc("generate_training_plan_v2", {
        p_location_id: Number(locId),
        p_start_date: effectiveStart,
      });

      const rows = await supabaseGet(
        `/rest/v1/training_plans?select=id&location_id=eq.${locId}&start_date=eq.${effectiveStart}&order=created_at.desc&limit=1`
      );

      if (rows?.[0]?.id) setPlanId(rows[0].id);
    } catch (e) {
      setGenError(String(e?.message || e));
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    if (!planId) return;

    async function loadDays() {
      setDaysLoading(true);
      setDaysError("");

      try {
        const rows = await supabaseGet(
          `/rest/v1/training_plan_days?select=id,plan_date,training_group_id,status,people_affected,extreme_overdue_count,reasoning_summary,required_crew_count,update_crew_count,overdue_crew_count,never_trained_count,extreme_overdue_crew_count,look_ahead_window_days,priority_score,scheduled_crew_count&plan_id=eq.${planId}&order=plan_date.asc`
        );
        setDays(rows || []);
      } catch (e) {
        setDaysError(String(e?.message || e));
      } finally {
        setDaysLoading(false);
      }
    }

    loadDays();
  }, [planId, supabaseGet]);

  useEffect(() => {
    if (!selectedDayId) return;

    async function loadAttendees() {
      setAttendeesLoading(true);
      setAttendeesError("");
      setAttendees([]);

      try {
        const rows = await supabaseGet(
          `/rest/v1/v_plan_day_effective_attendees?select=attendee_id,crew_id,included,source,track_id,track_name,is_out_of_date,no_prior_training,is_extreme_overdue,simulated_last_completed,actual_last_completed&day_id=eq.${selectedDayId}`
        );

        const crewIds = rows.map((r) => r.crew_id).join(",");
        if (!crewIds) {
          setAttendees([]);
          return;
        }

        const crewRows = await supabaseGet(
          `/rest/v1/crew_roster?select=id,crew_name,status&id=in.(${crewIds})`
        );

        const crewMap = new Map(crewRows.map((c) => [c.id, c]));

        setAttendees(
          rows.map((r) => ({
            rowId: r.attendee_id,
            crewId: r.crew_id,
            name: crewMap.get(r.crew_id)?.crew_name || "",
            crewStatus: crewMap.get(r.crew_id)?.status || "",
            included: r.included,
            source: r.source,
            trackId: r.track_id,
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
    }

    loadAttendees();
  }, [selectedDayId, supabaseGet]);

  /* ---------------- actions ---------------- */

  async function toggleAttendee(a) {
    setSavingCrewId(a.crewId);

    try {
      await supabasePatch(
        `/rest/v1/training_plan_day_attendees?id=eq.${a.rowId}`,
        {
          included: !a.included,
          source: a.included ? "ManualRemove" : "ManualAdd",
        }
      );

      setAttendees((prev) =>
        prev.map((x) =>
          x.crewId === a.crewId ? { ...x, included: !x.included } : x
        )
      );
    } finally {
      setSavingCrewId(null);
    }
  }

  async function executeDay() {
    if (!executeConfirmed || !executeCompletedBy.trim()) return;

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

        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ ...S.helper, marginBottom: 6 }}>Start date</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={S.input}
            />
          </div>

          {planId ? (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <span style={S.badge("info")}>Plan #{planId}</span>
            </div>
          ) : null}
        </div>

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
              {days.length ? (
                <span style={S.badge("info")}>{days.length} days</span>
              ) : null}
              <button style={S.button("ghost")} onClick={() => setInfoOpen(true)}>
                Info
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

                    {(d.reasoning_summary ||
                      noRequiredTraining ||
                      noCrewScheduled) && (
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
                          (() => {
                            const { headline, lines } =
                              formatReasoningSummaryParts(d);
                            return (
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
                                {lines.length > 0 && (
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
                                )}
                              </div>
                            );
                          })()
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
                    )}
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
        completedOn={executeCompletedOn}
        setCompletedOn={setExecuteCompletedOn}
        completedBy={executeCompletedBy}
        setCompletedBy={setExecuteCompletedBy}
        notes={executeNotes}
        setNotes={setExecuteNotes}
        confirmed={executeConfirmed}
        setConfirmed={setExecuteConfirmed}
        onConfirm={executeDay}
        onClose={() => setExecuteOpen(false)}
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
