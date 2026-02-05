// src/tabs/SignoffsTab.js
import { useMemo, useState, useCallback } from "react";
import { Chevron } from "../components/ui/Chevron";
import { DotCount } from "../components/ui/DotCount";
import { Chip } from "../components/ui/Chip";
import { Segmented } from "../components/ui/Segmented";
import { tintFromHex, normalizeHex } from "../utils/colors";

/** ---------- Row highlight by signoff status ---------- */
function rowWash(status, active) {
  if (active === false) return ""; // keep inactive neutral
  if (String(status) === "Yes") return "rgba(52,199,89,0.12)"; // green
  if (String(status) === "Training") return "rgba(0,122,255,0.12)"; // blue
  return "";
}

/** ---------- stats logic ---------- */

function computeStats(items, isQualifiedStatus) {
  let qualified = 0;
  let training = 0;
  let notQualified = 0;
  let inactive = 0;

  for (const s of items) {
    if (s?.active === false) {
      inactive += 1;
      continue;
    }
    if (String(s.status) === "Training") training += 1;
    else if (isQualifiedStatus(s.status)) qualified += 1;
    else notQualified += 1;
  }

  return { qualified, training, notQualified, inactive };
}

function GroupHeaderIOS({
  title,
  subtitle,
  open,
  onToggle,
  counts,
  accentHex,
}) {
  const qualified = counts?.qualified ?? 0;
  const training = counts?.training ?? 0;
  const notQualified = counts?.notQualified ?? 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
        e.currentTarget.style.boxShadow = "0 28px 64px rgba(0,0,0,0.38)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.boxShadow = open
          ? "0 22px 54px rgba(0,0,0,0.32)"
          : "0 12px 30px rgba(0,0,0,0.18)";
      }}
      style={{
        width: "100%",
        cursor: "pointer",
        userSelect: "none",
        padding: "14px 14px",
        borderRadius: 18,
        border: open
          ? "1px solid rgba(255,255,255,0.16)"
          : "1px solid rgba(255,255,255,0.10)",
        background: open
          ? "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(0,0,0,0.12) 100%)"
          : "rgba(0,0,0,0.16)",
        boxShadow: open
          ? "0 22px 54px rgba(0,0,0,0.32)"
          : "0 12px 30px rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        color: "rgba(255,255,255,0.92)",
        textAlign: "left",
        transition:
          "transform 180ms ease, box-shadow 220ms ease, background 180ms ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.99)";
        setTimeout(() => {
          if (e.currentTarget) e.currentTarget.style.transform = "scale(1)";
        }, 120);
      }}
      aria-expanded={open}
    >
      {!!accentHex && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: `linear-gradient(180deg, ${tintFromHex(
              accentHex,
              0.6
            )} 0%, ${tintFromHex(accentHex, 0.12)} 100%)`,
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 0,
          paddingLeft: accentHex ? 6 : 0,
        }}
      >
        <div
          style={{ fontSize: 14, fontWeight: 880, letterSpacing: "-0.01em" }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.62 }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <DotCount
            color="rgba(52,199,89,0.90)"
            count={qualified}
            title={`Qualified: ${qualified}`}
          />
          <DotCount
            color="rgba(0,122,255,0.90)"
            count={training}
            title={`Training: ${training}`}
          />
          <DotCount
            color="rgba(255,204,0,0.90)"
            count={notQualified}
            title={`Not qualified: ${notQualified}`}
          />
        </div>
        <Chevron open={open} />
      </div>
    </button>
  );
}

function SignoffRow({
  S,
  row,
  primaryTitle,
  secondaryText,
  onChangeStatus,
  isFirst,
  accentHex,
}) {
  const wash = rowWash(row.status, row.active);

  const hoverOn = (e) => {
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 12px 26px rgba(0,0,0,0.22)";
    e.currentTarget.style.background = wash
      ? `linear-gradient(90deg, ${wash} 0%, rgba(0,0,0,0) 65%)`
      : "rgba(255,255,255,0.02)";
  };

  const hoverOff = (e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.background = wash
      ? `linear-gradient(90deg, ${wash} 0%, rgba(0,0,0,0) 65%)`
      : "transparent";
  };

  const pressOn = (e) => {
    if (e.target.closest("select")) return;
    if (e.target.closest("button")) return;
    if (e.target.closest("input")) return;
    e.currentTarget.style.transform = "translateY(0px) scale(0.995)";
  };

  const pressOff = (e) => {
    if (e.target.closest("select")) return;
    if (e.target.closest("button")) return;
    if (e.target.closest("input")) return;
    e.currentTarget.style.transform = "translateY(-1px)";
  };

  return (
    <div
      onMouseEnter={hoverOn}
      onMouseLeave={hoverOff}
      onMouseDown={pressOn}
      onMouseUp={pressOff}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        padding: "12px 12px",
        borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.08)",
        background: wash
          ? `linear-gradient(90deg, ${wash} 0%, rgba(0,0,0,0) 65%)`
          : "transparent",
        position: "relative",
        overflow: "hidden",
        transition:
          "transform 140ms ease, box-shadow 180ms ease, background 160ms ease",
        willChange: "transform",
      }}
    >
      {!!accentHex && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: `linear-gradient(180deg, ${tintFromHex(
              accentHex,
              0.55
            )} 0%, ${tintFromHex(accentHex, 0.1)} 100%)`,
            opacity: 0.95,
          }}
        />
      )}

      <div style={{ minWidth: 0, paddingLeft: accentHex ? 8 : 0 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 850,
              letterSpacing: "-0.01em",
            }}
          >
            {primaryTitle}
          </div>
        </div>

        <div
          style={{ marginTop: 6, fontSize: 12, fontWeight: 700, opacity: 0.82 }}
        >
          <span style={{ opacity: 0.78 }}>{secondaryText}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <select
          value={row.status}
          onChange={(e) => onChangeStatus(e.target.value)}
          style={S.select}
          disabled={row.active === false}
        >
          <option value="No">No</option>
          <option value="Training">Training</option>
          <option value="Yes">Yes</option>
        </select>
      </div>
    </div>
  );
}

/** ---------- main ---------- */

export default function SignoffsTab({
  S,
  crew,
  tracks,
  signoffs,
  visibleSignoffs,

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
  isQualifiedStatus,
}) {
  const [signoffsViewMode, setSignoffsViewMode] = useState("crew"); // crew | track

  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focus, setFocus] = useState("ALL"); // ALL | TRAINING | NOT | QUALIFIED | INACTIVE
  const [trackViewShowNo, setTrackViewShowNo] = useState(false);

  const [expandedByView, setExpandedByView] = useState(() => ({
    crew: new Set(),
    track: new Set(),
  }));

  const expanded = expandedByView[signoffsViewMode] || new Set();

  const setExpanded = useCallback(
    (updater) => {
      setExpandedByView((prev) => {
        const current = prev[signoffsViewMode] || new Set();
        const nextSet =
          typeof updater === "function" ? updater(current) : updater;
        return { ...prev, [signoffsViewMode]: nextSet };
      });
    },
    [signoffsViewMode]
  );

  const toggleKey = useCallback(
    (key) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [setExpanded]
  );

  const crewById = useMemo(
    () => new Map(crew.map((c) => [String(c.id), c])),
    [crew]
  );
  const trackById = useMemo(
    () => new Map(tracks.map((t) => [String(t.id), t])),
    [tracks]
  );

  const displaySignoffs = useMemo(() => {
    return (visibleSignoffs || []).map((s) => {
      const c = crewById.get(String(s.crewId));
      const t = trackById.get(String(s.trackId));
      const trackColor = normalizeHex(t?.color || "");
      return {
        ...s,
        crewName: c?.name || String(s.crewId),
        trackName: t?.name || String(s.trackId),
        trackColor,
      };
    });
  }, [visibleSignoffs, crewById, trackById]);

  const searched = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    if (!query) return displaySignoffs;

    return displaySignoffs.filter((s) => {
      const hay = `${s.crewName} ${s.trackName} ${
        s.status || ""
      }`.toLowerCase();
      return hay.includes(query);
    });
  }, [displaySignoffs, q]);

  const filtered = useMemo(() => {
    if (focus === "ALL") return searched;

    return searched.filter((s) => {
      if (focus === "INACTIVE") return s.active === false;
      if (s.active === false) return false;

      if (focus === "TRAINING") return String(s.status || "No") === "Training";
      if (focus === "QUALIFIED") return isQualifiedStatus(s.status);
      if (focus === "NOT") return String(s.status || "No") === "No";
      return true;
    });
  }, [searched, focus, isQualifiedStatus]);

  const filteredForView = useMemo(() => {
    if (signoffsViewMode !== "track") return filtered;
    if (trackViewShowNo) return filtered;
    return filtered.filter((s) => isQualifiedStatus(s.status));
  }, [filtered, signoffsViewMode, trackViewShowNo, isQualifiedStatus]);

  const groups = useMemo(() => {
    const isCrew = signoffsViewMode === "crew";
    const map = new Map();

    for (const s of filteredForView) {
      const key = isCrew ? String(s.crewId) : String(s.trackId);
      const title = isCrew ? s.crewName : s.trackName;

      if (!map.has(key)) {
        map.set(key, {
          key,
          title,
          items: [],
          accentHex: isCrew ? "" : s.trackColor || "",
        });
      }

      map.get(key).items.push(s);
    }

    const orderCrew = new Map(crew.map((c, i) => [String(c.id), i]));
    const orderTrack = new Map(tracks.map((t, i) => [String(t.id), i]));

    const out = Array.from(map.values());
    out.sort((a, b) => {
      const ai = isCrew
        ? orderCrew.get(a.key) ?? 9999
        : orderTrack.get(a.key) ?? 9999;
      const bi = isCrew
        ? orderCrew.get(b.key) ?? 9999
        : orderTrack.get(b.key) ?? 9999;
      if (ai !== bi) return ai - bi;
      return String(a.title).localeCompare(String(b.title));
    });

    for (const g of out) {
      g.items.sort((a, b) => {
        if (isCrew)
          return String(a.trackName).localeCompare(String(b.trackName));
        return String(a.crewName).localeCompare(String(b.crewName));
      });
    }

    return out;
  }, [filteredForView, signoffsViewMode, crew, tracks]);

  const stickyShell = {
    position: "sticky",
    top: 0,
    zIndex: 3,
    padding: "12px 0 12px",
    marginBottom: 14,
    backdropFilter: "blur(14px)",
    background:
      "linear-gradient(180deg, rgba(16,18,26,0.92) 0%, rgba(16,18,26,0.72) 65%, rgba(16,18,26,0.00) 100%)",
  };

  const commandBar = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.22)",
    boxShadow: "0 16px 44px rgba(0,0,0,0.18)",
  };

  const filterPanel = {
    overflow: "hidden",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.20) 100%)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.16)",
    maxHeight: filtersOpen ? 360 : 0,
    opacity: filtersOpen ? 1 : 0,
    transform: filtersOpen ? "translateY(0px)" : "translateY(-6px)",
    transition:
      "max-height 220ms ease, opacity 180ms ease, transform 220ms ease",
  };

  const panelInner = { padding: 12, display: "grid", gap: 10 };
  const panelRow = {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 10,
    alignItems: "center",
  };
  const panelCell = (span) => ({ gridColumn: `span ${span}`, minWidth: 0 });

  const chips = useMemo(() => {
    const out = [];

    if (signoffsCrewId !== "ALL") {
      const c = crew.find((x) => String(x.id) === String(signoffsCrewId));
      out.push({
        key: "crew",
        text: `Crew: ${c?.name || signoffsCrewId}`,
        clear: () => setSignoffsCrewId("ALL"),
      });
    }

    if (signoffsTrackId !== "ALL") {
      const t = tracks.find((x) => String(x.id) === String(signoffsTrackId));
      out.push({
        key: "track",
        text: `Track: ${t?.name || signoffsTrackId}`,
        clear: () => setSignoffsTrackId("ALL"),
      });
    }

    if (signoffsStatusFilter !== "ALL") {
      out.push({
        key: "status",
        text: `Status: ${signoffsStatusFilter}`,
        clear: () => setSignoffsStatusFilter("ALL"),
      });
    }

    if ((q || "").trim()) {
      out.push({
        key: "q",
        text: `Search: ${(q || "").trim()}`,
        clear: () => setQ(""),
      });
    }

    if (focus !== "ALL") {
      const label = {
        TRAINING: "Training",
        NOT: "Not qualified",
        QUALIFIED: "Qualified",
        INACTIVE: "Inactive",
      }[focus];
      out.push({
        key: "focus",
        text: `Focus: ${label || focus}`,
        clear: () => setFocus("ALL"),
      });
    }

    if (signoffsViewMode === "track" && !trackViewShowNo) {
      out.push({
        key: "trackOnlySigned",
        text: "Track view: signed off only",
        clear: () => setTrackViewShowNo(true),
      });
    }

    return out;
  }, [
    crew,
    tracks,
    signoffsCrewId,
    signoffsTrackId,
    signoffsStatusFilter,
    q,
    focus,
    signoffsViewMode,
    trackViewShowNo,
    setSignoffsCrewId,
    setSignoffsTrackId,
    setSignoffsStatusFilter,
  ]);

  const clearAll = useCallback(() => {
    setSignoffsCrewId("ALL");
    setSignoffsTrackId("ALL");
    setSignoffsStatusFilter("ALL");
    setQ("");
    setFocus("ALL");
    setTrackViewShowNo(false);
    setFiltersOpen(false);
    setExpandedByView((prev) => ({
      ...prev,
      crew: new Set(),
      track: new Set(),
    }));
  }, [setSignoffsCrewId, setSignoffsTrackId, setSignoffsStatusFilter]);

  const expandTop = useCallback(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const g of groups) next.add(g.key);
      return next;
    });
  }, [setExpanded, groups]);

  const collapseTop = useCallback(() => {
    setExpanded(new Set());
  }, [setExpanded]);

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={S.cardTitle}>Track Signoffs</h2>
          <div style={S.helper}>
            Manage training and signoff status by show track.
          </div>
        </div>

        <div style={S.row}>
          <button style={S.button("subtle")} onClick={() => loadSignoffs(true)}>
            Refresh
          </button>
          <button style={S.button("ghost")} onClick={clearAll}>
            Reset
          </button>
        </div>
      </div>

      <div style={S.cardBody}>
        <div style={stickyShell}>
          <div style={commandBar}>
            <Segmented
              value={signoffsViewMode}
              onChange={(v) => setSignoffsViewMode(v)}
              options={[
                { value: "crew", label: "By Crew" },
                { value: "track", label: "By Track" },
              ]}
            />

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search crew, track, status"
              style={{ ...S.input, width: 320, flex: "1 1 240px" }}
            />

            <button
              type="button"
              style={S.button(filtersOpen ? "primary" : "subtle")}
              onClick={() => setFiltersOpen((p) => !p)}
            >
              Filters
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.button("subtle")} onClick={expandTop}>
                Expand
              </button>
              <button style={S.button("subtle")} onClick={collapseTop}>
                Collapse
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, ...filterPanel }}>
            <div style={panelInner}>
              <div style={panelRow}>
                <div style={panelCell(4)}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Crew</div>
                  <select
                    value={signoffsCrewId}
                    onChange={(e) => setSignoffsCrewId(e.target.value)}
                    style={{ ...S.select, width: "100%" }}
                  >
                    <option value="ALL">All crew</option>
                    {crew.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={panelCell(4)}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Track</div>
                  <select
                    value={signoffsTrackId}
                    onChange={(e) => setSignoffsTrackId(e.target.value)}
                    style={{ ...S.select, width: "100%" }}
                  >
                    <option value="ALL">All tracks</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={panelCell(4)}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Status</div>
                  <select
                    value={signoffsStatusFilter}
                    onChange={(e) => setSignoffsStatusFilter(e.target.value)}
                    style={{ ...S.select, width: "100%" }}
                  >
                    <option value="ALL">All statuses</option>
                    <option value="No">No</option>
                    <option value="Training">Training</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ ...S.helper, margin: 0 }}>Focus</div>
                <Segmented
                  value={focus}
                  onChange={(v) => setFocus(v)}
                  options={[
                    { value: "ALL", label: "All" },
                    { value: "TRAINING", label: "Training" },
                    { value: "QUALIFIED", label: "Qualified" },
                    { value: "NOT", label: "Not qualified" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
              </div>

              {signoffsViewMode === "track" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    id="trackViewShowNo"
                    type="checkbox"
                    checked={trackViewShowNo}
                    onChange={(e) => setTrackViewShowNo(e.target.checked)}
                  />
                  <label
                    htmlFor="trackViewShowNo"
                    style={{ ...S.helper, margin: 0 }}
                  >
                    Show "No" rows in Track view
                  </label>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={S.mini}>
                  Showing {filteredForView.length} of {signoffs.length}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={S.button("ghost")}
                    onClick={() => setFiltersOpen(false)}
                  >
                    Done
                  </button>
                  <button style={S.button("subtle")} onClick={clearAll}>
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>

          {chips.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {chips.map((c) => (
                <Chip key={c.key} text={c.text} onClear={c.clear} />
              ))}
            </div>
          )}
        </div>

        {signoffsLoading && <p style={S.loading}>Loading signoffs...</p>}
        {signoffsError && <p style={S.error}>{signoffsError}</p>}

        {!signoffsLoading && !signoffsError && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map((g) => {
              const open = expanded.has(g.key);
              const counts = computeStats(g.items, isQualifiedStatus);

              const subtitle =
                signoffsViewMode === "crew"
                  ? `${counts.qualified} qualified, ${counts.training} training`
                  : `${counts.qualified} qualified crew, ${counts.training} training crew`;

              return (
                <div
                  key={g.key}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <GroupHeaderIOS
                    title={g.title}
                    subtitle={subtitle}
                    open={open}
                    onToggle={() => toggleKey(g.key)}
                    counts={counts}
                    accentHex={g.accentHex}
                  />

                  {open && (
                    <div
                      style={{
                        marginLeft: 16,
                        padding: 10,
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(0,0,0,0.14)",
                        boxShadow: "0 14px 36px rgba(0,0,0,0.18)",
                      }}
                    >
                      <div
                        style={{
                          borderRadius: 14,
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(0,0,0,0.18)",
                        }}
                      >
                        {g.items.map((row, idx) => {
                          const primaryTitle =
                            signoffsViewMode === "crew"
                              ? row.trackName
                              : row.crewName;

                          const secondaryText =
                            signoffsViewMode === "crew"
                              ? `Track ID: ${row.trackId}`
                              : `Crew ID: ${row.crewId}`;

                          const accentHex =
                            signoffsViewMode === "crew"
                              ? row.trackColor
                              : g.accentHex;

                          return (
                            <SignoffRow
                              key={row.id}
                              S={S}
                              row={row}
                              primaryTitle={primaryTitle}
                              secondaryText={secondaryText}
                              isFirst={idx === 0}
                              accentHex={accentHex}
                              onChangeStatus={(next) =>
                                updateSignoffStatus(row, next)
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {groups.length === 0 && (
              <div style={{ padding: 18, opacity: 0.75 }}>
                No signoffs match your filters.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
