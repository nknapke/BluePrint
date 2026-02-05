// TrainingsTab.js
// Keeps ALL existing features (edit, add group inline, pills, search, expand/collapse)
// Adds a new grouping view: By Group (and keeps By Status as an option)

import { useMemo, useState, useCallback, useEffect } from "react";
import { Segmented } from "../components/ui/Segmented";
import { useExpandableKeys } from "../hooks/useExpandableKeys";

/** ---------- helpers ---------- */

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

  trainingGroups = /** @type {any[]} */ ([]),
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
