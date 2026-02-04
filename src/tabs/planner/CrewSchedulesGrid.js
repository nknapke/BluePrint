import { useEffect, useMemo, useState, useCallback, useRef } from "react";

/** ---------- date helpers ---------- */
function iso(d) {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateISO, n) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
}

function fmtDow(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function fmtMD(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function prettyDept(s) {
  const raw = String(s || "").trim();
  return raw || "Unassigned";
}

/** ---------- GRID ---------- */

export default function CrewSchedulesGrid({
  S,
  roster,
  search,
  setSearch,
  weekLabel,
}) {
  const crew = roster?.crew ?? [];
  const loading = !!(roster?.crewLoading || roster?.assignLoading);
  const err = roster?.crewError || roster?.assignError || "";
  const savePaused = !!roster?.savePaused;

  const [hoverCrewId, setHoverCrewId] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);

  /** ---------- drag paint state ---------- */
  const dragRef = useRef({
    active: false,
    mode: null, // true = paint on, false = paint off
  });

  const startISO = roster?.startISO || iso(new Date());
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(startISO, i)),
    [startISO]
  );

  const filteredCrew = useMemo(() => {
    const q = String(search || "")
      .trim()
      .toLowerCase();
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
      people: people
        .slice()
        .sort((a, b) => String(a.crew_name).localeCompare(String(b.crew_name))),
    }));
  }, [filteredCrew]);

  const [expanded, setExpanded] = useState(() => new Set());
  useEffect(() => {
    setExpanded(new Set(grouped.map((g) => g.dept)));
  }, [grouped]);

  const toggleDept = (dept) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(dept) ? n.delete(dept) : n.add(dept);
      return n;
    });
  };

  const isWorking = useCallback(
    (d, id) =>
      typeof roster?.isWorking === "function"
        ? !!roster.isWorking(d, id)
        : false,
    [roster]
  );

  /** ---------- paint logic ---------- */

  const paintCell = useCallback(
    (dateISO, crewId, nextVal) => {
      if (savePaused) return;
      roster?.setWorkingFor
        ? roster.setWorkingFor(dateISO, crewId, nextVal)
        : roster?.toggleCell?.(dateISO, crewId);
    },
    [roster, savePaused]
  );

  const beginDrag = (dateISO, crewId) => {
    if (savePaused) return;
    const current = isWorking(dateISO, crewId);
    dragRef.current = {
      active: true,
      mode: !current,
    };
    paintCell(dateISO, crewId, !current);
  };

  const dragOver = (dateISO, crewId) => {
    if (!dragRef.current.active) return;
    paintCell(dateISO, crewId, dragRef.current.mode);
  };

  const endDrag = () => {
    dragRef.current.active = false;
    dragRef.current.mode = null;
  };

  useEffect(() => {
    window.addEventListener("mouseup", endDrag);
    return () => window.removeEventListener("mouseup", endDrag);
  }, []);

  /** ---------- styles ---------- */

  const cellBase = {
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: savePaused ? "not-allowed" : "pointer",
    transition:
      "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
    userSelect: "none",
  };

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)",
        padding: 12,
        marginTop: 12,
      }}
    >
      {/* Search + week */}
      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <input
          value={search || ""}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search crew or department"
          style={{ ...S.input, height: 36, maxWidth: 360 }}
          disabled={savePaused}
        />
        <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 900 }}>
          {weekLabel}
        </div>
      </div>

      {loading && <div style={S.helpText}>Loading crew schedules…</div>}
      {err && (
        <div style={{ ...S.helpText, color: "rgba(255,120,120,0.95)" }}>
          {err}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px repeat(7, 1fr)",
          gap: 8,
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div />
        {days.map((d) => (
          <div
            key={d}
            onMouseEnter={() => setHoverDate(d)}
            onMouseLeave={() => setHoverDate(null)}
            style={{
              borderRadius: 12,
              padding: "10px",
              textAlign: "center",
              background:
                hoverDate === d
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.03)",
              transition: "background 120ms ease",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900 }}>{fmtDow(d)}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{fmtMD(d)}</div>
          </div>
        ))}
      </div>

      {/* Body */}
      {grouped.length === 0 ? (
        <div style={{ padding: 16, opacity: 0.7 }}>No crew found.</div>
      ) : (
        grouped.map(({ dept, people }) => {
          const open = expanded.has(dept);
          return (
            <div key={dept} style={{ marginTop: 10 }}>
              <button
                onClick={() => toggleDept(dept)}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                ▶ <strong>{dept}</strong>
                <span style={{ marginLeft: "auto", opacity: 0.7 }}>
                  {people.length}
                </span>
              </button>

              {open &&
                people.map((c) => {
                  const rowHover = hoverCrewId === c.id;
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "260px repeat(7, 1fr)",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <div
                        onMouseEnter={() => setHoverCrewId(c.id)}
                        onMouseLeave={() => setHoverCrewId(null)}
                        style={{
                          borderRadius: 12,
                          padding: "10px 12px",
                          background: rowHover
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.03)",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{c.crew_name}</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>
                          {prettyDept(c.home_department)}
                        </div>
                      </div>

                      {days.map((d) => {
                        const working = isWorking(d, c.id);
                        const hover = rowHover || hoverDate === d;

                        return (
                          <div
                            key={`${c.id}-${d}`}
                            onMouseDown={() => beginDrag(d, c.id)}
                            onMouseEnter={() => {
                              setHoverCrewId(c.id);
                              setHoverDate(d);
                              dragOver(d, c.id);
                            }}
                            style={{
                              ...cellBase,
                              background: working
                                ? "rgba(120,200,255,0.22)"
                                : hover
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(255,255,255,0.02)",
                              border: working
                                ? "1px solid rgba(120,200,255,0.35)"
                                : "1px solid rgba(255,255,255,0.08)",
                              boxShadow: hover
                                ? "0 4px 14px rgba(0,0,0,0.25)"
                                : "none",
                              transform: hover ? "translateY(-1px)" : "none",
                              opacity: savePaused ? 0.6 : 1,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          );
        })
      )}
    </div>
  );
}
