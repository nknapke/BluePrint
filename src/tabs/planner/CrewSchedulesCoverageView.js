import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";

import { normalizeHex } from "../../utils/colors";
import { formatLongDate } from "../../utils/dates";
import { prettyDept } from "../../utils/strings";

const EMPTY_ARRAY = [];

const formatShowTime = (value) => {
  if (!value) return "";
  const [hh, mm] = String(value).split(":");
  if (!hh || !mm) return value;
  let hour = Number(hh);
  const minute = Number(mm);
  const mer = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${mer}`;
};

const formatShortDay = (dateISO) => {
  if (!dateISO) return "";
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateISO);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
};

export default function CrewSchedulesCoverageView({
  S,
  roster,
  search,
  tracks = [],
}) {
  const layoutMode = "grid";
  const gridScrollRef = useRef(null);
  const gridFrameRef = useRef(null);
  const savePaused = !!roster?.savePaused;
  const loading = !!(
    roster?.crewLoading ||
    roster?.assignLoading ||
    roster?.showsLoading
  );
  const err = roster?.crewError || roster?.assignError || roster?.showsError || "";

  const dateList = Array.isArray(roster?.dateList) ? roster.dateList : EMPTY_ARRAY;
  const allCrew = Array.isArray(roster?.crew) ? roster.crew : EMPTY_ARRAY;

  const q = String(search || "")
    .trim()
    .toLowerCase();

  const filteredCrew = useMemo(() => {
    if (!q) return allCrew;
    return allCrew.filter((c) => {
      const name = String(c?.crew_name || "").toLowerCase();
      const dept = String(c?.home_department || "").toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [allCrew, q]);

  const crewOptions = useMemo(() => {
    return filteredCrew
      .slice()
      .sort((a, b) => String(a?.crew_name || "").localeCompare(String(b?.crew_name || "")))
      .map((c) => ({
        id: Number(c.id),
        name: String(c.crew_name || "Crew"),
        dept: prettyDept(c.home_department),
      }))
      .filter((c) => Number.isFinite(c.id));
  }, [filteredCrew]);

  const activeTrackOptions = useMemo(() => {
    return (tracks || [])
      .filter((t) => t && t.active !== false)
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [tracks]);

  const criticalTrackOptions = useMemo(() => {
    return activeTrackOptions.filter((t) => t?.showCritical === true);
  }, [activeTrackOptions]);

  const requiredTrackOptions = useMemo(() => {
    return criticalTrackOptions.length > 0
      ? criticalTrackOptions
      : activeTrackOptions;
  }, [criticalTrackOptions, activeTrackOptions]);

  const usingCriticalTracks = criticalTrackOptions.length > 0;

  const allTrackNameById = useMemo(() => {
    const map = new Map();
    for (const t of tracks || []) {
      const id = Number(t?.id);
      if (!Number.isFinite(id)) continue;
      map.set(id, String(t?.name || `Track ${id}`));
    }
    return map;
  }, [tracks]);

  const allTrackColorById = useMemo(() => {
    const map = new Map();
    for (const t of tracks || []) {
      const id = Number(t?.id);
      if (!Number.isFinite(id)) continue;
      const hex = normalizeHex(t?.color);
      if (hex) map.set(id, hex);
    }
    return map;
  }, [tracks]);

  const getShowsForDate = useMemo(
    () =>
      typeof roster?.getShowsForDate === "function"
        ? roster.getShowsForDate
        : () => EMPTY_ARRAY,
    [roster?.getShowsForDate]
  );
  const isWorking = useMemo(
    () =>
      typeof roster?.isWorking === "function" ? roster.isWorking : () => false,
    [roster?.isWorking]
  );
  const getTrackId = useMemo(
    () =>
      typeof roster?.getTrackId === "function" ? roster.getTrackId : () => null,
    [roster?.getTrackId]
  );
  const setTrackFor = useMemo(
    () =>
      typeof roster?.setTrackFor === "function" ? roster.setTrackFor : null,
    [roster?.setTrackFor]
  );
  const setWorkingFor = useMemo(
    () =>
      typeof roster?.setWorkingFor === "function" ? roster.setWorkingFor : null,
    [roster?.setWorkingFor]
  );
  const assignCrewToTrack = useMemo(
    () =>
      typeof roster?.assignCrewToTrack === "function"
        ? roster.assignCrewToTrack
        : null,
    [roster?.assignCrewToTrack]
  );

  const handleAssignCrew = useCallback(
    (dateISO, showId, trackId, crewIdValue) => {
      if (savePaused) return;
      const crewId = Number(crewIdValue);
      const nextTrackId = Number(trackId);
      if (!Number.isFinite(crewId) || !Number.isFinite(nextTrackId)) return;

      if (assignCrewToTrack) {
        assignCrewToTrack(dateISO, crewId, showId, nextTrackId);
        return;
      }

      if (isWorking(dateISO, crewId, showId)) {
        setTrackFor?.(dateISO, crewId, showId, nextTrackId);
        return;
      }

      setWorkingFor?.(dateISO, crewId, showId, true);
      if (setTrackFor) {
        window.setTimeout(() => {
          setTrackFor(dateISO, crewId, showId, nextTrackId);
        }, 0);
      }
    },
    [
      savePaused,
      assignCrewToTrack,
      isWorking,
      setTrackFor,
      setWorkingFor,
    ]
  );

  const handleRemoveCrew = useCallback(
    (dateISO, showId, crewId) => {
      if (savePaused) return;
      setWorkingFor?.(dateISO, crewId, showId, false);
    },
    [savePaused, setWorkingFor]
  );

  const coverageByDay = useMemo(() => {
    return dateList.map((dateISO) => {
      const shows = getShowsForDate(dateISO);
      const fallbackTrackMap = new Map();

      const showCoverage = shows.map((show) => {
        const showId = show?.id ?? null;
        const rows = [];

        for (const crew of filteredCrew) {
          if (!isWorking(dateISO, crew.id, showId)) continue;
          const rawTrackId = getTrackId(dateISO, crew.id, showId);
          const trackId = Number.isFinite(Number(rawTrackId))
            ? Number(rawTrackId)
            : null;
          rows.push({
            crewId: Number(crew.id),
            crewName: String(crew.crew_name || "Crew"),
            crewDept: prettyDept(crew.home_department),
            trackId,
          });
        }

        rows.sort((a, b) => a.crewName.localeCompare(b.crewName));

        const requiredTrackRows = requiredTrackOptions.map((t) => ({
          trackId: Number(t.id),
          trackName: String(t.name || "Track"),
          trackColor: normalizeHex(t.color),
          crew: [],
          isFallback: false,
          isRequired: true,
        }));

        const baseTrackRows = [...requiredTrackRows];
        const byTrackId = new Map(baseTrackRows.map((r) => [r.trackId, r]));
        const unassigned = [];
        const crewTrackByCrewId = new Map();

        for (const row of rows) {
          if (row.trackId == null) {
            unassigned.push(row);
            continue;
          }

          crewTrackByCrewId.set(row.crewId, row.trackId);
          const existing = byTrackId.get(row.trackId);
          if (existing) {
            existing.crew.push(row);
            continue;
          }

          const fallback = {
            trackId: row.trackId,
            trackName: allTrackNameById.get(row.trackId) || `Track ${row.trackId}`,
            trackColor: allTrackColorById.get(row.trackId) || "",
            crew: [row],
            isFallback: true,
            isRequired: false,
          };
          byTrackId.set(row.trackId, fallback);
          baseTrackRows.push(fallback);
        }

        for (const tr of baseTrackRows) {
          tr.crew.sort((a, b) => a.crewName.localeCompare(b.crewName));
          if (tr.isFallback) {
            fallbackTrackMap.set(tr.trackId, {
              trackId: tr.trackId,
              trackName: tr.trackName,
              trackColor: tr.trackColor,
              isFallback: true,
              isRequired: false,
            });
          }
        }

        const trackCrewById = new Map(baseTrackRows.map((r) => [r.trackId, r.crew]));
        const coveredTracks = requiredTrackRows.filter((r) => r.crew.length > 0).length;
        const totalTracks = requiredTrackRows.length;

        return {
          show,
          showId,
          rows,
          trackRows: baseTrackRows,
          trackCrewById,
          crewTrackByCrewId,
          coveredTracks,
          totalTracks,
          unassigned,
        };
      });

      const dayTrackRows = [
        ...requiredTrackOptions.map((t) => ({
          trackId: Number(t.id),
          trackName: String(t.name || "Track"),
          trackColor: normalizeHex(t.color),
          isFallback: false,
          isRequired: true,
        })),
        ...Array.from(fallbackTrackMap.values()).sort((a, b) =>
          a.trackName.localeCompare(b.trackName)
        ),
      ];

      return {
        dateISO,
        shows,
        showCoverage,
        dayTrackRows,
      };
    });
  }, [
    dateList,
    filteredCrew,
    requiredTrackOptions,
    allTrackNameById,
    allTrackColorById,
    getShowsForDate,
    isWorking,
    getTrackId,
  ]);

  const weekShowColumns = useMemo(() => {
    return coverageByDay.flatMap((day) =>
      day.showCoverage.map((showItem, idx) => ({
        ...showItem,
        dateISO: day.dateISO,
        columnKey: `${day.dateISO}-${showItem.showId ?? idx}`,
      }))
    );
  }, [coverageByDay]);

  const weekTrackRows = useMemo(() => {
    const activeRows = requiredTrackOptions
      .map((t) => ({
        trackId: Number(t.id),
        trackName: String(t.name || "Track"),
        trackColor: normalizeHex(t.color),
        isFallback: false,
        isRequired: true,
      }))
      .filter((r) => Number.isFinite(r.trackId));

    const byTrackId = new Map(activeRows.map((r) => [r.trackId, r]));

    for (const showItem of weekShowColumns) {
      for (const tr of showItem.trackRows || EMPTY_ARRAY) {
        if (byTrackId.has(tr.trackId)) continue;
        byTrackId.set(tr.trackId, {
          trackId: tr.trackId,
          trackName: tr.trackName,
          trackColor: tr.trackColor || "",
          isFallback: true,
          isRequired: false,
        });
      }
    }

    const fallbackRows = Array.from(byTrackId.values())
      .filter((r) => r.isFallback)
      .sort((a, b) => a.trackName.localeCompare(b.trackName));

    return [...activeRows, ...fallbackRows];
  }, [requiredTrackOptions, weekShowColumns]);

  const syncFrozenTrackColumn = useCallback(() => {
    const scrollEl = gridScrollRef.current;
    const frameEl = gridFrameRef.current;
    if (!frameEl) return;
    const pageX =
      typeof window !== "undefined"
        ? Math.max(0, Number(window.scrollX || window.pageXOffset || 0))
        : 0;
    const localX = scrollEl ? Math.max(0, Number(scrollEl.scrollLeft || 0)) : 0;
    frameEl.style.setProperty(
      "--coverage-freeze-x",
      `${localX + pageX}px`
    );
  }, []);

  useEffect(() => {
    syncFrozenTrackColumn();
  }, [syncFrozenTrackColumn, layoutMode, weekShowColumns.length, weekTrackRows.length]);

  useEffect(() => {
    const onWindowMove = () => syncFrozenTrackColumn();
    window.addEventListener("scroll", onWindowMove, { passive: true });
    window.addEventListener("resize", onWindowMove);
    return () => {
      window.removeEventListener("scroll", onWindowMove);
      window.removeEventListener("resize", onWindowMove);
    };
  }, [syncFrozenTrackColumn]);

  useEffect(() => {
    const scrollEl = gridScrollRef.current;
    if (!scrollEl) return;
    const onGridScroll = () => syncFrozenTrackColumn();
    scrollEl.addEventListener("scroll", onGridScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onGridScroll);
  }, [syncFrozenTrackColumn, layoutMode, weekShowColumns.length, weekTrackRows.length]);

  const panel = {
    ...S.card,
    borderRadius: 20,
    padding: 16,
    overflow: "visible",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  };

  const dayCard = {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
    minWidth: 0,
  };

  const showCard = {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 10,
  };

  const trackRowBase = {
    borderRadius: 10,
    padding: "8px 10px",
    display: "grid",
    gridTemplateColumns: "minmax(160px, 220px) minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
  };

  const frozenTrackCellBase = {
    position: "relative",
    transform: "translateX(var(--coverage-freeze-x, 0px))",
    willChange: "transform",
  };

  const stickyLeftHeaderCell = {
    ...frozenTrackCellBase,
    zIndex: 6,
    boxShadow: "10px 0 18px rgba(0,0,0,0.26)",
  };

  const stickyLeftRowCell = {
    ...frozenTrackCellBase,
    zIndex: 4,
    boxShadow: "10px 0 18px rgba(0,0,0,0.22)",
  };

  const crewChip = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(255,255,255,0.07)",
  };

  const removeChipButton = {
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    padding: 0,
    marginLeft: 2,
    cursor: savePaused ? "not-allowed" : "pointer",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1,
  };

  const renderTrackSelect = (dateISO, showItem, targetTrackId) => {
    const crewInCell = showItem.trackCrewById.get(targetTrackId) || EMPTY_ARRAY;
    const primary = crewInCell[0] || null;
    const value =
      primary && Number.isFinite(primary.crewId) ? String(primary.crewId) : "";
    const extraCount = Math.max(0, crewInCell.length - 1);

    return (
      <div style={{ display: "grid", gap: 4 }}>
        <select
          disabled={savePaused}
          value={value}
          onChange={(e) => {
            const nextCrewId = e.target.value;
            const existing = showItem.trackCrewById.get(targetTrackId) || EMPTY_ARRAY;

            if (!nextCrewId) {
              for (const person of existing) {
                handleRemoveCrew(dateISO, showItem.showId, person.crewId);
              }
              return;
            }

            handleAssignCrew(dateISO, showItem.showId, targetTrackId, nextCrewId);
            for (const person of existing) {
              if (String(person.crewId) === String(nextCrewId)) continue;
              handleRemoveCrew(dateISO, showItem.showId, person.crewId);
            }
          }}
          style={{
            ...S.select,
            height: 30,
            width: "100%",
            minWidth: 0,
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 8px",
          }}
        >
          <option value="">Unassigned</option>
          {crewOptions.map((crew) => {
            const currentTrackId = showItem.crewTrackByCrewId.get(crew.id) ?? null;
            const fromTrackName =
              currentTrackId != null && currentTrackId !== targetTrackId
                ? allTrackNameById.get(currentTrackId) || `Track ${currentTrackId}`
                : "";
            const label = fromTrackName
              ? `${crew.name} (from ${fromTrackName})`
              : crew.name;

            return (
              <option key={`${showItem.showId}-${targetTrackId}-${crew.id}`} value={crew.id}>
                {label}
              </option>
            );
          })}
        </select>
        {extraCount > 0 ? (
          <span style={{ ...S.helper, opacity: 0.9 }}>
            {extraCount} additional assignment{extraCount === 1 ? "" : "s"} in this
            cell. Changing this value will collapse to one person.
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div style={{ marginTop: 12, width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <style>{`
        @keyframes coverageTrackGapPulse {
          0%, 100% {
            box-shadow:
              10px 0 18px rgba(0,0,0,0.22),
              0 0 0 1px rgba(255,99,99,0.35),
              0 0 10px rgba(255,99,99,0.28);
          }
          50% {
            box-shadow:
              10px 0 18px rgba(0,0,0,0.22),
              0 0 0 1px rgba(255,99,99,0.62),
              0 0 20px rgba(255,99,99,0.55);
          }
        }
      `}</style>
      <div style={panel}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800 }}>Show Coverage</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {q ? (
              <span style={S.badge("info")}>
                Filtered to {filteredCrew.length} crew
              </span>
            ) : null}
          </div>
        </div>

        {!usingCriticalTracks && activeTrackOptions.length > 0 ? (
          <div style={{ ...S.helper, marginBottom: 8 }}>
            No tracks are marked Show Critical yet. Coverage currently uses all active
            tracks as required.
          </div>
        ) : null}

        {loading ? <div style={S.helper}>Loading show coverage…</div> : null}
        {err ? (
          <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>{err}</div>
        ) : null}

        {!loading && !err && coverageByDay.length === 0 ? (
          <div style={S.helper}>No days found in this range.</div>
        ) : null}

        {!loading && !err ? (
          layoutMode === "grid" ? (
            <div style={dayCard}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800 }}>Weekly Coverage Grid</div>
                <span style={S.badge("info")}>
                  {weekShowColumns.length} show{weekShowColumns.length === 1 ? "" : "s"}
                </span>
              </div>

              {weekShowColumns.length === 0 ? (
                <div style={S.helper}>No shows scheduled this week.</div>
              ) : (
                <div
                  ref={gridScrollRef}
                  onScroll={syncFrozenTrackColumn}
                  style={{
                    overflowX: "auto",
                    overflowY: "visible",
                    WebkitOverflowScrolling: "touch",
                    position: "relative",
                    width: "100%",
                    maxWidth: "100%",
                  }}
                >
                  <div ref={gridFrameRef} style={{ "--coverage-freeze-x": "0px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `minmax(170px, 220px) repeat(${weekShowColumns.length}, minmax(230px, 1fr))`,
                        gap: 8,
                        minWidth: 170 + weekShowColumns.length * 230,
                      }}
                    >
                    <div
                      style={{
                        ...stickyLeftHeaderCell,
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(18,22,32,0.96)",
                        padding: "8px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        opacity: 0.9,
                      }}
                    >
                      Position / Track
                    </div>

                    {weekShowColumns.map((showItem) => (
                      <div
                        key={showItem.columnKey}
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.05)",
                          padding: "8px 10px",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.72 }}>
                          {formatShortDay(showItem.dateISO)}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>
                          {formatShowTime(showItem.show?.time) || "Show"}
                        </div>
                      </div>
                    ))}

                    {weekTrackRows.map((trackRow) => {
                      const dotColor =
                        trackRow.trackColor ||
                        (trackRow.isFallback ? "#9ec2ff" : "#8fd4ff");
                      const requiredRow = trackRow.isRequired !== false;
                      const uncoveredShowsForTrack = requiredRow
                        ? weekShowColumns.reduce((count, showItem) => {
                            const crewInCell =
                              showItem.trackCrewById.get(trackRow.trackId) || EMPTY_ARRAY;
                            return count + (crewInCell.length === 0 ? 1 : 0);
                          }, 0)
                        : 0;
                      const shouldPulseGap = uncoveredShowsForTrack > 0;
                      return (
                        <Fragment key={`week-track-row-${trackRow.trackId}`}>
                          <div
                            style={{
                              ...stickyLeftRowCell,
                              borderRadius: 10,
                              border: shouldPulseGap
                                ? "1px solid rgba(255,99,99,0.52)"
                                : "1px solid rgba(255,255,255,0.10)",
                              background: shouldPulseGap
                                ? "rgba(60,18,22,0.50)"
                                : "rgba(18,22,32,0.95)",
                              padding: "8px 10px",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              minWidth: 0,
                              animation: shouldPulseGap
                                ? "coverageTrackGapPulse 1.6s ease-in-out infinite"
                                : "none",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: dotColor,
                                flex: "0 0 auto",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                opacity: trackRow.isFallback ? 0.78 : 1,
                              }}
                              title={trackRow.trackName}
                            >
                              {trackRow.trackName}
                            </span>
                            {!requiredRow ? (
                              <span style={S.badge("info")}>Optional</span>
                            ) : null}
                          </div>

                          {weekShowColumns.map((showItem) => {
                            const crewInCell =
                              showItem.trackCrewById.get(trackRow.trackId) || EMPTY_ARRAY;
                            const covered = crewInCell.length > 0;
                            const uncovered = requiredRow && !covered;
                            return (
                              <div
                                key={`${showItem.columnKey}-${trackRow.trackId}`}
                                style={{
                                  borderRadius: 10,
                                  border: uncovered
                                    ? "1px solid rgba(255,99,99,0.30)"
                                    : covered
                                    ? "1px solid rgba(52,199,89,0.30)"
                                    : "1px solid rgba(255,255,255,0.12)",
                                  background: uncovered
                                    ? "rgba(255,99,99,0.08)"
                                    : covered
                                    ? "rgba(52,199,89,0.08)"
                                    : "rgba(255,255,255,0.03)",
                                  padding: "8px",
                                  display: "grid",
                                  gap: 8,
                                  alignContent: "start",
                                }}
                              >
                                {renderTrackSelect(showItem.dateISO, showItem, trackRow.trackId)}
                              </div>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {coverageByDay.map((day) => (
                <div key={day.dateISO} style={dayCard}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800 }}>
                      {formatLongDate(day.dateISO)}
                    </div>
                    <span style={S.badge("info")}>
                      {day.shows.length} show{day.shows.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {day.shows.length === 0 ? (
                    <div style={S.helper}>No shows scheduled.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {day.showCoverage.map((showItem) => {
                      const showLabel = formatShowTime(showItem.show?.time) || "Show";
                      const uncovered = Math.max(
                        0,
                        showItem.totalTracks - showItem.coveredTracks
                      );
                      return (
                        <div
                          key={`${day.dateISO}-${showItem.show?.id || showLabel}`}
                          style={showCard}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                              flexWrap: "wrap",
                              marginBottom: 8,
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 800 }}>{showLabel}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <span style={S.badge("good")}>
                                {showItem.coveredTracks}/{showItem.totalTracks} tracks covered
                              </span>
                              <span style={S.badge(uncovered ? "warn" : "good")}>
                                {uncovered} uncovered
                              </span>
                              <span style={S.badge("info")}>
                                {showItem.rows.length} crew assigned
                              </span>
                            </div>
                          </div>

                          {showItem.unassigned.length ? (
                            <div
                              style={{
                                marginBottom: 8,
                                borderRadius: 10,
                                border: "1px solid rgba(255,204,0,0.35)",
                                background: "rgba(255,204,0,0.10)",
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  opacity: 0.9,
                                  marginBottom: 6,
                                }}
                              >
                                Working but no track
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {showItem.unassigned.map((u) => (
                                  <span key={`${u.crewId}-unassigned`} style={crewChip}>
                                    {u.crewName}
                                    <button
                                      type="button"
                                      disabled={savePaused}
                                      onClick={() =>
                                        handleRemoveCrew(day.dateISO, showItem.showId, u.crewId)
                                      }
                                      style={removeChipButton}
                                      aria-label={`Remove ${u.crewName}`}
                                      title="Remove from show"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div style={{ display: "grid", gap: 6 }}>
                            {showItem.trackRows.map((tr) => {
                              const covered = tr.crew.length > 0;
                              const requiredRow = tr.isRequired !== false;
                              const borderColor = covered
                                ? "rgba(52,199,89,0.35)"
                                : "rgba(255,99,99,0.30)";
                              const rowBg = covered
                                ? "rgba(52,199,89,0.08)"
                                : "rgba(255,99,99,0.08)";
                              const dotColor = tr.trackColor || (covered ? "#34c759" : "#ff9f0a");

                              return (
                                <div
                                  key={`${showItem.show?.id}-${tr.trackId}`}
                                  style={{
                                    ...trackRowBase,
                                    border: `1px solid ${borderColor}`,
                                    background: rowBg,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      minWidth: 0,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 999,
                                        background: dotColor,
                                        boxShadow: `0 0 0 2px ${dotColor}33`,
                                        flex: "0 0 auto",
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 800,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        opacity: tr.isFallback ? 0.8 : 1,
                                      }}
                                      title={tr.trackName}
                                    >
                                      {tr.trackName}
                                    </span>
                                    {!requiredRow ? (
                                      <span style={S.badge("info")}>Optional</span>
                                    ) : null}
                                  </div>

                                  <div style={{ display: "grid", gap: 7 }}>
                                    {renderTrackSelect(day.dateISO, showItem, tr.trackId)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
