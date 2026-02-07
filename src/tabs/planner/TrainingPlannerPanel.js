import { useEffect, useMemo, useState } from "react";

import ExecuteDayModal from "./ExecuteDayModal";
import ReopenDayModal from "./ReopenDayModal";

/* ---------------- helpers ---------------- */

function prettyDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function clampText(s, n = 180) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

function statusMeta(status) {
  const label = String(status || "Open");
  const normalized = label.toLowerCase();

  if (normalized.includes("execute") || normalized.includes("complete")) {
    return { label, tone: "good" };
  }

  if (
    normalized.includes("open") ||
    normalized.includes("draft") ||
    normalized.includes("plan")
  ) {
    return { label: label || "Open", tone: "info" };
  }

  if (normalized.includes("hold") || normalized.includes("pause")) {
    return { label, tone: "warn" };
  }

  if (normalized.includes("cancel") || normalized.includes("error")) {
    return { label, tone: "bad" };
  }

  return { label, tone: null };
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
    const d = new Date();
    return d.toISOString().slice(0, 10);
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

  async function generatePlan() {
    if (!locId) return;

    setIsGenerating(true);
    setGenError("");
    setPlanId(null);
    setDays([]);
    setSelectedDayId(null);

    try {
      await supabaseRpc("generate_training_plan_v2", {
        p_location_id: Number(locId),
        p_start_date: startDate,
      });

      const rows = await supabaseGet(
        `/rest/v1/training_plans?select=id&location_id=eq.${locId}&start_date=eq.${startDate}&order=created_at.desc&limit=1`
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
          `/rest/v1/training_plan_days?select=id,plan_date,training_group_id,status,people_affected,extreme_overdue_count,reasoning_summary&plan_id=eq.${planId}&order=plan_date.asc`
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
          `/rest/v1/v_plan_day_effective_attendees?select=attendee_id,crew_id,included,source&day_id=eq.${selectedDayId}`
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

          <button
            style={S.button("primary", isGenerating || !locId)}
            onClick={generatePlan}
            disabled={isGenerating || !locId}
          >
            {isGenerating ? "Generating…" : "Generate 14-day plan"}
          </button>
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

            {days.length ? (
              <span style={S.badge("info")}>{days.length} days</span>
            ) : null}
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
                const isSelected = d.id === selectedDayId;
                const meta = statusMeta(d.status);
                const badgeStyle = meta.tone ? S.badge(meta.tone) : S.badge();

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
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {prettyDate(d.plan_date)}
                      </div>
                      <span style={badgeStyle}>{meta.label}</span>
                      <span style={S.badge("warn")}>
                        {d.people_affected} affected
                      </span>
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.78 }}>
                      {g?.name || "No group"}
                    </div>

                    {d.reasoning_summary && (
                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                        {clampText(d.reasoning_summary)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendees */}
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
                {selectedDay ? prettyDate(selectedDay.plan_date) : "Attendees"}
              </div>
              <div style={sectionSub}>
                {selectedDay
                  ? "Review, include, or exclude crew for this day."
                  : "Select a day to view attendees."}
              </div>
            </div>

            {selectedDay ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={S.badge("info")}>{attendeeCounts.included} in</span>
                <span style={S.badge("warn")}>{attendeeCounts.excluded} out</span>
              </div>
            ) : null}
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
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: a.included
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>{a.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {a.source || "Auto"}
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
                );
              })}
            </div>
          )}

          {selectedDay ? (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button style={S.button("primary")} onClick={() => setExecuteOpen(true)}>
                Execute day
              </button>
              <button style={S.button("ghost")} onClick={() => setReopenOpen(true)}>
                Reopen day
              </button>
            </div>
          ) : null}
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
