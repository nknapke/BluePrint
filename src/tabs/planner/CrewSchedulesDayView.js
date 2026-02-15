import { useEffect, useMemo, useState } from "react";

import { normalizeHex, trackGlowFromHex } from "../../utils/colors";
import { formatLongDate } from "../../utils/dates";
import { prettyDept } from "../../utils/strings";

const EMPTY_ARRAY = [];

const parseTimeInput = (value) => {
  if (!value) return null;
  const v = value.trim();
  const ampm = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2]);
    const mer = ampm[3].toUpperCase();
    if (mer === "PM" && hour < 12) hour += 12;
    if (mer === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0"
    )}:00`;
  }
  const hm = v.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const hour = Number(hm[1]);
    const minute = Number(hm[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0"
    )}:00`;
  }
  return null;
};

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

const formatWorkRange = (startTime, endTime) => {
  if (!startTime && !endTime) return "";
  const startLabel = startTime ? formatShowTime(startTime) : "";
  const endLabel = endTime ? formatShowTime(endTime) : "";
  if (startLabel && endLabel) return `${startLabel} to ${endLabel}`;
  return startLabel || endLabel;
};

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const total = i * 15;
  let hour = Math.floor(total / 60);
  const minute = total % 60;
  const mer = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${mer}`;
});

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

  const getShift =
    typeof roster?.getShift === "function" ? roster.getShift : () => null;
  const setShiftFor =
    typeof roster?.setShiftFor === "function" ? roster.setShiftFor : () => null;

  const showList = useMemo(() => {
    if (!dateISO) return [];
    return typeof roster?.getShowsForDate === "function"
      ? roster.getShowsForDate(dateISO)
      : [];
  }, [roster, dateISO]);

  const [activeShowId, setActiveShowId] = useState(null);

  useEffect(() => {
    const next = showList[0]?.id ?? null;
    setActiveShowId(next);
  }, [dateISO, showList]);

  const activeShow = useMemo(
    () => showList.find((s) => s.id === activeShowId) || null,
    [showList, activeShowId]
  );

  const promptShowTime = (seed = "") => {
    const raw = window.prompt("Show time (e.g., 7:00 PM)", seed);
    if (!raw) return null;
    return parseTimeInput(raw);
  };

  const handleAddShow = async () => {
    if (savePaused) return;
    if (!dateISO || typeof roster?.createShow !== "function") return;
    if (showList.length >= 4) return;
    const parsed = promptShowTime("");
    if (!parsed) return;
    await roster.createShow(dateISO, parsed, showList.length + 1);
  };

  const handleEditShow = async () => {
    if (savePaused) return;
    if (!activeShow || typeof roster?.updateShow !== "function") return;
    const parsed = promptShowTime(formatShowTime(activeShow.time));
    if (!parsed) return;
    await roster.updateShow(activeShow.id, parsed);
  };

  const handleDeleteShow = async () => {
    if (savePaused) return;
    if (!activeShow || typeof roster?.deleteShow !== "function") return;
    const ok = window.confirm("Delete this show time and its assignments?");
    if (!ok) return;
    await roster.deleteShow(activeShow.id, dateISO);
  };

  const applyShift = (crewId, startLabel, endLabel) => {
    if (!dateISO || typeof setShiftFor !== "function") return;
    const start24 = startLabel ? parseTimeInput(startLabel) : null;
    const end24 = endLabel ? parseTimeInput(endLabel) : null;
    setShiftFor(dateISO, crewId, start24, end24);
  };

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
    if (!showList.length) return 0;
    return filteredCrew.reduce((acc, c) => {
      const on = roster?.isWorking?.(dateISO, c.id, activeShowId) ? 1 : 0;
      return acc + on;
    }, 0);
  }, [filteredCrew, roster, dateISO, activeShowId, showList.length]);

  /* ---------- bulk actions ---------- */

  const setAll = (value) => {
    if (savePaused) return;
    if (!showList.length) return;
    for (const c of filteredCrew) {
      roster.setWorkingFor(dateISO, c.id, activeShowId, value);
    }
  };

  const toggleOne = (crewId) => {
    if (savePaused) return;
    if (!showList.length) return;
    roster.toggleCell(dateISO, crewId, activeShowId);
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
              {formatLongDate(dateISO)}
            </div>
            <div style={{ ...S.helper, marginTop: 4 }}>
              {workingCount} working · {filteredCrew.length - workingCount} off
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {showList.length ? (
              <select
                style={{ ...S.select, minWidth: 160, height: 32 }}
                value={activeShowId ?? ""}
                onChange={(e) =>
                  setActiveShowId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                {showList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatShowTime(s.time) || "Show"}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ ...S.helper, opacity: 0.7 }}>No shows</span>
            )}

            <button
              style={S.button("ghost", savePaused)}
              onClick={handleAddShow}
              disabled={savePaused}
            >
              Add show
            </button>
            {activeShow ? (
              <>
                <button
                  style={S.button("ghost", savePaused)}
                  onClick={handleEditShow}
                  disabled={savePaused}
                >
                  Edit show
                </button>
                <button
                  style={S.button("ghost", savePaused)}
                  onClick={handleDeleteShow}
                  disabled={savePaused}
                >
                  Delete show
                </button>
              </>
            ) : null}

            <button
              style={S.button("ghost", savePaused)}
              onClick={() => setAll(true)}
              disabled={savePaused || !showList.length}
            >
              All On
            </button>
            <button
              style={S.button("ghost", savePaused)}
              onClick={() => setAll(false)}
              disabled={savePaused || !showList.length}
            >
              All Off
            </button>
          </div>
        </div>

        {!showList.length ? (
          <div style={{ ...S.helper, marginTop: 10 }}>
            Add a show time to schedule crew for this day.
          </div>
        ) : roster?.showsError ? (
          <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
            {roster.showsError}
          </div>
        ) : roster?.shiftError ? (
          <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
            {roster.shiftError}
          </div>
        ) : grouped.length === 0 ? (
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
                  const working = roster.isWorking(
                    dateISO,
                    c.id,
                    activeShowId
                  );
                  const trackId = getTrackId(
                    dateISO,
                    c.id,
                    activeShowId
                  );
                  const shift = getShift(dateISO, c.id) || {};
                  const shiftLabel = formatWorkRange(
                    shift.startTime,
                    shift.endTime
                  );
                  const trackHex =
                    trackId != null && Number.isFinite(trackId)
                      ? trackColorById.get(Number(trackId)) || ""
                      : "";
                  const trackGlow = trackGlowFromHex(trackHex);
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (
                          e.target.closest("select") ||
                          e.target.closest("input") ||
                          e.target.closest("button")
                        )
                          return;
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
                      <div style={{ display: "grid", gap: 6 }}>
                        <span>{c.crew_name}</span>
                        {working ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  opacity: 0.75,
                                }}
                              >
                                IN:
                              </span>
                              <select
                                value={
                                  shift?.startTime
                                    ? formatShowTime(shift.startTime)
                                    : ""
                                }
                                onChange={(e) =>
                                  applyShift(
                                    c.id,
                                    e.target.value,
                                    shift?.endTime
                                      ? formatShowTime(shift.endTime)
                                      : ""
                                  )
                                }
                                style={{
                                  ...S.select,
                                  height: 28,
                                  fontSize: 12,
                                  padding: "2px 8px",
                                  minWidth: 120,
                                }}
                              >
                                <option value="">—</option>
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  opacity: 0.75,
                                }}
                              >
                                OUT:
                              </span>
                              <select
                                value={
                                  shift?.endTime
                                    ? formatShowTime(shift.endTime)
                                    : ""
                                }
                                onChange={(e) =>
                                  applyShift(
                                    c.id,
                                    shift?.startTime
                                      ? formatShowTime(shift.startTime)
                                      : "",
                                    e.target.value
                                  )
                                }
                                style={{
                                  ...S.select,
                                  height: 28,
                                  fontSize: 12,
                                  padding: "2px 8px",
                                  minWidth: 120,
                                }}
                              >
                                <option value="">—</option>
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : shiftLabel ? (
                          <span style={{ fontSize: 12, opacity: 0.75 }}>
                            {shiftLabel}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, opacity: 0.45 }}>
                            No time set
                          </span>
                        )}
                      </div>
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
                              setTrackFor(dateISO, c.id, activeShowId, e.target.value)
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
