import { useMemo } from "react";

import { hexToRgba, normalizeHex } from "../../utils/colors";

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

export default function CrewSchedulesDayView({
  S,
  roster,
  dateISO,
  search,
  tracks = [],
}) {
  const savePaused = !!roster?.savePaused;
  const trackOptions = useMemo(
    () =>
      (tracks || [])
        .filter((t) => t && t.active !== false)
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [tracks]
  );
  const trackColorById = useMemo(() => {
    const map = new Map();
    for (const t of trackOptions) {
      const hex = normalizeHex(t?.color);
      if (hex) map.set(Number(t.id), hex);
    }
    return map;
  }, [trackOptions]);

  const getTrackId =
    typeof roster?.getTrackId === "function"
      ? roster.getTrackId
      : () => null;
  const setTrackFor =
    typeof roster?.setTrackFor === "function"
      ? roster.setTrackFor
      : () => null;

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

  const trackSelect = {
    ...S.select,
    height: 28,
    minWidth: 180,
    borderRadius: 999,
    padding: "2px 28px 2px 12px",
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(10,15,25,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
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
                  const trackId = getTrackId(dateISO, c.id);
                  const trackHex =
                    trackId != null && Number.isFinite(trackId)
                      ? trackColorById.get(Number(trackId)) || ""
                      : "";
                  const trackGlow = trackHex
                    ? {
                        bg: hexToRgba(trackHex, 0.18),
                        border: hexToRgba(trackHex, 0.45),
                        shadow: hexToRgba(trackHex, 0.35),
                        inset: hexToRgba(trackHex, 0.28),
                      }
                    : null;
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (e.target.closest("select")) return;
                        toggleOne(c.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleOne(c.id);
                        }
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: working
                          ? trackGlow
                            ? `1px solid ${trackGlow.border}`
                            : "1px solid rgba(90,150,255,0.40)"
                          : "1px solid rgba(255,255,255,0.10)",
                        background: working
                          ? trackGlow
                            ? `linear-gradient(180deg, ${trackGlow.bg} 0%, rgba(255,255,255,0.02) 100%)`
                            : "linear-gradient(180deg, rgba(90,150,255,0.28) 0%, rgba(90,150,255,0.14) 100%)"
                          : "rgba(255,255,255,0.04)",
                        boxShadow: working
                          ? trackGlow
                            ? `0 0 0 1px ${trackGlow.inset} inset, 0 8px 20px ${trackGlow.shadow}`
                            : "0 8px 18px rgba(90,150,255,0.18)"
                          : "none",
                        cursor: savePaused ? "not-allowed" : "pointer",
                        fontWeight: 700,
                        transition:
                          "background 120ms ease, border 120ms ease",
                        opacity: savePaused ? 0.6 : 1,
                      }}
                    >
                      <span>{c.crew_name}</span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 12, opacity: 0.75 }}>
                          {working ? "Working" : "Off"}
                        </span>
                        {working ? (
                          <select
                            value={
                              trackId != null && Number.isFinite(trackId)
                                ? String(trackId)
                                : ""
                            }
                            onChange={(e) =>
                              setTrackFor(dateISO, c.id, e.target.value)
                            }
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
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
                    </div>
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
