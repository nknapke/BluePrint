import { useMemo } from "react";

const EMPTY_ARRAY = [];

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
  const savePaused = !!roster?.savePaused;

  const filteredCrew = useMemo(() => {
    const crew = roster?.crew ?? EMPTY_ARRAY;
    const q = String(search || "")
      .toLowerCase()
      .trim();
    if (!q) return crew;
    return crew.filter((c) => {
      const name = String(c.crew_name || "").toLowerCase();
      const dept = String(c.home_department || "").toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [roster?.crew, search]);

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

  const workingCount = useMemo(() => {
    if (!dateISO) return 0;
    return filteredCrew.reduce((acc, c) => {
      const on = roster?.isWorking?.(dateISO, c.id) ? 1 : 0;
      return acc + on;
    }, 0);
  }, [filteredCrew, roster, dateISO]);

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

  const panel = {
    ...S.card,
    padding: 16,
    borderRadius: 20,
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={panel}>
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
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              {prettyDate(dateISO)}
            </div>
            <div style={{ ...S.helper, marginTop: 4 }}>
              {workingCount} working · {filteredCrew.length - workingCount} off
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              style={S.button("ghost", savePaused)}
              onClick={() => setAll(true)}
              disabled={savePaused}
            >
              All On
            </button>
            <button
              style={S.button("ghost", savePaused)}
              onClick={() => setAll(false)}
              disabled={savePaused}
            >
              All Off
            </button>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div style={S.helper}>No crew found.</div>
        ) : (
          grouped.map(({ dept, people }) => (
            <div key={dept} style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  opacity: 0.85,
                  marginBottom: 8,
                  letterSpacing: "0.01em",
                  textTransform: "uppercase",
                }}
              >
                {dept}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
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
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: working
                          ? "1px solid rgba(90,150,255,0.40)"
                          : "1px solid rgba(255,255,255,0.10)",
                        background: working
                          ? "linear-gradient(180deg, rgba(90,150,255,0.28) 0%, rgba(90,150,255,0.14) 100%)"
                          : "rgba(255,255,255,0.04)",
                        cursor: savePaused ? "not-allowed" : "pointer",
                        fontWeight: 700,
                        transition:
                          "background 120ms ease, border 120ms ease",
                      }}
                    >
                      <span>{c.crew_name}</span>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>
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
