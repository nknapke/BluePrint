// CrewTab.js
import { useMemo, useState, useCallback, useEffect } from "react";
import { StatusBadge } from "../components/ui/Badges";
import { Chevron } from "../components/ui/Chevron";
import { DotCount } from "../components/ui/DotCount";
import { Chip } from "../components/ui/Chip";
import { useExpandableKeys } from "../hooks/useExpandableKeys";
import { prettyTitle } from "../utils/strings";

function GroupHeaderIOS({ title, subtitle, open, onToggle, counts }) {
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DotCount
            color="rgba(52,199,89,0.90)"
            count={active}
            title={`Active: ${active}`}
          />
          <DotCount
            color="rgba(142,142,147,0.85)"
            count={inactive}
            title={`Not Active: ${inactive}`}
          />
        </div>
        <Chevron open={open} />
      </div>
    </button>
  );
}

function CrewRowCard({ S, c, edit, actions, isFirst, isLast }) {
  const isEditing = edit.editingCrewId === c.id;

  const hoverOn = (e) => {
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 12px 26px rgba(0,0,0,0.22)";
    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
  };

  const hoverOff = (e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.background = "transparent";
  };

  const pressOn = (e) => {
    if (e.target.closest("button")) return;
    if (e.target.closest("input")) return;
    if (e.target.closest("select")) return;
    e.currentTarget.style.transform = "translateY(0px) scale(0.995)";
  };

  const pressOff = (e) => {
    if (e.target.closest("button")) return;
    if (e.target.closest("input")) return;
    if (e.target.closest("select")) return;
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
        gap: 10,
        padding: "10px 12px",
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
                value={edit.editCrewName}
                onChange={(e) => edit.setEditCrewName(e.target.value)}
                style={{ ...S.input, width: 260, maxWidth: "100%" }}
                placeholder="Name"
              />
            ) : (
              c.name
            )}
          </div>

          {!isEditing && <StatusBadge S={S} active={c.active} />}
        </div>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: 12,
            fontWeight: 750,
            opacity: 0.88,
          }}
        >
          {isEditing ? (
            <>
              <input
                value={edit.editCrewDept}
                onChange={(e) => edit.setEditCrewDept(e.target.value)}
                style={{ ...S.input, width: 260, maxWidth: "100%" }}
                placeholder="Department"
              />

              <select
                value={edit.editCrewStatus}
                onChange={(e) => edit.setEditCrewStatus(e.target.value)}
                style={{ ...S.select, width: 160 }}
              >
                <option value="Active">Active</option>
                <option value="Not Active">Not Active</option>
              </select>
            </>
          ) : (
            <>
              <span style={{ opacity: 0.95 }}>
                {prettyTitle(c.dept || "—")}
              </span>
              <span style={{ opacity: 0.55 }}>·</span>
              <span style={{ opacity: 0.82 }}>
                {c.active ? "Active" : "Not Active"}
              </span>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isEditing ? (
            <>
              <button
                onClick={() => actions.saveEditCrew(c)}
                disabled={edit.editCrewSaving}
                style={S.button("primary", edit.editCrewSaving)}
              >
                {edit.editCrewSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={actions.cancelEditCrew}
                disabled={edit.editCrewSaving}
                style={S.button("ghost", edit.editCrewSaving)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => actions.startEditCrew(c)}
                style={S.button("subtle")}
              >
                Edit
              </button>
              <button
                onClick={() => actions.deleteCrewMember(c)}
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

/** ---------- Main ---------- */

export default function CrewTab({
  S,

  // data
  crew,
  visibleCrew,
  crewDepartments,

  // loading + errors
  crewLoading,
  crewError,

  // filters (App.js state)
  crewNameFilter,
  setCrewNameFilter,
  crewDeptFilter,
  setCrewDeptFilter,
  crewStatusFilter,
  setCrewStatusFilter,

  // edit state (App.js state)
  editingCrewId,
  editCrewName,
  setEditCrewName,
  editCrewDept,
  setEditCrewDept,
  editCrewStatus,
  setEditCrewStatus,
  editCrewSaving,

  // actions
  openAddCrew,
  loadCrew,
  startEditCrew,
  cancelEditCrew,
  saveEditCrew,
  deleteCrewMember,
}) {
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const baseList = useMemo(() => {
    const list = Array.isArray(visibleCrew) ? visibleCrew : [];
    const query = (q || "").trim().toLowerCase();
    if (!query) return list;

    return list.filter((c) => {
      const hay = `${c.name || ""} ${c.dept || ""} ${
        c.active ? "active" : "not active"
      }`.toLowerCase();
      return hay.includes(query);
    });
  }, [visibleCrew, q]);

  const groupedByDept = useMemo(() => {
    const map = new Map();

    for (const c of baseList) {
      const raw = (c.dept || "").trim();
      const dept = raw ? prettyTitle(raw) : "No Department";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(c);
    }

    const groups = Array.from(map.entries()).map(([dept, items]) => {
      const active = items.reduce((n, x) => n + (x.active ? 1 : 0), 0);
      const inactive = items.length - active;

      const sorted = [...items].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );

      return {
        key: dept,
        title: dept,
        items: sorted,
        counts: { active, inactive },
      };
    });

    groups.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    return groups;
  }, [baseList]);

  const deptKeys = useMemo(
    () => groupedByDept.map((g) => g.key),
    [groupedByDept]
  );
  const deptExpand = useExpandableKeys(deptKeys, { defaultExpanded: true });

  const toggleDept = useCallback((key) => deptExpand.toggle(key), [deptExpand]);

  const activeChips = useMemo(() => {
    const chips = [];

    if (crewNameFilter !== "ALL") {
      const found = crew.find((x) => String(x.id) === String(crewNameFilter));
      chips.push({
        key: "crew",
        text: `Name: ${found?.name || crewNameFilter}`,
        clear: () => setCrewNameFilter("ALL"),
      });
    }

    if (crewDeptFilter !== "ALL") {
      chips.push({
        key: "dept",
        text: `Dept: ${prettyTitle(crewDeptFilter)}`,
        clear: () => setCrewDeptFilter("ALL"),
      });
    }

    if ((q || "").trim()) {
      chips.push({
        key: "q",
        text: `Search: ${(q || "").trim()}`,
        clear: () => setQ(""),
      });
    }

    if (crewStatusFilter !== "Active") {
      chips.push({
        key: "status",
        text: `Status: ${crewStatusFilter}`,
        clear: () => setCrewStatusFilter("Active"),
      });
    }

    return chips;
  }, [
    crew,
    crewNameFilter,
    crewDeptFilter,
    q,
    crewStatusFilter,
    setCrewNameFilter,
    setCrewDeptFilter,
    setCrewStatusFilter,
  ]);

  const resetAll = useCallback(() => {
    setCrewNameFilter("ALL");
    setCrewDeptFilter("ALL");
    setCrewStatusFilter("Active");
    setQ("");
    setFiltersOpen(false);
    deptExpand.resetToDefault();
  }, [setCrewNameFilter, setCrewDeptFilter, setCrewStatusFilter, deptExpand]);

  const stickyShell = {
    position: "sticky",
    top: 0,
    zIndex: 3,
    padding: "10px 0 10px",
    marginBottom: 12,
    backdropFilter: "blur(14px)",
    background:
      "linear-gradient(180deg, rgba(16,18,26,0.92) 0%, rgba(16,18,26,0.72) 65%, rgba(16,18,26,0.00) 100%)",
  };

  const commandBar = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.22)",
    boxShadow: "0 16px 44px rgba(0,0,0,0.18)",
  };

  const commandGroup = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  };

  const filterPanel = {
    overflow: "hidden",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.20) 100%)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.16)",
    maxHeight: filtersOpen ? 320 : 0,
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

  const edit = {
    editingCrewId,
    editCrewName,
    setEditCrewName,
    editCrewDept,
    setEditCrewDept,
    editCrewStatus,
    setEditCrewStatus,
    editCrewSaving,
  };

  const actions = {
    startEditCrew,
    cancelEditCrew,
    saveEditCrew,
    deleteCrewMember,
  };

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={S.cardTitle}>Crew Roster</h2>
          <div style={S.helper}>Add or remove crew members.</div>
        </div>

        <div style={S.row}>
          <button style={S.button("primary")} onClick={openAddCrew}>
            Add Crew Member
          </button>

          <button
            style={S.button("subtle")}
            onClick={() => loadCrew(true)}
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
            <div style={commandGroup}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, department"
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
            </div>

            <div style={commandGroup}>
              <button style={S.button("subtle")} onClick={deptExpand.expandAll}>
                Expand
              </button>
              <button
                style={S.button("subtle")}
                onClick={deptExpand.collapseAll}
              >
                Collapse
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, ...filterPanel }}>
            <div style={panelInner}>
              <div style={panelRow}>
                <div style={panelCell(4)}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Name</div>
                  <select
                    value={crewNameFilter}
                    onChange={(e) => setCrewNameFilter(e.target.value)}
                    style={{ ...S.select, width: "100%" }}
                  >
                    <option value="ALL">All names</option>
                    {crew.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={panelCell(4)}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Department</div>
                  <select
                    value={crewDeptFilter}
                    onChange={(e) => setCrewDeptFilter(e.target.value)}
                    style={{ ...S.select, width: "100%" }}
                  >
                    <option value="ALL">All departments</option>
                    {crewDepartments.map((d) => (
                      <option key={d} value={d}>
                        {prettyTitle(d)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={panelCell(4)}>
                  <div style={{ ...S.helper, marginBottom: 6 }}>Status</div>
                  <select
                    value={crewStatusFilter}
                    onChange={(e) => setCrewStatusFilter(e.target.value)}
                    style={{ ...S.select, width: "100%" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Not Active">Not Active</option>
                    <option value="ALL">All statuses</option>
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

        {crewLoading && <p style={S.loading}>Loading crew...</p>}
        {crewError && <p style={S.error}>{crewError}</p>}

        {!crewLoading && !crewError && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groupedByDept.map((g) => {
              const open = deptExpand.expanded.has(g.key);

              return (
                <div
                  key={g.key}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <GroupHeaderIOS
                    title={g.title}
                    subtitle={`${g.items.length} people`}
                    open={open}
                    onToggle={() => toggleDept(g.key)}
                    counts={g.counts}
                  />

                  {open && (
                    <div
                      style={{
                        marginLeft: 14,
                        padding: 8,
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(0,0,0,0.14)",
                        boxShadow: "0 14px 36px rgba(0,0,0,0.18)",
                      }}
                    >
                      <div
                        style={{
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(0,0,0,0.18)",
                        }}
                      >
                        {g.items.map((c, idx) => (
                          <CrewRowCard
                            key={c.id}
                            S={S}
                            c={c}
                            edit={edit}
                            actions={actions}
                            isFirst={idx === 0}
                            isLast={idx === g.items.length - 1}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {baseList.length === 0 && (
              <div style={{ padding: 18, opacity: 0.75 }}>
                No crew match your filters.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
