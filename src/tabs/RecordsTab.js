// RecordsTab.js
import { useMemo, useState, useCallback } from "react";
import { Chevron } from "../components/ui/Chevron";
import { DotCount } from "../components/ui/DotCount";
import { Chip } from "../components/ui/Chip";
import { Segmented } from "../components/ui/Segmented";
import { prettyTitle } from "../utils/strings";

const EMPTY_SET = new Set();

/** ----------------------------- Helpers ----------------------------- */

function daysText(r) {
  if (!r.lastCompleted) return "Not completed";
  if (!r.dueDate) return "Never expires";

  if (r.status === "Training Overdue") {
    const n = Number(r.daysOverdue ?? 0);
    if (!Number.isFinite(n) || n <= 0) return "Overdue";
    return n === 1 ? "Overdue by 1 day" : `Overdue by ${n} days`;
  }

  const n = Number(r.daysUntilDue);
  if (!Number.isFinite(n)) return "Due soon";
  if (n === 0) return "Due today";
  return n === 1 ? "Due in 1 day" : `Due in ${n} days`;
}

function statusLabel(r) {
  if (!r.lastCompleted) return "Not completed";
  if (!r.dueDate) return "Never expires";
  if (r.status === "Training Overdue") return "Overdue";
  if (r.status === "Training Due") return "Due soon";
  return "Complete";
}

function statusTone(r) {
  const s = statusLabel(r);
  if (s === "Overdue") return "danger";
  if (s === "Due soon") return "warn";
  if (s === "Not completed") return "muted";
  if (s === "Never expires") return "muted2";
  return "good";
}

function rankRecord(r) {
  const s = statusLabel(r);
  if (s === "Overdue") return 0;
  if (s === "Due soon") return 1;
  if (s === "Not completed") return 2;
  if (s === "Never expires") return 3;
  return 4;
}

/** ----------------------------- UI bits ----------------------------- */

const PILL_BASE = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 750,
  letterSpacing: "-0.01em",
  border: "1px solid rgba(255,255,255,0.10)",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const PILL_TONES = {
  danger: {
    background: "rgba(255, 59, 48, 0.14)",
    color: "rgba(255,210,208,0.95)",
    border: "1px solid rgba(255,59,48,0.28)",
  },
  warn: {
    background: "rgba(255, 204, 0, 0.12)",
    color: "rgba(255,240,200,0.95)",
    border: "1px solid rgba(255,204,0,0.30)",
  },
  good: {
    background: "rgba(52,199,89,0.12)",
    color: "rgba(214,255,226,0.95)",
    border: "1px solid rgba(52,199,89,0.30)",
  },
  muted: {
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  muted2: {
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
};

function Pill({ tone, text }) {
  return (
    <span style={{ ...PILL_BASE, ...(PILL_TONES[tone] || PILL_TONES.muted) }}>
      {text}
    </span>
  );
}

function applyPressScale(e, scale = 0.99) {
  e.currentTarget.style.transform = `scale(${scale})`;
  setTimeout(() => {
    if (e.currentTarget) e.currentTarget.style.transform = "scale(1)";
  }, 120);
}

function applyHoverLift(
  e,
  { open, liftPx, hoverShadow, openShadow, closedShadow }
) {
  e.currentTarget.style.transform = `translateY(-${liftPx}px) scale(1.01)`;
  e.currentTarget.style.boxShadow = hoverShadow;
  e.currentTarget.dataset._open = open ? "1" : "0";
  e.currentTarget.dataset._openShadow = openShadow;
  e.currentTarget.dataset._closedShadow = closedShadow;
}

function clearHoverLift(e) {
  const open = e.currentTarget.dataset._open === "1";
  e.currentTarget.style.transform = "translateY(0) scale(1)";
  e.currentTarget.style.boxShadow = open
    ? e.currentTarget.dataset._openShadow
    : e.currentTarget.dataset._closedShadow;
}

function GroupHeader({
  variant = "top",
  title,
  subtitle,
  open,
  onToggle,
  counts,
}) {
  const overdue = counts?.overdue ?? 0;
  const due = counts?.due ?? 0;
  const notCompleted = counts?.notCompleted ?? 0;
  const complete = counts?.complete ?? 0;
  const inactive = counts?.inactive ?? 0;

  const isTop = variant === "top";

  const liftPx = 2;
  const hoverShadow = isTop
    ? "0 28px 64px rgba(0,0,0,0.38)"
    : "0 22px 54px rgba(0,0,0,0.30)";
  const openShadow = isTop
    ? "0 18px 46px rgba(0,0,0,0.28)"
    : "0 14px 34px rgba(0,0,0,0.18)";
  const closedShadow = isTop
    ? "0 12px 30px rgba(0,0,0,0.18)"
    : "0 10px 24px rgba(0,0,0,0.14)";

  const radius = isTop ? 18 : 16;
  const pad = isTop ? "14px 14px" : "12px 12px";

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={(e) =>
        applyHoverLift(e, {
          open,
          liftPx,
          hoverShadow,
          openShadow,
          closedShadow,
        })
      }
      onMouseLeave={clearHoverLift}
      onMouseDown={(e) => applyPressScale(e, isTop ? 0.99 : 0.992)}
      style={{
        width: "100%",
        cursor: "pointer",
        userSelect: "none",
        padding: pad,
        borderRadius: radius,
        border: open
          ? "1px solid rgba(255,255,255,0.14)"
          : "1px solid rgba(255,255,255,0.10)",
        background: isTop
          ? open
            ? "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.12) 100%)"
            : "rgba(0,0,0,0.16)"
          : open
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.12)",
        boxShadow: open ? openShadow : closedShadow,
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
      aria-expanded={open}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: isTop ? 14 : 13,
            fontWeight: 900,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, fontWeight: 750, opacity: 0.62 }}>
          {isTop ? subtitle : "Details"}
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
            color="rgba(255,59,48,0.90)"
            count={overdue}
            title={`Overdue: ${overdue}`}
          />
          <DotCount
            color="rgba(255,204,0,0.90)"
            count={due}
            title={`Due soon: ${due}`}
          />
          <DotCount
            color="rgba(175,175,180,0.90)"
            count={notCompleted}
            title={`Not completed: ${notCompleted}`}
          />
          <DotCount
            color="rgba(52,199,89,0.90)"
            count={complete}
            title={`Complete: ${complete}`}
          />
          <DotCount
            color="rgba(120,120,128,0.70)"
            count={inactive}
            title={`Inactive: ${inactive}`}
          />
        </div>
        <Chevron open={open} size={isTop ? 26 : 24} />
      </div>
    </button>
  );
}

function StatCard({ label, value, tone, selected, onClick }) {
  const tones = {
    danger: "rgba(255,59,48,0.10)",
    warn: "rgba(255,204,0,0.08)",
    good: "rgba(52,199,89,0.08)",
    muted: "rgba(255,255,255,0.06)",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: "1 1 170px",
        padding: 12,
        borderRadius: 16,
        border: selected
          ? "1px solid rgba(0,122,255,0.55)"
          : "1px solid rgba(255,255,255,0.10)",
        background: selected
          ? "linear-gradient(180deg, rgba(0,122,255,0.18) 0%, rgba(255,255,255,0.06) 100%)"
          : tones[tone] || tones.muted,
        boxShadow: selected
          ? "0 18px 40px rgba(0,122,255,0.18)"
          : "0 14px 34px rgba(0,0,0,0.18)",
        color: "rgba(255,255,255,0.92)",
        cursor: "pointer",
        textAlign: "left",
        transition:
          "transform 120ms ease, box-shadow 160ms ease, background 160ms ease",
      }}
      onMouseDown={(e) => applyPressScale(e, 0.98)}
      title="Click to filter"
    >
      <div
        style={{
          fontSize: 12,
          opacity: 0.78,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: -0.3 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
        {selected ? "Filtering" : "Tap to filter"}
      </div>
    </button>
  );
}

function RecordRow({
  S,
  r,
  markRecordComplete,
  openHistory,
  isFirst,
  isLast,
  titleMode,
  layout,
  trainingGroupName,
}) {
  const tone = statusTone(r);
  const label = statusLabel(r);

  const isList = layout === "list";

  const mainTitle = titleMode === "crewView" ? r.trainingName : r.crewName;

  const secondary =
    titleMode === "crewView"
      ? `Due: ${r.dueDate || "—"} · Last: ${r.lastCompleted || "—"}`
      : `Crew: ${r.crewName || "—"} · Due: ${r.dueDate || "—"} · Last: ${
          r.lastCompleted || "—"
        }`;

  const hoverLift = (e) => {
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 12px 26px rgba(0,0,0,0.22)";
    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
  };

  const hoverOff = (e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.background = "transparent";
  };

  return (
    <div
      onMouseEnter={hoverLift}
      onMouseLeave={hoverOff}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        padding: "12px 12px",
        borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: isFirst ? "14px 14px 0 0" : isLast ? "0 0 14px 14px" : 0,
        background: "transparent",
        transition:
          "transform 140ms ease, box-shadow 180ms ease, background 160ms ease",
        willChange: "transform",
      }}
    >
      <div style={{ minWidth: 0 }}>
        {isList ? (
          <>
            <div style={{ fontSize: 14.5, fontWeight: 860, letterSpacing: "-0.01em" }}>
              {r.crewName || "—"}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 720, opacity: 0.88 }}>
              {r.trainingName || "—"}
            </div>
            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                fontSize: 12,
                fontWeight: 700,
                opacity: 0.7,
              }}
            >
              <span>{r.trackName || "—"}</span>
              <span style={{ opacity: 0.35 }}>•</span>
              <span>{trainingGroupName || "—"}</span>
              <span style={{ opacity: 0.35 }}>•</span>
              <span>Due: {r.dueDate || "—"}</span>
              <span style={{ opacity: 0.35 }}>•</span>
              <span>Last: {r.lastCompleted || "—"}</span>
            </div>
          </>
        ) : (
          <>
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
                {mainTitle}
              </div>
              <Pill tone={tone} text={label} />
              <div style={S.helper}>{daysText(r)}</div>
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                fontWeight: 700,
                opacity: 0.82,
              }}
            >
              <span style={{ opacity: 0.95 }}>{r.trackName}</span>
              <span style={{ opacity: 0.55 }}> · </span>
              <span style={{ opacity: 0.78 }}>{secondary}</span>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <Pill tone={tone} text={label} />
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              style={S.button("ghost")}
              onClick={() => openHistory(r)}
              title="View completion history"
            >
              History
            </button>

            <button
              style={S.button("subtle")}
              onClick={() => markRecordComplete(r)}
              title="Set completed date and reset the cycle"
            >
              Mark Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ----------------------------- Grouping ----------------------------- */

function computeCounts(items) {
  let overdue = 0;
  let due = 0;
  let notCompleted = 0;
  let complete = 0;
  let inactive = 0;

  for (const r of items) {
    if (!r.active) {
      inactive += 1;
      continue;
    }
    const s = statusLabel(r);
    if (s === "Overdue") overdue += 1;
    else if (s === "Due soon") due += 1;
    else if (s === "Not completed") notCompleted += 1;
    else complete += 1;
  }

  return { overdue, due, notCompleted, complete, inactive };
}

function sortGroupList(groups) {
  const g = [...groups];
  g.sort((a, b) =>
    String(a.title).localeCompare(String(b.title), undefined, {
      sensitivity: "base",
    })
  );
  return g;
}

function sortRecords(items, tieNameField) {
  const arr = [...items];
  arr.sort((a, b) =>
    String(a[tieNameField] || "").localeCompare(
      String(b[tieNameField] || ""),
      undefined,
      { sensitivity: "base" }
    )
  );
  return arr;
}

const KEY_SEP = "§";

function makeKey(...parts) {
  return parts.map((p) => String(p)).join(KEY_SEP);
}

function pruneByPrefix(set, prefix) {
  const next = new Set(set);
  const p = String(prefix);
  for (const k of next) {
    if (String(k).startsWith(p)) next.delete(k);
  }
  return next;
}

function buildHierarchy(records, levels, leafSortTieField) {
  const root = new Map();

  for (const r of records) {
    let cursor = root;
    let rawPath = [];

    for (let i = 0; i < levels.length; i++) {
      const L = levels[i];
      const rawKey = L.keyOf(r);
      const title = L.titleOf(r);
      const pathKey = makeKey(...rawPath, rawKey);

      if (!cursor.has(rawKey)) {
        cursor.set(rawKey, {
          rawKey,
          key: pathKey,
          title,
          map: new Map(),
          items: [],
        });
      }

      const node = cursor.get(rawKey);
      if (i === levels.length - 1) node.items.push(r);
      rawPath = [...rawPath, rawKey];
      cursor = node.map;
    }
  }

  const materialize = (map) => {
    const nodes = Array.from(map.values()).map((node) => {
      const hasChildren = node.map && node.map.size > 0;

      if (!hasChildren) {
        const items = sortRecords(node.items, leafSortTieField);
        const counts = computeCounts(items);
        return {
          key: node.key,
          title: node.title,
          counts,
          overdue: counts.overdue,
          due: counts.due,
          notCompleted: counts.notCompleted,
          children: [],
          items,
          _allItems: items,
        };
      }

      let children = materialize(node.map);
      children = sortGroupList(children);

      const allItems = children.flatMap((c) => c._allItems || []);
      const counts = computeCounts(allItems);

      return {
        key: node.key,
        title: node.title,
        counts,
        overdue: counts.overdue,
        due: counts.due,
        notCompleted: counts.notCompleted,
        children,
        items: null,
        _allItems: allItems,
      };
    });

    return nodes;
  };

  const roots = sortGroupList(materialize(root));

  const strip = (n) => {
    const { _allItems, ...rest } = n;
    if (rest.children?.length) rest.children = rest.children.map(strip);
    return rest;
  };

  return roots.map(strip);
}

/** ----------------------------- Component ----------------------------- */

export default function RecordsTab({
  S,
  crew,
  tracks,
  trainings,
  trainingGroups,
  visibleTrainingRecords,
  recordsLoading,
  recordsError,
  recordsCrewId,
  setRecordsCrewId,
  recordsTrackId,
  setRecordsTrackId,
  recordsTrainingId,
  setRecordsTrainingId,
  loadTrainingRecords,
  markRecordComplete,
  openHistory,
}) {
  const [viewMode, setViewMode] = useState("list");
  const [q, setQ] = useState("");
  const [statFilter, setStatFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const trainingById = useMemo(() => {
    const map = new Map();
    for (const t of trainings || []) map.set(String(t.id), t);
    return map;
  }, [trainings]);

  const trainingGroupById = useMemo(() => {
    const map = new Map();
    for (const g of trainingGroups || []) map.set(String(g.id), g);
    return map;
  }, [trainingGroups]);

  const getTrainingGroupName = useCallback(
    (r) => {
      const t = trainingById.get(String(r.trainingId));
      if (!t) return "—";
      if (t.trainingGroupId == null) return "Ungrouped";
      return (
        trainingGroupById.get(String(t.trainingGroupId))?.name || "Ungrouped"
      );
    },
    [trainingById, trainingGroupById]
  );

  const [expandedByView, setExpandedByView] = useState(() => ({
    crew: new Set(),
    training: new Set(),
    trainingGroup: new Set(),
    department: new Set(),
    list: new Set(),
  }));

  const setViewModeSafe = useCallback((v) => {
    setViewMode(v);
    if (v === "list") {
      setStatusFilter("ACTIVE");
      setStatFilter("ALL");
    }
  }, []);

  const expanded = useMemo(
    () => expandedByView[viewMode] || EMPTY_SET,
    [expandedByView, viewMode]
  );

  const setExpanded = useCallback(
    (updater) => {
      setExpandedByView((prev) => {
        const current = prev[viewMode] || new Set();
        const nextSet =
          typeof updater === "function" ? updater(current) : updater;
        return { ...prev, [viewMode]: nextSet };
      });
    },
    [viewMode]
  );

  const toggleKey = useCallback(
    (key) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
          return pruneByPrefix(next, `${key}${KEY_SEP}`);
        }
        next.add(key);
        return next;
      });
    },
    [setExpanded]
  );

  const baseFiltered = useMemo(() => {
    let rows = visibleTrainingRecords;

    if (statusFilter === "ACTIVE")
      rows = rows.filter((r) => r.active !== false);
    if (statusFilter === "INACTIVE")
      rows = rows.filter((r) => r.active === false);

    const query = (q || "").trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((r) => {
      const hay = `${r.crewName || ""} ${r.trackName || ""} ${
        r.trainingName || ""
      }`.toLowerCase();
      return hay.includes(query);
    });
  }, [visibleTrainingRecords, q, statusFilter]);

  const filtered = useMemo(() => {
    if (statFilter === "ALL") return baseFiltered;

    return baseFiltered.filter((r) => {
      const s = statusLabel(r);
      if (statFilter === "OVERDUE") return s === "Overdue";
      if (statFilter === "DUE") return s === "Due soon";
      if (statFilter === "NOT_COMPLETED") return s === "Not completed";
      if (statFilter === "COMPLETE")
        return s === "Complete" || s === "Never expires";
      return true;
    });
  }, [baseFiltered, statFilter]);

  const stats = useMemo(() => computeCounts(baseFiltered), [baseFiltered]);

  const listSorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const crewCmp = String(a.crewName || "").localeCompare(
        String(b.crewName || ""),
        undefined,
        { sensitivity: "base" }
      );
      if (crewCmp !== 0) return crewCmp;

      const trainingCmp = String(a.trainingName || "").localeCompare(
        String(b.trainingName || ""),
        undefined,
        { sensitivity: "base" }
      );
      if (trainingCmp !== 0) return trainingCmp;

      return String(a.trackName || "").localeCompare(
        String(b.trackName || ""),
        undefined,
        { sensitivity: "base" }
      );
    });
    return arr;
  }, [filtered]);
  const crewSubtitleByKey = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const ck = String(r.crewId ?? r.crewName ?? "Unknown");
      if (!map.has(ck)) map.set(ck, r.homeDepartment || "");
    }
    return map;
  }, [filtered]);

  const groupedByCrew = useMemo(
    () =>
      buildHierarchy(
        filtered,
        [
          {
            keyOf: (r) => String(r.crewId ?? r.crewName ?? "Unknown"),
            titleOf: (r) => r.crewName || "Unknown",
          },
          {
            keyOf: (r) => String(r.trackId ?? r.trackName ?? "Unknown Track"),
            titleOf: (r) => r.trackName || "Unknown Track",
          },
        ],
        "trainingName"
      ),
    [filtered]
  );

  const groupedByTraining = useMemo(
    () =>
      buildHierarchy(
        filtered,
        [
          {
            keyOf: (r) =>
              String(r.trainingId ?? r.trainingName ?? "Unknown Training"),
            titleOf: (r) => r.trainingName || "Unknown Training",
          },
          {
            keyOf: (r) => String(r.trackId ?? r.trackName ?? "Unknown Track"),
            titleOf: (r) => r.trackName || "Unknown Track",
          },
        ],
        "crewName"
      ),
    [filtered]
  );

  const groupedByTrainingGroup = useMemo(
    () =>
      buildHierarchy(
        filtered,
        [
          {
            keyOf: (r) => {
              const t = trainingById.get(String(r.trainingId));
              if (!t || t.trainingGroupId == null) return "Ungrouped";
              return String(t.trainingGroupId);
            },
            titleOf: (r) => getTrainingGroupName(r),
          },
          {
            keyOf: (r) =>
              String(r.trainingId ?? r.trainingName ?? "Unknown Training"),
            titleOf: (r) => r.trainingName || "Unknown Training",
          },
        ],
        "crewName"
      ),
    [filtered, trainingById, getTrainingGroupName]
  );

  const groupedByDepartment = useMemo(
    () =>
      buildHierarchy(
        filtered,
        [
          {
            keyOf: (r) => {
              const d = (r.homeDepartment || "").trim();
              return d ? prettyTitle(d) : "No Department";
            },
            titleOf: (r) => {
              const d = (r.homeDepartment || "").trim();
              return d ? prettyTitle(d) : "No Department";
            },
          },
          {
            keyOf: (r) => String(r.crewId ?? r.crewName ?? "Unknown"),
            titleOf: (r) => r.crewName || "Unknown",
          },
          {
            keyOf: (r) => String(r.trackId ?? r.trackName ?? "Unknown Track"),
            titleOf: (r) => r.trackName || "Unknown Track",
          },
        ],
        "trainingName"
      ),
    [filtered]
  );

  const groupsForView = useMemo(() => {
    if (viewMode === "list") return [];
    if (viewMode === "training") return groupedByTraining;
    if (viewMode === "trainingGroup") return groupedByTrainingGroup;
    if (viewMode === "department") return groupedByDepartment;
    return groupedByCrew;
  }, [
    viewMode,
    groupedByCrew,
    groupedByTraining,
    groupedByTrainingGroup,
    groupedByDepartment,
  ]);

  const viewConfig = useMemo(() => {
    if (viewMode === "training") {
      return { titleMode: "trainingView", subtitleOfTop: () => "Tracks" };
    }
    if (viewMode === "trainingGroup") {
      return { titleMode: "trainingView", subtitleOfTop: () => "Trainings" };
    }
    if (viewMode === "department") {
      return { titleMode: "crewView", subtitleOfTop: () => "Department" };
    }
    if (viewMode === "list") {
      return { titleMode: "crewView", subtitleOfTop: () => "" };
    }
    return {
      titleMode: "crewView",
      subtitleOfTop: (g) => {
        const topKey = String(g.key).split(KEY_SEP)[0];
        const homeDept = crewSubtitleByKey.get(topKey) || "";
        return homeDept ? prettyTitle(homeDept) : "—";
      },
    };
  }, [viewMode, crewSubtitleByKey]);

  const activeChips = useMemo(() => {
    const chips = [];

    if (recordsCrewId !== "ALL") {
      const c = crew.find((x) => String(x.id) === String(recordsCrewId));
      chips.push({
        key: "crew",
        text: `Crew: ${c?.name || recordsCrewId}`,
        clear: () => setRecordsCrewId("ALL"),
      });
    }
    if (recordsTrackId !== "ALL") {
      const t = tracks.find((x) => String(x.id) === String(recordsTrackId));
      chips.push({
        key: "track",
        text: `Track: ${t?.name || recordsTrackId}`,
        clear: () => setRecordsTrackId("ALL"),
      });
    }
    if (recordsTrainingId !== "ALL") {
      const tr = trainings.find(
        (x) => String(x.id) === String(recordsTrainingId)
      );
      chips.push({
        key: "training",
        text: `Training: ${tr?.name || recordsTrainingId}`,
        clear: () => setRecordsTrainingId("ALL"),
      });
    }
    if ((q || "").trim()) {
      chips.push({
        key: "q",
        text: `Search: ${(q || "").trim()}`,
        clear: () => setQ(""),
      });
    }

    if (statusFilter !== "ACTIVE") {
      const map = { ACTIVE: "Active", INACTIVE: "Inactive", ALL: "All" };
      chips.push({
        key: "status",
        text: `Status: ${map[statusFilter] || statusFilter}`,
        clear: () => setStatusFilter("ACTIVE"),
      });
    }

    if (statFilter !== "ALL") {
      const map = {
        OVERDUE: "Overdue",
        DUE: "Due soon",
        NOT_COMPLETED: "Not completed",
        COMPLETE: "Complete",
      };
      chips.push({
        key: "stat",
        text: `Focus: ${map[statFilter] || statFilter}`,
        clear: () => setStatFilter("ALL"),
      });
    }

    return chips;
  }, [
    crew,
    tracks,
    trainings,
    recordsCrewId,
    recordsTrackId,
    recordsTrainingId,
    q,
    statFilter,
    statusFilter,
    setRecordsCrewId,
    setRecordsTrackId,
    setRecordsTrainingId,
  ]);

  const resetAll = useCallback(() => {
    setRecordsCrewId("ALL");
    setRecordsTrackId("ALL");
    setRecordsTrainingId("ALL");
    setQ("");
    setStatFilter("ALL");
    setStatusFilter("ACTIVE");
    setViewMode("list");
    setFiltersOpen(false);

    setExpandedByView({
      crew: new Set(),
      training: new Set(),
      trainingGroup: new Set(),
      department: new Set(),
      list: new Set(),
    });
  }, [setRecordsCrewId, setRecordsTrackId, setRecordsTrainingId]);

  const expandTop = useCallback(() => {
    if (viewMode === "list") return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const g of groupsForView) next.add(g.key);
      return next;
    });
  }, [setExpanded, groupsForView, viewMode]);

  const collapseTop = useCallback(() => {
    if (viewMode === "list") return;
    setExpanded(new Set());
  }, [setExpanded, viewMode]);

  const stickyShell = useMemo(
    () => ({
      position: "sticky",
      top: 0,
      zIndex: 3,
      padding: "12px 0 12px",
      marginBottom: 14,
      backdropFilter: "blur(14px)",
      background:
        "linear-gradient(180deg, rgba(16,18,26,0.92) 0%, rgba(16,18,26,0.72) 65%, rgba(16,18,26,0.00) 100%)",
    }),
    []
  );

  const commandBar = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      padding: 12,
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.22)",
      boxShadow: "0 16px 44px rgba(0,0,0,0.18)",
    }),
    []
  );

  const filterPanel = useMemo(
    () => ({
      overflow: "hidden",
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.10)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.20) 100%)",
      boxShadow: "0 14px 40px rgba(0,0,0,0.16)",
      maxHeight: filtersOpen ? 240 : 0,
      opacity: filtersOpen ? 1 : 0,
      transform: filtersOpen ? "translateY(0px)" : "translateY(-6px)",
      transition:
        "max-height 220ms ease, opacity 180ms ease, transform 220ms ease",
    }),
    [filtersOpen]
  );

  const renderLeafCard = useCallback(
    (items, titleMode, layout) => (
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
          {items.map((r, idx) => (
            <RecordRow
              key={r.id}
              S={S}
              r={r}
              markRecordComplete={markRecordComplete}
              openHistory={openHistory}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
              titleMode={titleMode}
              layout={layout}
              trainingGroupName={getTrainingGroupName(r)}
            />
          ))}
        </div>
      </div>
    ),
    [S, markRecordComplete, openHistory, getTrainingGroupName]
  );

  const renderNode = useCallback(
    (node, depth, cfg) => {
      const open = expanded.has(node.key);
      const isTop = depth === 0;

      const subtitle =
        isTop && cfg.subtitleOfTop
          ? cfg.subtitleOfTop(node)
          : isTop
          ? "—"
          : undefined;

      return (
        <div
          key={node.key}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <GroupHeader
            variant={isTop ? "top" : "sub"}
            title={node.title}
            subtitle={subtitle}
            open={open}
            onToggle={() => toggleKey(node.key)}
            counts={node.counts}
          />

          {open && (
            <div
              style={{
                marginLeft: isTop ? 18 : 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {node.children?.length
                ? node.children.map((c) => renderNode(c, depth + 1, cfg))
                : renderLeafCard(node.items || [], cfg.titleMode, "group")}
            </div>
          )}
        </div>
      );
    },
    [expanded, toggleKey, renderLeafCard]
  );

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={S.cardTitle}>Training Records</h2>
          <div style={S.helper}>
            Training History and Recertification Tracking
          </div>
        </div>

        <div style={S.row}>
        </div>
      </div>

      <div style={S.cardBody}>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <StatCard
            label="Overdue"
            value={stats.overdue}
            tone="danger"
            selected={statFilter === "OVERDUE"}
            onClick={() =>
              setStatFilter((p) => (p === "OVERDUE" ? "ALL" : "OVERDUE"))
            }
          />
          <StatCard
            label="Due soon"
            value={stats.due}
            tone="warn"
            selected={statFilter === "DUE"}
            onClick={() => setStatFilter((p) => (p === "DUE" ? "ALL" : "DUE"))}
          />
          <StatCard
            label="Complete"
            value={stats.complete}
            tone="good"
            selected={statFilter === "COMPLETE"}
            onClick={() =>
              setStatFilter((p) => (p === "COMPLETE" ? "ALL" : "COMPLETE"))
            }
          />
          <StatCard
            label="Not completed"
            value={stats.notCompleted}
            tone="muted"
            selected={statFilter === "NOT_COMPLETED"}
            onClick={() =>
              setStatFilter((p) =>
                p === "NOT_COMPLETED" ? "ALL" : "NOT_COMPLETED"
              )
            }
          />
        </div>

        <div style={stickyShell}>
          <div style={commandBar}>
            <Segmented
              value={viewMode}
              onChange={setViewModeSafe}
              options={[
                { value: "list", label: "List" },
                { value: "crew", label: "By Crew" },
                { value: "training", label: "By Training" },
                { value: "trainingGroup", label: "By Training Group" },
                { value: "department", label: "By Dept" },
              ]}
            />

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search crew, track, training"
              style={{ ...S.input, width: 320, flex: "1 1 240px" }}
            />

            <button
              type="button"
              style={S.button(filtersOpen ? "primary" : "subtle")}
              onClick={() => setFiltersOpen((p) => !p)}
              title="Show filters"
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
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, 1fr)",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ gridColumn: "span 3", minWidth: 0 }}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Crew</div>
                  <select
                    value={recordsCrewId}
                    onChange={(e) => setRecordsCrewId(e.target.value)}
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

                <div style={{ gridColumn: "span 3", minWidth: 0 }}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Track</div>
                  <select
                    value={recordsTrackId}
                    onChange={(e) => setRecordsTrackId(e.target.value)}
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

                <div style={{ gridColumn: "span 3", minWidth: 0 }}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Training</div>
                  <select
                    value={recordsTrainingId}
                    onChange={(e) => setRecordsTrainingId(e.target.value)}
                    style={{ ...S.select, width: "100%" }}
                  >
                    <option value="ALL">All trainings</option>
                    {trainings.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: "span 3", minWidth: 0 }}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Status</div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ ...S.select, width: "100%" }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ALL">All</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={S.button("ghost")}
                    onClick={() => setFiltersOpen(false)}
                  >
                    Done
                  </button>
                  <button style={S.button("subtle")} onClick={resetAll}>
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {activeChips.map((c) => (
                <Chip key={c.key} text={c.text} onClear={c.clear} />
              ))}
            </div>
          )}
        </div>

        {recordsLoading && <p style={S.loading}>Loading training records...</p>}
        {recordsError && <p style={S.error}>{recordsError}</p>}

        {!recordsLoading && !recordsError && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {viewMode === "list" ? (
              listSorted.length > 0 ? (
                renderLeafCard(listSorted, "crewView", "list")
              ) : (
                <div style={{ padding: 18, opacity: 0.75 }}>
                  No records match your filters.
                </div>
              )
            ) : (
              <>
                {groupsForView.map((g) => renderNode(g, 0, viewConfig))}
                {filtered.length === 0 && (
                  <div style={{ padding: 18, opacity: 0.75 }}>
                    No records match your filters.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
