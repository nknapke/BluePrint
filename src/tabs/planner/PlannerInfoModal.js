export default function PlannerInfoModal({ S, open, onClose }) {
  if (!open) return null;

  const sectionTitle = {
    fontSize: 13,
    fontWeight: 800,
    margin: "14px 0 6px",
    letterSpacing: "-0.01em",
  };

  const paragraph = {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 1.5,
  };

  const list = {
    margin: "6px 0 0",
    paddingLeft: 18,
    display: "grid",
    gap: 6,
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
  };

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Planner info</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              A quick guide to how the planner works and how to read it.
            </div>
          </div>
          <button style={S.button("ghost")} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ ...S.modalBody, maxHeight: "70vh", overflowY: "auto" }}>
          <div style={paragraph}>
            The planner builds a 14‑day schedule, one training group per day. It
            looks at who is working, what their tracks require, and which
            trainings are due or overdue, then selects the most impactful group
            for each day.
          </div>

          <div style={sectionTitle}>What It Uses</div>
          <ul style={list}>
            <li>Work roster assignments (who is working and which track).</li>
            <li>Track requirements and training groups.</li>
            <li>Training records (last completed dates).</li>
            <li>Crew status and active signoffs.</li>
            <li>The chosen plan start date.</li>
          </ul>

          <div style={sectionTitle}>How A Day Is Chosen</div>
          <ul style={list}>
            <li>Only crew working that day are considered.</li>
            <li>Only required, active trainings inside a group are eligible.</li>
            <li>Only items due within the 14‑day window are scored.</li>
            <li>The window is fixed to 14 days (no expansion).</li>
            <li>All groups are scored; the top 5 are considered.</li>
            <li>The highest score wins for that day.</li>
          </ul>

          <div style={sectionTitle}>Scoring</div>
          <ul style={list}>
            <li>Overdue beats due today, which beats due soon.</li>
            <li>One very urgent training can carry a group.</li>
            <li>Groups that help more people get a boost.</li>
            <li>30+ days overdue is tracked and shown.</li>
          </ul>

          <div style={sectionTitle}>Predictive Behavior</div>
          <ul style={list}>
            <li>The planner assumes each planned day is completed.</li>
            <li>Later days are scored using those simulated completions.</li>
            <li>If real life differs, the next plan corrects it.</li>
            <li>Per‑crew reasons are saved at plan time using that simulation.</li>
          </ul>

          <div style={sectionTitle}>Badges On The 14‑Day List</div>
          <ul style={list}>
            <li>Required: at least one working crew member needs training.</li>
            <li>Optional: crew are scheduled, but none need training.</li>
            <li>No Crew: nobody is scheduled that day.</li>
          </ul>

          <div style={sectionTitle}>Crew Reason (Right Side)</div>
          <ul style={list}>
            <li>Out of Date: due date is today or past.</li>
            <li>No Prior Training: no history for required trainings in the group.</li>
            <li>30+ Days Overdue: overdue by 30+ days.</li>
            <li>
              Up to Date: none of the above. Shows “Last Completed” for history
              or “Will be Completed on” for predicted completion.
            </li>
          </ul>

          <div style={sectionTitle}>Actions</div>
          <ul style={list}>
            <li>Include/Exclude adjusts who the day applies to.</li>
            <li>Mark Training Complete updates records for included crew.</li>
            <li>Reopen Day reverses an execution if needed.</li>
          </ul>

          <div style={sectionTitle}>Quick Examples</div>
          <div style={paragraph}>
            Example: If three crew are working and two are overdue in Group A,
            Group A is selected and those two show “Out of Date.”
          </div>
          <div style={{ ...paragraph, marginTop: 8 }}>
            Example: If no one needs training on a day, it shows “Optional” and
            the crew list will display “Up to Date.”
          </div>
          <div style={{ ...paragraph, marginTop: 8 }}>
            Example: If no crew are scheduled that day, the badge shows “No
            Crew.”
          </div>
        </div>
      </div>
    </div>
  );
}
