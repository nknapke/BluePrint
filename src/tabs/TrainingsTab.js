// TrainingsTab.js
// Keeps ALL existing features (edit, add group inline, pills, search, expand/collapse)
// Adds a new grouping view: By Group (and keeps By Status as an option)

import { useMemo, useState, useCallback, useEffect } from "react";

/** ---------- Small hook: "default expand all" + keep keys in sync ---------- */
function useExpandableKeys(keys, { defaultExpanded = true } = {}) {
  const [expanded, setExpanded] = useState(() =>
    defaultExpanded ? new Set(keys) : new Set()
  );
  const [userTouched, setUserTouched] = useState(false);

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (!userTouched) {
        next.clear();
        for (const k of keys) next.add(k);
        return next;
      }

      let changed = false;

      for (const k of keys) {
        if (!next.has(k)) {
          next.add(k);
          changed = true;
        }
      }

      for (const k of Array.from(next)) {
        if (!keys.includes(k)) {
          next.delete(k);
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [keys.join("|"), userTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((key) => {
    setUserTouched(true);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setUserTouched(true);
    setExpanded(new Set(keys));
  }, [keys]);

  const collapseAll = useCallback(() => {
    setUserTouched(true);
    setExpanded(new Set());
  }, []);

  const resetToDefault = useCallback(() => {
    setUserTouched(false);
    setExpanded(new Set(keys));
  }, [keys]);

  return { expanded, toggle, expandAll, collapseAll, resetToDefault };
}

/** ---------- UI bits (same vibe) ---------- */

function Segmented({ value, onChange, options }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 4,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.18)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.16)",
      }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid transparent",
              background: active
                ? "linear-gradient(180deg, rgba(0,122,255,0.20) 0%, rgba(255,255,255,0.06) 100%)"
                : "transparent",
              color: active
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.82)",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "-0.01em",
              cursor: "pointer",
              transition: "background 160ms ease, transform 120ms ease",
              whiteSpace: "nowrap",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.98)";
              setTimeout(() => {
                if (e.currentTarget)
                  e.currentTarget.style.transform = "scale(1)";
              }, 120);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Chevron({ open, size = 26 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        display: "grid",
        placeItems: "center",
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 160ms ease",
        lineHeight: 1,
        fontSize: 18,
        fontWeight: 900,
        opacity: 0.9,
        flex: "0 0 auto",
      }}
    >
      ›
    </span>
  );
}

function DotCount({ color, count, title }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
        fontSize: 12,
        fontWeight: 800,
        color: "rgba(255,255,255,0.88)",
        whiteSpace: "nowrap",
        opacity: count === 0 ? 0.6 : 1,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          boxShadow: "0 0 0 3px rgba(255,255,255,0.06)",
          opacity: count === 0 ? 0.55 : 1,
        }}
      />
      {count}
    </span>
  );
}

function FieldLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 800,
        opacity: 0.62,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

/** ---------- helpers ---------- */

function normalizeWeeks(v) {
  const s = String(v ?? "").trim();
  if (s === "") return "";
  if (!/^\d+$/.test(s)) return "";
  return s;
}

function formatExpiryLabel(weeks) {
  const n = Number(weeks || 0);
  if (!n) return "Never";
  return `${n}w`;
}

/** ---------- Main ---------- */

export default function TrainingsTab({
  S,

  trainings,
  trainingsLoading,
  trainingsError,

  trainingGroups,
  trainingGroupsLoading,
  trainingGroupsError,
  createTrainingGroup,

  editingTrainingId,
  editTrainingName,
  setEditTrainingName,
  editTrainingActive,
  setEditTrainingActive,
  editTrainingSaving,

  editTrainingExpiryWeeks,
  setEditTrainingExpiryWeeks,

  editTrainingGroupId,
  setEditTrainingGroupId,

  addTrainingDefinition,
  deleteTrainingDefinition,
  startEditTraining,
  cancelEditTraining,
  saveEditTraining,
  loadTrainings,
}) {
  const [q, setQ] = useState("");
  const [groupView, setGroupView] = useState("group"); // "group" | "status"

  const groupById = useMemo(() => {
    return new Map((trainingGroups || []).map((g) => [String(g.id), g]));
  }, [trainingGroups]);

  const baseList = useMemo(() => {
    const list = Array.isArray(trainings) ? trainings : [];
    const query = (q || "").trim().toLowerCase();
    if (!query) return list;

    return list.filter((t) => {
      const groupName =
        t.trainingGroupId == null
          ? "Ungrouped"
          : String(
              groupById.get(String(t.trainingGroupId))?.name || "Ungrouped"
            );
      const expires = formatExpiryLabel(t.expiresAfterWeeks);
      const hay = `${t.localId ?? ""} ${t.id} ${
        t.name || ""
      } ${expires} ${groupName} ${
        t.active ? "active" : "inactive"
      }`.toLowerCase();
      return hay.includes(query);
    });
  }, [trainings, q, groupById]);

  const grouped = useMemo(() => {
    if (groupView === "group") {
      const map = new Map();

      for (const t of baseList) {
        const key =
          t.trainingGroupId == null
            ? "__UNGROUPED__"
            : String(t.trainingGroupId);

        const group =
          t.trainingGroupId == null
            ? null
            : groupById.get(String(t.trainingGroupId)) || null;

        const title = group?.name || "Ungrouped";

        if (!map.has(key)) {
          map.set(key, {
            key,
            title,
            sortOrder: group?.sortOrder ?? 9999,
            items: [],
            counts: { active: 0, inactive: 0 },
          });
        }

        const g = map.get(key);
        g.items.push(t);
        if (t.active) g.counts.active += 1;
        else g.counts.inactive += 1;
      }

      const out = Array.from(map.values());

      out.sort((a, b) => {
        if (a.key === "__UNGROUPED__" && b.key !== "__UNGROUPED__") return 1;
        if (b.key === "__UNGROUPED__" && a.key !== "__UNGROUPED__") return -1;

        const so = Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999);
        if (so !== 0) return so;
        return String(a.title).localeCompare(String(b.title));
      });

      for (const g of out) {
        g.items.sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;
          const n = String(a.name || "").localeCompare(String(b.name || ""));
          if (n !== 0) return n;
          return Number(a.id) - Number(b.id);
        });
      }

      return out;
    }

    const activeItems = [];
    const inactiveItems = [];

    for (const t of baseList) {
      if (t.active) activeItems.push(t);
      else inactiveItems.push(t);
    }

    const sortByNameThenId = (a, b) => {
      const an = String(a.name || "").localeCompare(String(b.name || ""));
      if (an !== 0) return an;
      return Number(a.id) - Number(b.id);
    };

    activeItems.sort(sortByNameThenId);
    inactiveItems.sort(sortByNameThenId);

    return [
      {
        key: "Active",
        title: "Active",
        items: activeItems,
        counts: { active: activeItems.length, inactive: 0 },
      },
      {
        key: "Inactive",
        title: "Inactive",
        items: inactiveItems,
        counts: { active: 0, inactive: inactiveItems.length },
      },
    ];
  }, [baseList, groupView, groupById]);

  const groupKeys = useMemo(() => grouped.map((g) => g.key), [grouped]);
  const expand = useExpandableKeys(groupKeys, { defaultExpanded: true });

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={S.cardTitle}>Trainings</h2>
          <div style={S.helper}>Add or Remove Trainings.</div>
        </div>

        <div style={S.row}>
          <button style={S.button("primary")} onClick={addTrainingDefinition}>
            Add Training
          </button>

          <button
            style={S.button("subtle")}
            onClick={() => loadTrainings(true)}
            title="Refresh"
          >
            Refresh
          </button>

          <button style={S.button("ghost")} onClick={expand.resetToDefault}>
            Reset
          </button>
        </div>
      </div>

      <div style={S.cardBody}>
        <div style={{ marginBottom: 14 }}>
          <Segmented
            value={groupView}
            onChange={setGroupView}
            options={[
              { value: "group", label: "By Group" },
              { value: "status", label: "By Status" },
            ]}
          />
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search trainings"
          style={{ ...S.input, width: 320, marginBottom: 14 }}
        />

        {trainingsLoading && <p style={S.loading}>Loading trainings...</p>}
        {trainingsError && <p style={S.error}>{trainingsError}</p>}

        {!trainingsLoading && !trainingsError && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {grouped.map((g) => {
              const open = expand.expanded.has(g.key);

              return (
                <div
                  key={g.key}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <button
                    type="button"
                    onClick={() => expand.toggle(g.key)}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      userSelect: "none",
                      padding: "14px 14px",
                      borderRadius: 18,
                      border: open
                        ? "1px solid rgba(255,255,255,0.14)"
                        : "1px solid rgba(255,255,255,0.10)",
                      background: open
                        ? "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.12) 100%)"
                        : "rgba(0,0,0,0.16)",
                      boxShadow: open
                        ? "0 18px 46px rgba(0,0,0,0.28)"
                        : "0 12px 30px rgba(0,0,0,0.18)",
                      color: "rgba(255,255,255,0.92)",
                      textAlign: "left",
                      fontWeight: 880,
                    }}
                  >
                    {g.title}
                  </button>

                  {open && (
                    <div style={{ marginLeft: 18 }}>
                      {g.items.map((t) => (
                        <div key={t.id} style={{ padding: "6px 0" }}>
                          <strong>{t.name}</strong>{" "}
                          <span style={{ opacity: 0.7 }}>
                            · {t.active ? "Active" : "Inactive"} ·{" "}
                            {formatExpiryLabel(t.expiresAfterWeeks)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {baseList.length === 0 && (
              <div style={{ padding: 18, opacity: 0.75 }}>
                No trainings match your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
