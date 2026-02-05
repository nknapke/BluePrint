// TrainingsTab.tsx
// Keeps ALL existing features (edit, add group inline, pills, search, expand/collapse)
// Adds a new grouping view: By Group (and keeps By Status as an option)

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, Dispatch, MouseEvent, SetStateAction } from "react";
import { Segmented } from "../components/ui/Segmented";
import { useExpandableKeys } from "../hooks/useExpandableKeys";
import { Chevron } from "../components/ui/Chevron";
import { DotCount } from "../components/ui/DotCount";
import { FieldLabel } from "../components/ui/FieldLabel";
import { IdMeta } from "../components/ui/IdMeta";
import { StatusBadge } from "../components/ui/Badges";
import type { YesNo } from "../app/constants";
import type { Training, TrainingGroup } from "../types/domain";

/** ---------- helpers ---------- */

const UNGROUPED_KEY = "__UNGROUPED__";

function formatExpiryLabel(weeks?: number | null) {
  const n = Number(weeks || 0);
  if (!n) return "Never";
  return `${n}w`;
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err ?? "Unknown error");
}

function GroupHeaderIOS({ title, subtitle, open, onToggle, counts }: any) {
  const active = counts?.active ?? 0;
  const inactive = counts?.inactive ?? 0;

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
          ? "0 18px 46px rgba(0,0,0,0.28)"
          : "0 12px 30px rgba(0,0,0,0.18)";
      }}
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 880, letterSpacing: "-0.01em" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.62 }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DotCount
            color="rgba(52,199,89,0.90)"
            count={active}
            title={`Active: ${active}`}
          />
          <DotCount
            color="rgba(142,142,147,0.85)"
            count={inactive}
            title={`Inactive: ${inactive}`}
          />
        </div>
        <Chevron open={open} />
      </div>
    </button>
  );
}

/** ---------- Main ---------- */

type TrainingsTabProps = {
  S: any;
  trainings: Training[];
  trainingsLoading: boolean;
  trainingsError: string;
  trainingGroups: TrainingGroup[];
  trainingGroupsLoading: boolean;
  trainingGroupsError: string;
  createTrainingGroup: (name: string) => Promise<number | null>;
  updateTrainingGroup: (
    id: number,
    patch: { name?: string; sort_order?: number | null }
  ) => Promise<void>;
  deleteTrainingGroup: (group: TrainingGroup) => Promise<void>;
  editingTrainingId: number | null;
  editTrainingName: string;
  setEditTrainingName: Dispatch<SetStateAction<string>>;
  editTrainingActive: YesNo;
  setEditTrainingActive: Dispatch<SetStateAction<YesNo>>;
  editTrainingSaving: boolean;
  editTrainingExpiryWeeks: string;
  setEditTrainingExpiryWeeks: Dispatch<SetStateAction<string>>;
  editTrainingGroupId: string;
  setEditTrainingGroupId: Dispatch<SetStateAction<string>>;
  addTrainingDefinition: () => void;
  deleteTrainingDefinition: (row: Training) => Promise<void>;
  startEditTraining: (row: Training) => void;
  cancelEditTraining: () => void;
  saveEditTraining: (row: Training) => Promise<void>;
  loadTrainings: (force?: boolean) => Promise<void>;
};

type GroupCounts = { active: number; inactive: number };

type GroupedBlock = {
  key: string;
  title: string;
  subtitle: string;
  sortOrder?: number | null;
  items: Training[];
  counts: GroupCounts;
};

type GroupView = "group" | "status";

type TrainingEditState = {
  editingTrainingId: number | null;
  editTrainingName: string;
  setEditTrainingName: Dispatch<SetStateAction<string>>;
  editTrainingActive: YesNo;
  setEditTrainingActive: Dispatch<SetStateAction<YesNo>>;
  editTrainingSaving: boolean;
  editTrainingExpiryWeeks: string;
  setEditTrainingExpiryWeeks: Dispatch<SetStateAction<string>>;
  editTrainingGroupId: string;
  setEditTrainingGroupId: Dispatch<SetStateAction<string>>;
};

type TrainingActions = {
  startEditTraining: (row: Training) => void;
  cancelEditTraining: () => void;
  saveEditTraining: (row: Training) => Promise<void>;
  deleteTrainingDefinition: (row: Training) => Promise<void>;
};

type GroupOption = { value: string; label: string };

function TrainingRowCard({
  S,
  t,
  groupName,
  groupOptions,
  edit,
  actions,
  isFirst,
  isLast,
  canPickGroup,
}: {
  S: any;
  t: Training;
  groupName: string;
  groupOptions: GroupOption[];
  edit: TrainingEditState;
  actions: TrainingActions;
  isFirst: boolean;
  isLast: boolean;
  canPickGroup: boolean;
}) {
  const isEditing = edit.editingTrainingId === t.id;

  const hoverOn = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 12px 26px rgba(0,0,0,0.22)";
    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
  };

  const hoverOff = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.background = "transparent";
  };

  const pressOn = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) {
      if (e.target.closest("button")) return;
      if (e.target.closest("input")) return;
      if (e.target.closest("select")) return;
      if (e.target.closest("label")) return;
    }
    e.currentTarget.style.transform = "translateY(0px) scale(0.995)";
  };

  const pressOff = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) {
      if (e.target.closest("button")) return;
      if (e.target.closest("input")) return;
      if (e.target.closest("select")) return;
      if (e.target.closest("label")) return;
    }
    e.currentTarget.style.transform = "translateY(-1px)";
  };

  const stop = (e: MouseEvent<HTMLElement>) => e.stopPropagation();

  const expiryMode =
    (edit.editTrainingExpiryWeeks || "").trim() === "" ? "NEVER" : "WEEKS";

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
        borderRadius: isFirst ? "14px 14px 0 0" : isLast ? "0 0 14px 14px" : 0,
        background: "transparent",
        transition:
          "transform 140ms ease, box-shadow 180ms ease, background 160ms ease",
        willChange: "transform",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
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
            {isEditing ? (
              <input
                value={edit.editTrainingName}
                onChange={(e) => edit.setEditTrainingName(e.target.value)}
                style={{ ...S.input, width: 320, maxWidth: "100%" }}
                placeholder="Training name"
              />
            ) : (
              t.name
            )}
          </div>

          {!isEditing && <StatusBadge S={S} active={t.active} />}

          {!isEditing && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
                opacity: 0.8,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span>Group: {groupName}</span>
              <span>• Expires: {formatExpiryLabel(t.expiresAfterWeeks)}</span>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <IdMeta id={t.localId ?? t.id} label="#" />
          <IdMeta id={t.id} label="PK" />
        </div>

        {isEditing && (
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
            onClick={stop}
            onMouseDown={stop}
          >
            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                value={edit.editTrainingActive}
                onChange={(e) =>
                  edit.setEditTrainingActive(
                    e.target.value === "TRUE" ? "TRUE" : "FALSE"
                  )
                }
                style={{ ...S.select, width: "100%", height: 38 }}
              >
                <option value="TRUE">Active</option>
                <option value="FALSE">Inactive</option>
              </select>
            </div>

            <div>
              <FieldLabel>Group</FieldLabel>
              <select
                value={edit.editTrainingGroupId}
                onChange={(e) => edit.setEditTrainingGroupId(e.target.value)}
                style={{ ...S.select, width: "100%", height: 38 }}
                disabled={!canPickGroup}
              >
                <option value="">Ungrouped</option>
                {groupOptions.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Expires</FieldLabel>
              <select
                value={expiryMode}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "NEVER") {
                    edit.setEditTrainingExpiryWeeks("");
                  } else {
                    const raw = (edit.editTrainingExpiryWeeks || "").trim();
                    if (raw === "" || raw === "0")
                      edit.setEditTrainingExpiryWeeks("1");
                  }
                }}
                style={{ ...S.select, width: "100%", height: 38 }}
              >
                <option value="NEVER">Never</option>
                <option value="WEEKS">Weeks</option>
              </select>
            </div>

            <div>
              <FieldLabel>Weeks</FieldLabel>
              <input
                value={edit.editTrainingExpiryWeeks}
                onFocus={() => {
                  const raw = (edit.editTrainingExpiryWeeks || "").trim();
                  if (raw === "") edit.setEditTrainingExpiryWeeks("1");
                }}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\\d*$/.test(v)) edit.setEditTrainingExpiryWeeks(v);
                }}
                style={{
                  ...S.input,
                  height: 38,
                  opacity: expiryMode === "WEEKS" ? 1 : 0.5,
                }}
                placeholder={expiryMode === "WEEKS" ? "e.g. 12" : "N/A"}
                inputMode="numeric"
                title={
                  expiryMode === "WEEKS"
                    ? "Weeks until expiration"
                    : "Type to enable weeks"
                }
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          onClick={stop}
          onMouseDown={stop}
        >
          {isEditing ? (
            <>
              <button
                onClick={() => actions.saveEditTraining(t)}
                disabled={edit.editTrainingSaving}
                style={S.button("primary", edit.editTrainingSaving)}
              >
                {edit.editTrainingSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => actions.cancelEditTraining()}
                disabled={edit.editTrainingSaving}
                style={S.button("ghost", edit.editTrainingSaving)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => actions.startEditTraining(t)}
                style={S.button("subtle")}
              >
                Edit
              </button>
              <button
                onClick={() => actions.deleteTrainingDefinition(t)}
                style={S.button("danger")}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TrainingsTab({
  S,

  trainings,
  trainingsLoading,
  trainingsError,

  trainingGroups = [],
  trainingGroupsLoading,
  trainingGroupsError,
  createTrainingGroup,
  updateTrainingGroup,
  deleteTrainingGroup,

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
}: TrainingsTabProps) {
  const [q, setQ] = useState("");
  const [groupView, setGroupView] = useState<GroupView>("group");
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupOrder, setEditGroupOrder] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const handleGroupViewChange = (value: string) => {
    setGroupView(value === "status" ? "status" : "group");
  };

  const sortedGroups = useMemo(() => {
    const list = Array.isArray(trainingGroups) ? [...trainingGroups] : [];
    list.sort((a, b) => {
      const so = Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999);
      if (so !== 0) return so;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    return list;
  }, [trainingGroups]);

  const groupById = useMemo(() => {
    return new Map(sortedGroups.map((g) => [String(g.id), g]));
  }, [sortedGroups]);

  const groupOptions = useMemo<GroupOption[]>(() => {
    return sortedGroups.map((g) => ({
      value: String(g.id),
      label: g.name || `Group ${g.id}`,
    }));
  }, [sortedGroups]);

  const baseList = useMemo<Training[]>(() => {
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

  const grouped = useMemo<GroupedBlock[]>(() => {
    if (groupView === "group") {
      const map = new Map<string, GroupedBlock>();

      for (const t of baseList) {
        const key =
          t.trainingGroupId == null
            ? UNGROUPED_KEY
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
            subtitle: "",
            sortOrder: group?.sortOrder ?? 9999,
            items: [],
            counts: { active: 0, inactive: 0 },
          });
        }

        const g = map.get(key);
        if (!g) continue;
        g.items.push(t);
        if (t.active) g.counts.active += 1;
        else g.counts.inactive += 1;
      }

      const out = Array.from(map.values());

      out.sort((a, b) => {
        if (a.key === UNGROUPED_KEY && b.key !== UNGROUPED_KEY) return 1;
        if (b.key === UNGROUPED_KEY && a.key !== UNGROUPED_KEY) return -1;

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
        g.subtitle = `${g.items.length} trainings`;
      }

      return out;
    }

    const activeItems: Training[] = [];
    const inactiveItems: Training[] = [];

    for (const t of baseList) {
      if (t.active) activeItems.push(t);
      else inactiveItems.push(t);
    }

    const sortByNameThenId = (a: Training, b: Training) => {
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
        subtitle: `${activeItems.length} trainings`,
        items: activeItems,
        counts: { active: activeItems.length, inactive: 0 },
      },
      {
        key: "Inactive",
        title: "Inactive",
        subtitle: `${inactiveItems.length} trainings`,
        items: inactiveItems,
        counts: { active: 0, inactive: inactiveItems.length },
      },
    ];
  }, [baseList, groupView, groupById]);

  const groupKeys = useMemo(() => grouped.map((g) => g.key), [grouped]);
  const expand = useExpandableKeys(groupKeys, { defaultExpanded: true });

  const resetAll = useCallback(() => {
    setQ("");
    expand.resetToDefault();
  }, [expand]);

  const handleCreateGroup = useCallback(async () => {
    const name = (newGroupName || "").trim();
    if (!name) return;

    const existing = sortedGroups.find(
      (g) => String(g.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      if (editingTrainingId != null) {
        setEditTrainingGroupId(String(existing.id));
      }
      alert(
        `Group "${existing.name || name}" already exists.` +
          (editingTrainingId != null ? " Selected it." : "")
      );
      return;
    }

    setAddingGroup(true);
    try {
      const id = await createTrainingGroup(name);
      setNewGroupName("");
      if (id != null && editingTrainingId != null) {
        setEditTrainingGroupId(String(id));
      }
    } catch (e) {
      alert("Failed to create group:\n" + getErrorMessage(e));
    } finally {
      setAddingGroup(false);
    }
  }, [
    newGroupName,
    sortedGroups,
    createTrainingGroup,
    editingTrainingId,
    setEditTrainingGroupId,
  ]);

  const startEditGroup = useCallback((g: TrainingGroup) => {
    setEditingGroupId(g.id);
    setEditGroupName(g.name || "");
    setEditGroupOrder(
      g.sortOrder == null || Number.isNaN(Number(g.sortOrder))
        ? ""
        : String(g.sortOrder)
    );
  }, []);

  const cancelEditGroup = useCallback(() => {
    setEditingGroupId(null);
    setEditGroupName("");
    setEditGroupOrder("");
  }, []);

  const openGroupsModal = useCallback(() => {
    setGroupsOpen(true);
  }, []);

  const closeGroupsModal = useCallback(() => {
    setGroupsOpen(false);
    setNewGroupName("");
    cancelEditGroup();
  }, [cancelEditGroup]);

  const saveGroup = useCallback(
    async (g: TrainingGroup) => {
      const name = (editGroupName || "").trim();
      if (!name) {
        alert("Group name cannot be blank.");
        return;
      }

      const nameTaken = sortedGroups.find(
        (x) =>
          x.id !== g.id &&
          String(x.name || "").trim().toLowerCase() === name.toLowerCase()
      );
      if (nameTaken) {
        alert(`Another group named "${name}" already exists.`);
        return;
      }

      const orderRaw = (editGroupOrder || "").trim();
      let sort_order: number | null = null;
      if (orderRaw !== "") {
        const num = Number(orderRaw);
        if (!Number.isFinite(num)) {
          alert("Sort order must be a number.");
          return;
        }
        sort_order = Math.floor(num);
      }

      setSavingGroup(true);
      try {
        await updateTrainingGroup(g.id, { name, sort_order });
        cancelEditGroup();
      } catch (e) {
        alert("Failed to update group:\n" + getErrorMessage(e));
      } finally {
        setSavingGroup(false);
      }
    },
    [
      editGroupName,
      editGroupOrder,
      sortedGroups,
      updateTrainingGroup,
      cancelEditGroup,
    ]
  );

  const moveGroup = useCallback(
    async (g: TrainingGroup, direction: "up" | "down") => {
      const idx = sortedGroups.findIndex((x) => x.id === g.id);
      if (idx < 0) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sortedGroups.length) return;

      const neighbor = sortedGroups[swapIdx];
      const currentOrder =
        g.sortOrder == null || Number.isNaN(Number(g.sortOrder))
          ? (idx + 1) * 10
          : Number(g.sortOrder);
      const neighborOrder =
        neighbor.sortOrder == null || Number.isNaN(Number(neighbor.sortOrder))
          ? (swapIdx + 1) * 10
          : Number(neighbor.sortOrder);

      const targetOrder =
        direction === "up" ? neighborOrder - 1 : neighborOrder + 1;

      setSavingGroup(true);
      try {
        await updateTrainingGroup(g.id, { sort_order: targetOrder });
      } catch (e) {
        alert("Failed to reorder group:\n" + getErrorMessage(e));
      } finally {
        setSavingGroup(false);
      }
    },
    [sortedGroups, updateTrainingGroup]
  );

  const edit: TrainingEditState = {
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
  };

  const actions: TrainingActions = {
    startEditTraining,
    cancelEditTraining,
    saveEditTraining,
    deleteTrainingDefinition,
  };

  const totalCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const t of baseList) {
      if (t.active) active += 1;
      else inactive += 1;
    }
    return { active, inactive };
  }, [baseList]);

  const stickyShell: CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 3,
    padding: "12px 0 12px",
    marginBottom: 14,
    backdropFilter: "blur(14px)",
    background:
      "linear-gradient(180deg, rgba(16,18,26,0.92) 0%, rgba(16,18,26,0.72) 65%, rgba(16,18,26,0.00) 100%)",
  };

  const commandBar: CSSProperties = {
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

  const canRender = !trainingsLoading && !trainingsError;

  return (
    <>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={S.cardTitle}>Trainings</h2>
            <div style={S.helper}>Add or edit training definitions.</div>
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

          <button style={S.button("ghost")} onClick={resetAll}>
            Reset
          </button>
        </div>
      </div>

      <div style={S.cardBody}>
        <div style={stickyShell}>
          <div style={commandBar}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search trainings"
              style={{ ...S.input, width: 320, flex: "1 1 240px" }}
            />

            <Segmented
              value={groupView}
              onChange={handleGroupViewChange}
              options={[
                { value: "group", label: "By Group" },
                { value: "status", label: "By Status" },
              ]}
            />

            <button style={S.button("subtle")} onClick={openGroupsModal}>
              Manage Groups
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.button("subtle")} onClick={expand.expandAll}>
                Expand
              </button>
              <button style={S.button("subtle")} onClick={expand.collapseAll}>
                Collapse
              </button>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <DotCount
                color="rgba(52,199,89,0.90)"
                count={totalCounts.active}
                title={`Active: ${totalCounts.active}`}
              />
              <DotCount
                color="rgba(142,142,147,0.85)"
                count={totalCounts.inactive}
                title={`Inactive: ${totalCounts.inactive}`}
              />
            </div>
          </div>
        </div>

        {trainingGroupsLoading && (
          <p style={S.loading}>Loading training groups...</p>
        )}
        {trainingGroupsError && <p style={S.error}>{trainingGroupsError}</p>}

        {trainingsLoading && <p style={S.loading}>Loading trainings...</p>}
        {trainingsError && <p style={S.error}>{trainingsError}</p>}

        {canRender && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {grouped.map((g) => {
              const open = expand.expanded.has(g.key);

              return (
                <div
                  key={g.key}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <GroupHeaderIOS
                    title={g.title}
                    subtitle={g.subtitle}
                    open={open}
                    onToggle={() => expand.toggle(g.key)}
                    counts={g.counts}
                  />

                  {open && (
                    <div
                      style={{
                        marginLeft: 18,
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
                        {g.items.map((t, idx) => {
                          const groupName =
                            t.trainingGroupId == null
                              ? "Ungrouped"
                              : String(
                                  groupById.get(String(t.trainingGroupId))
                                    ?.name || "Ungrouped"
                                );
                          return (
                            <TrainingRowCard
                              key={t.id}
                              S={S}
                              t={t}
                              groupName={groupName}
                              groupOptions={groupOptions}
                              edit={edit}
                              actions={actions}
                              isFirst={idx === 0}
                              isLast={idx === g.items.length - 1}
                              canPickGroup={!trainingGroupsLoading}
                            />
                          );
                        })}
                      </div>
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

      {groupsOpen && (
        <div style={S.modalOverlay} onMouseDown={closeGroupsModal}>
          <div style={S.modalCard} onMouseDown={(e: MouseEvent) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h3 style={S.modalTitle}>Manage Training Groups</h3>
              <button
                style={S.button("ghost", savingGroup || addingGroup)}
                onClick={closeGroupsModal}
                disabled={savingGroup || addingGroup}
              >
                Close
              </button>
            </div>

            <div style={S.modalBody}>
              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <FieldLabel>New Group</FieldLabel>
                    <input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Group name"
                      style={S.input}
                      disabled={addingGroup || savingGroup}
                    />
                  </div>
                  <button
                    style={S.button("subtle", addingGroup || savingGroup)}
                    onClick={handleCreateGroup}
                    disabled={addingGroup || savingGroup}
                    title="Create a new training group"
                  >
                    {addingGroup ? "Adding..." : "Add Group"}
                  </button>
                </div>

                {trainingGroupsLoading && (
                  <p style={S.loading}>Loading training groups...</p>
                )}
                {trainingGroupsError && (
                  <p style={S.error}>{trainingGroupsError}</p>
                )}

                {sortedGroups.length === 0 && !trainingGroupsLoading && (
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    No training groups yet.
                  </div>
                )}

                {sortedGroups.map((g, idx) => {
                  const isEditingGroup = editingGroupId === g.id;
                  const orderLabel =
                    g.sortOrder == null || Number.isNaN(Number(g.sortOrder))
                      ? "Auto"
                      : String(g.sortOrder);
                  const disableActions =
                    savingGroup || addingGroup || trainingGroupsLoading;

                  return (
                    <div
                      key={g.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 12,
                        padding: "10px 0",
                        borderTop:
                          idx === 0
                            ? "none"
                            : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        {isEditingGroup ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 140px",
                              gap: 10,
                              alignItems: "end",
                            }}
                          >
                            <div>
                              <FieldLabel>Name</FieldLabel>
                              <input
                                value={editGroupName}
                                onChange={(e) => setEditGroupName(e.target.value)}
                                style={{ ...S.input, width: "100%" }}
                                placeholder="Group name"
                                disabled={disableActions}
                              />
                            </div>
                            <div>
                              <FieldLabel>Order</FieldLabel>
                              <input
                                value={editGroupOrder}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (/^-?\\d*$/.test(v)) setEditGroupOrder(v);
                                }}
                                style={{ ...S.input, width: "100%" }}
                                placeholder="Auto"
                                inputMode="numeric"
                                disabled={disableActions}
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13.5,
                                fontWeight: 850,
                                letterSpacing: "-0.01em",
                              }}
                            >
                              {g.name || `Group ${g.id}`}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                flexWrap: "wrap",
                                fontSize: 12,
                                fontWeight: 700,
                                opacity: 0.75,
                              }}
                            >
                              <IdMeta id={g.id} label="ID" />
                              <span>Order: {orderLabel}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                  {isEditingGroup ? (
                    <>
                      <button
                        onClick={() => saveGroup(g)}
                        disabled={disableActions}
                        style={S.button("primary", disableActions)}
                      >
                        {savingGroup ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => deleteTrainingGroup(g)}
                        disabled={disableActions}
                        style={S.button("danger", disableActions)}
                        title="Delete group (trainings will be ungrouped)"
                      >
                        Delete
                      </button>
                      <button
                        onClick={cancelEditGroup}
                        disabled={disableActions}
                        style={S.button("ghost", disableActions)}
                      >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditGroup(g)}
                              disabled={disableActions}
                              style={S.button("subtle", disableActions)}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => moveGroup(g, "up")}
                              disabled={disableActions || idx === 0}
                              style={S.button("subtle", disableActions || idx === 0)}
                              title="Move up"
                            >
                              Up
                            </button>
                            <button
                              onClick={() => moveGroup(g, "down")}
                              disabled={
                                disableActions || idx === sortedGroups.length - 1
                              }
                              style={S.button(
                                "subtle",
                                disableActions || idx === sortedGroups.length - 1
                              )}
                              title="Move down"
                            >
                              Down
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
