// src/tabs/SignoffsTab.js
import { useMemo, useState, useCallback, useEffect } from "react";
import { Segmented } from "../components/ui/Segmented";
import { tintFromHex, normalizeHex } from "../utils/colors";

const STATUS_ORDER = ["No", "Training", "Yes"];

function nextStatus(current) {
  const normalized = String(current || "No");
  const idx = STATUS_ORDER.indexOf(normalized);
  if (idx === -1) return "No";
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function prettyDept(s) {
  const raw = String(s || "").trim();
  return raw || "Unassigned";
}

export default function SignoffsTab({
  S,
  crew,
  tracks,
  signoffs,
  signoffsLoading,
  signoffsError,
  signoffsCrewId,
  setSignoffsCrewId,
  signoffsTrackId,
  setSignoffsTrackId,
  signoffsStatusFilter,
  setSignoffsStatusFilter,
  loadSignoffs,
  updateSignoffStatus,
}) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [hoverCrewId, setHoverCrewId] = useState(null);
  const [hoverTrackId, setHoverTrackId] = useState(null);

  const activeCrew = useMemo(
    () => crew.filter((c) => c.active !== false),
    [crew]
  );
  const activeTracks = useMemo(
    () => tracks.filter((t) => t.active !== false),
    [tracks]
  );

  const tracksWithColor = useMemo(
    () =>
      activeTracks.map((t) => ({
        ...t,
        color: normalizeHex(t.color || ""),
      })),
    [activeTracks]
  );

  const baseCrew = useMemo(() => {
    if (signoffsCrewId === "ALL") return activeCrew;
    return activeCrew.filter((c) => String(c.id) === String(signoffsCrewId));
  }, [activeCrew, signoffsCrewId]);

  const baseTracks = useMemo(() => {
    if (signoffsTrackId === "ALL") return tracksWithColor;
    return tracksWithColor.filter(
      (t) => String(t.id) === String(signoffsTrackId)
    );
  }, [tracksWithColor, signoffsTrackId]);

  const { crewList, trackList } = useMemo(() => {
    let crewList = baseCrew;
    let trackList = baseTracks;

    const query = (q || "").trim().toLowerCase();
    if (query) {
      const crewMatches = baseCrew.filter((c) => {
        const name = String(c.name || "").toLowerCase();
        const dept = String(c.dept || "").toLowerCase();
        return name.includes(query) || dept.includes(query);
      });

      const trackMatches = baseTracks.filter((t) =>
        String(t.name || "").toLowerCase().includes(query)
      );

      if (crewMatches.length > 0) crewList = crewMatches;
      if (trackMatches.length > 0) trackList = trackMatches;

      if (crewMatches.length === 0 && trackMatches.length === 0) {
        crewList = [];
        trackList = [];
      }
    }

    return { crewList, trackList };
  }, [baseCrew, baseTracks, q]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const c of crewList) {
      const dept = prettyDept(c.dept);
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(c);
    }

    return Array.from(map.entries())
      .map(([dept, people]) => ({
        dept,
        people: people
          .slice()
          .sort((a, b) => String(a.name).localeCompare(String(b.name))),
      }))
      .sort((a, b) => String(a.dept).localeCompare(String(b.dept)));
  }, [crewList]);

  useEffect(() => {
    setExpanded(new Set(grouped.map((g) => g.dept)));
  }, [grouped]);

  const toggleDept = useCallback((dept) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });
  }, []);

  const signoffMap = useMemo(() => {
    const map = new Map();
    for (const s of signoffs) {
      map.set(`${s.crewId}-${s.trackId}`, s);
    }
    return map;
  }, [signoffs]);

  const resetFilters = useCallback(() => {
    setSignoffsCrewId("ALL");
    setSignoffsTrackId("ALL");
    setSignoffsStatusFilter("ALL");
    setQ("");
  }, [setSignoffsCrewId, setSignoffsTrackId, setSignoffsStatusFilter]);

  const gridTemplate = `260px repeat(${trackList.length}, minmax(120px, 1fr))`;

  const headerBg = "rgba(18,20,28,0.98)";
  const sideBg = "rgba(16,18,26,0.98)";

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={S.cardTitle}>Track Signoffs</h2>
          <div style={S.helper}>
            Crew on the left, tracks across the top. Click to cycle status.
          </div>
        </div>

        <div style={S.row}>
          <button style={S.button("subtle")} onClick={() => loadSignoffs(true)}>
            Refresh
          </button>
          <button style={S.button("ghost")} onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      <div style={S.cardBody}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.20)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.24)",
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search crew or track"
            style={{ ...S.input, width: 260 }}
          />

          <select
            value={signoffsCrewId}
            onChange={(e) => setSignoffsCrewId(e.target.value)}
            style={{ ...S.select, minWidth: 180 }}
          >
            <option value="ALL">All crew</option>
            {activeCrew.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={signoffsTrackId}
            onChange={(e) => setSignoffsTrackId(e.target.value)}
            style={{ ...S.select, minWidth: 180 }}
          >
            <option value="ALL">All tracks</option>
            {activeTracks.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>

          <Segmented
            value={signoffsStatusFilter}
            onChange={(v) => setSignoffsStatusFilter(v)}
            options={[
              { value: "ALL", label: "All" },
              { value: "Training", label: "Training" },
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" },
            ]}
          />

          <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800 }}>
            {crewList.length} crew / {trackList.length} tracks
          </div>
        </div>

        {signoffsLoading && <p style={S.loading}>Loading signoffs...</p>}
        {signoffsError && <p style={S.error}>{signoffsError}</p>}

        {!signoffsLoading && !signoffsError && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.22)",
              overflow: "hidden",
            }}
          >
            {crewList.length === 0 || trackList.length === 0 ? (
              <div style={{ padding: 18, opacity: 0.75 }}>
                No signoffs match these filters.
              </div>
            ) : (
              <div
                onMouseLeave={() => {
                  setHoverCrewId(null);
                  setHoverTrackId(null);
                }}
                style={{
                  maxHeight: "70vh",
                  overflow: "auto",
                  padding: 10,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                    gap: 8,
                    position: "sticky",
                    top: 0,
                    zIndex: 5,
                    paddingBottom: 8,
                    background: headerBg,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 6,
                      background: headerBg,
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "rgba(255,255,255,0.65)",
                    }}
                  >
                    Crew
                  </div>

                  {trackList.map((t) => {
                    const accent = tintFromHex(t.color || "#6b7280", 0.9);
                    return (
                      <div
                        key={t.id}
                        onMouseEnter={() => setHoverTrackId(t.id)}
                        onMouseLeave={() => setHoverTrackId(null)}
                        style={{
                          borderRadius: 12,
                          padding: "10px 10px",
                          background: headerBg,
                          border: "1px solid rgba(255,255,255,0.08)",
                          textAlign: "center",
                        }}
                        title={t.name}
                      >
                        <div
                          style={{
                            height: 4,
                            borderRadius: 999,
                            background: accent,
                            marginBottom: 6,
                          }}
                        />
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            lineHeight: 1.2,
                          }}
                        >
                          {t.name}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {grouped.map(({ dept, people }) => {
                  const open = expanded.has(dept);
                  return (
                    <div key={dept} style={{ marginTop: 10 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: gridTemplate,
                          gap: 8,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleDept(dept)}
                          style={{
                            gridColumn: "1 / -1",
                            width: "100%",
                            borderRadius: 12,
                            padding: "10px 12px",
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.88)",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ opacity: 0.75 }}>
                            {open ? "v" : ">"}
                          </span>
                          {dept}
                          <span style={{ marginLeft: "auto", opacity: 0.6 }}>
                            {people.length}
                          </span>
                        </button>
                      </div>

                      {open &&
                        people.map((c) => {
                          const rowHover = hoverCrewId === c.id;
                          return (
                            <div
                              key={c.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: gridTemplate,
                                gap: 8,
                                marginTop: 8,
                              }}
                            >
                              <div
                                onMouseEnter={() => setHoverCrewId(c.id)}
                                onMouseLeave={() => setHoverCrewId(null)}
                                style={{
                                  position: "sticky",
                                  left: 0,
                                  zIndex: 4,
                                  borderRadius: 12,
                                  padding: "10px 12px",
                                  background: rowHover
                                    ? "rgba(255,255,255,0.10)"
                                    : sideBg,
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  boxShadow: rowHover
                                    ? "0 8px 18px rgba(0,0,0,0.28)"
                                    : "none",
                                }}
                              >
                                <div style={{ fontWeight: 900 }}>{c.name}</div>
                                <div style={{ fontSize: 12, opacity: 0.6 }}>
                                  {prettyDept(c.dept)}
                                </div>
                              </div>

                              {trackList.map((t) => {
                                const key = `${c.id}-${t.id}`;
                                const row = signoffMap.get(key) || null;
                                const status = String(row?.status || "No");
                                const active = row ? row.active !== false : false;
                                const canEdit = row && active;
                                const focused =
                                  signoffsStatusFilter === "ALL"
                                    ? true
                                    : status === signoffsStatusFilter;

                                const accent = t.color || "#6b7280";
                                const bg =
                                  status === "Yes"
                                    ? tintFromHex(accent, 0.28)
                                    : status === "Training"
                                    ? tintFromHex(accent, 0.18)
                                    : "rgba(255,255,255,0.02)";
                                const border =
                                  status === "Yes"
                                    ? tintFromHex(accent, 0.55)
                                    : status === "Training"
                                    ? tintFromHex(accent, 0.35)
                                    : "rgba(255,255,255,0.10)";

                                const hover = rowHover || hoverTrackId === t.id;
                                const glow = hover
                                  ? `0 8px 18px rgba(0,0,0,0.28), 0 0 18px ${tintFromHex(
                                      accent,
                                      0.25
                                    )}`
                                  : "none";

                                const label =
                                  status === "Yes"
                                    ? "Yes"
                                    : status === "Training"
                                    ? "Training"
                                    : "";

                                let opacity = focused ? 1 : 0.35;
                                if (!canEdit) opacity = Math.min(opacity, 0.45);

                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    title={`${c.name} / ${t.name}: ${status}`}
                                    onClick={() => {
                                      if (!canEdit) return;
                                      updateSignoffStatus(row, nextStatus(status));
                                    }}
                                    onMouseEnter={() => {
                                      setHoverCrewId(c.id);
                                      setHoverTrackId(t.id);
                                    }}
                                    style={{
                                      height: 36,
                                      borderRadius: 10,
                                      border: `1px solid ${border}`,
                                      background: bg,
                                      boxShadow: glow,
                                      cursor: canEdit ? "pointer" : "not-allowed",
                                      transition:
                                        "transform 120ms ease, box-shadow 160ms ease, background 160ms ease",
                                      transform: hover ? "translateY(-1px)" : "none",
                                      opacity,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 11,
                                      fontWeight: 800,
                                      color:
                                        status === "Yes"
                                          ? "rgba(214,255,226,0.95)"
                                          : status === "Training"
                                          ? "rgba(210,235,255,0.95)"
                                          : "rgba(255,255,255,0.55)",
                                      letterSpacing: "0.01em",
                                      userSelect: "none",
                                    }}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
