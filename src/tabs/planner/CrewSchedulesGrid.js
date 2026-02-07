import { useEffect, useMemo, useState, useCallback, useRef } from "react";

const EMPTY_ARRAY = [];

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

export default function CrewSchedulesGrid({ S, roster, search, tracks = [] }) {
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
  const days = useMemo(() => {
    if (roster?.dateList?.length) return roster.dateList;
    return Array.from({ length: 7 }, (_, i) => addDays(startISO, i));
  }, [roster?.dateList, startISO]);

  const todayISO = iso(new Date());

  const filteredCrew = useMemo(() => {
    const crew = roster?.crew ?? EMPTY_ARRAY;
    const q = String(search || "")
      .trim()
      .toLowerCase();
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

  const getTrackId = useCallback(
    (d, id) =>
      typeof roster?.getTrackId === "function" ? roster.getTrackId(d, id) : null,
    [roster]
  );

  const setTrackFor = useCallback(
    (d, id, value) =>
      typeof roster?.setTrackFor === "function"
        ? roster.setTrackFor(d, id, value)
        : null,
    [roster]
  );

  const trackOptions = useMemo(() => {
    return (tracks || [])
      .filter((t) => t && t.active !== false)
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [tracks]);

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

  const panel = {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
    padding: 14,
    marginTop: 12,
  };

  const gridTemplateColumns = `260px repeat(${days.length}, minmax(72px, 1fr))`;
  const minGridWidth = 260 + days.length * 86;
  const gridWrap = { overflowX: "auto", paddingBottom: 6 };
  const gridRow = {
    display: "grid",
    gridTemplateColumns,
    gap: 8,
    minWidth: minGridWidth,
  };

  const cellBase = {
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: savePaused ? "not-allowed" : "pointer",
    transition:
      "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 6px",
  };

  const trackSelect = {
    ...S.select,
    height: 26,
    minWidth: 0,
    width: "100%",
    borderRadius: 999,
    padding: "2px 26px 2px 10px",
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(10,15,25,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
  };

  return (
    <div style={panel}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={S.helper}>Click and drag to paint crew schedules.</div>
        {savePaused ? (
          <div style={{ ...S.badge("warn"), marginLeft: "auto" }}>
            Editing paused
          </div>
        ) : null}
      </div>

      {loading && <div style={S.helper}>Loading crew schedules…</div>}
      {err && (
        <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
          {err}
        </div>
      )}

      <div style={gridWrap}>
        {/* Header */}
        <div
          style={{
            ...gridRow,
            position: "sticky",
            top: 0,
            zIndex: 30,
            paddingBottom: 6,
            background: "rgba(12,14,20,0.8)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div />
          {days.map((d) => {
            const isToday = d === todayISO;
            return (
              <div
                key={d}
                onMouseEnter={() => setHoverDate(d)}
                onMouseLeave={() => setHoverDate(null)}
                style={{
                  borderRadius: 14,
                  padding: "10px",
                  textAlign: "center",
                  background: isToday
                    ? "linear-gradient(180deg, rgba(0,122,255,0.28) 0%, rgba(0,122,255,0.10) 100%)"
                    : hoverDate === d
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.03)",
                  border: isToday
                    ? "1px solid rgba(0,122,255,0.45)"
                    : "1px solid rgba(255,255,255,0.08)",
                  transition: "background 120ms ease, border 120ms ease",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 900 }}>{fmtDow(d)}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{fmtMD(d)}</div>
              </div>
            );
          })}
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
                  borderRadius: 14,
                  padding: "10px 12px",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                <span style={{ opacity: 0.7 }}>{open ? "v" : ">"}</span>
                {dept}
                <span style={{ marginLeft: "auto", opacity: 0.6 }}>
                  {people.length}
                </span>
              </button>

              {open &&
                people.map((c) => {
                  const rowHover = hoverCrewId === c.id;
                  return (
                    <div
                      key={c.id}
                      style={{ ...gridRow, marginTop: 8 }}
                    >
                      <div
                        onMouseEnter={() => setHoverCrewId(c.id)}
                        onMouseLeave={() => setHoverCrewId(null)}
                        style={{
                          borderRadius: 12,
                          padding: "10px 12px",
                          background: rowHover
                            ? "rgba(255,255,255,0.10)"
                            : "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{c.crew_name}</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>
                          {prettyDept(c.home_department)}
                        </div>
                      </div>

                      {days.map((d) => {
                        const working = isWorking(d, c.id);
                        const trackId = getTrackId(d, c.id);
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
                                ? "linear-gradient(180deg, rgba(90,150,255,0.32) 0%, rgba(90,150,255,0.16) 100%)"
                                : hover
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(255,255,255,0.02)",
                              border: working
                                ? "1px solid rgba(90,150,255,0.40)"
                                : "1px solid rgba(255,255,255,0.08)",
                              boxShadow: hover
                                ? "0 6px 16px rgba(0,0,0,0.25)"
                                : "none",
                              transform: hover ? "translateY(-1px)" : "none",
                              opacity: savePaused ? 0.6 : 1,
                            }}
                          >
                            {working ? (
                              <select
                                value={
                                  trackId != null && Number.isFinite(trackId)
                                    ? String(trackId)
                                    : ""
                                }
                                onChange={(e) =>
                                  setTrackFor(d, c.id, e.target.value)
                                }
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={(e) => e.stopPropagation()}
                                disabled={savePaused}
                                style={trackSelect}
                              >
                                <option value="">No track</option>
                                {trackOptions.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </div>
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
    </div>
  );
}
