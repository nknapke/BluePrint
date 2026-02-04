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
          `/rest/v1/training_plan_day_attendees?select=id,crew_id,included,source&day_id=eq.${selectedDayId}`
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
            rowId: r.id,
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

  return (
    <div style={{ marginTop: 14 }}>
      {/* Generate */}
      <div style={S.card}>
        <div style={S.cardHeaderRow}>
          <div style={S.cardTitle}>Generate plan</div>
        </div>

        <div style={S.row}>
          <div style={S.field}>
            <div style={S.label}>Start date</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={S.input}
            />
          </div>

          <div style={{ ...S.field, alignSelf: "flex-end" }}>
            <button
              style={S.primaryBtn}
              onClick={generatePlan}
              disabled={isGenerating || !locId}
            >
              {isGenerating ? "Generating…" : "Generate 14-day plan"}
            </button>
          </div>
        </div>

        {genError && (
          <div style={{ ...S.helpText, color: "rgba(255,120,120,0.95)" }}>
            {genError}
          </div>
        )}
      </div>

      {/* Planner body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.25fr 1fr",
          gap: 14,
          marginTop: 14,
        }}
      >
        {/* Days list */}
        <div style={S.card}>
          <div style={S.cardTitle}>14-day schedule</div>

          {daysLoading && <div style={S.helpText}>Loading…</div>}
          {daysError && (
            <div style={{ ...S.helpText, color: "rgba(255,120,120,0.95)" }}>
              {daysError}
            </div>
          )}

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {days.map((d) => {
              const g = trainingGroupById.get(d.training_group_id);
              const isSelected = d.id === selectedDayId;

              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDayId(d.id)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 14,
                    border: isSelected
                      ? "1px solid rgba(90,150,255,0.55)"
                      : "1px solid rgba(255,255,255,0.10)",
                    background: isSelected
                      ? "rgba(90,150,255,0.20)"
                      : "rgba(255,255,255,0.06)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>
                    {prettyDate(d.plan_date)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    {g?.name || "No group"} · {d.people_affected} affected
                  </div>
                  {d.reasoning_summary && (
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                      {clampText(d.reasoning_summary)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Attendees */}
        <div style={S.card}>
          <div style={S.cardTitle}>Attendees</div>

          {!selectedDayId ? (
            <div style={S.helpText}>Select a day.</div>
          ) : attendeesLoading ? (
            <div style={S.helpText}>Loading attendees…</div>
          ) : attendeesError ? (
            <div style={{ ...S.helpText, color: "rgba(255,120,120,0.95)" }}>
              {attendeesError}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {attendees.map((a) => (
                <div
                  key={a.crewId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>{a.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{a.source}</div>
                  </div>

                  <button
                    onClick={() => toggleAttendee(a)}
                    disabled={savingCrewId === a.crewId}
                    style={S.secondaryBtn}
                  >
                    {a.included ? "Exclude" : "Include"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedDayId && (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button style={S.primaryBtn} onClick={() => setExecuteOpen(true)}>
                Execute day
              </button>
              <button
                style={S.secondaryBtn}
                onClick={() => setReopenOpen(true)}
              >
                Reopen day
              </button>
            </div>
          )}
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
