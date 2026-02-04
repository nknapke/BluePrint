import { useMemo } from "react";

function prettyDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function prettyDept(s) {
  const raw = String(s || "").trim();
  return raw || "Unassigned";
}

export default function CrewSchedulesDayView({ S, roster, dateISO, search }) {
  const crew = roster?.crew ?? [];
  const savePaused = !!roster?.savePaused;

  const filteredCrew = useMemo(() => {
    const q = String(search || "")
      .toLowerCase()
      .trim();
    if (!q) return crew;
    return crew.filter((c) => {
      const name = String(c.crew_name || "").toLowerCase();
      const dept = String(c.home_department || "").toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [crew, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const c of filteredCrew) {
      const dept = prettyDept(c.home_department);
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(c);
    }
    return Array.from(map.entries()).map(([dept, people]) => ({
      dept,
      people,
    }));
  }, [filteredCrew]);

  /* ---------- bulk actions ---------- */

  const setAll = (value) => {
    if (savePaused) return;
    for (const c of filteredCrew) {
      roster.setWorkingFor(dateISO, c.id, value);
    }
  };

  const toggleOne = (crewId) => {
    if (savePaused) return;
    roster.toggleCell(dateISO, crewId);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={S.card}>
        <div style={S.cardHeaderRow}>
          <div style={S.cardTitle}>{prettyDate(dateISO)}</div>

          {/* Global bulk buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={S.secondaryBtn}
              onClick={() => setAll(true)}
              disabled={savePaused}
            >
              All On
            </button>
            <button
              style={S.secondaryBtn}
              onClick={() => setAll(false)}
              disabled={savePaused}
            >
              All Off
            </button>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div style={S.helpText}>No crew found.</div>
        ) : (
          grouped.map(({ dept, people }) => (
            <div key={dept} style={{ marginTop: 14 }}>
              {/* Department label only */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  opacity: 0.85,
                  marginBottom: 6,
                }}
              >
                {dept}
              </div>

              {/* Crew rows */}
              <div style={{ display: "grid", gap: 6 }}>
                {people.map((c) => {
                  const working = roster.isWorking(dateISO, c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleOne(c.id)}
                      disabled={savePaused}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: working
                          ? "rgba(120,200,255,0.22)"
                          : "rgba(255,255,255,0.04)",
                        cursor: savePaused ? "not-allowed" : "pointer",
                        fontWeight: 800,
                        transition: "background 120ms ease",
                      }}
                    >
                      <span>{c.crew_name}</span>
                      <span style={{ fontSize: 12, opacity: 0.85 }}>
                        {working ? "Working" : "Off"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
