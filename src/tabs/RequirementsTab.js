// RequirementsTab.js
import { useMemo, useState, useCallback } from "react";
import { Chevron } from "../components/ui/Chevron";
import { DotCount } from "../components/ui/DotCount";
import { FieldLabel } from "../components/ui/FieldLabel";
import { Segmented } from "../components/ui/Segmented";
import { buildTrackColorMap, hexToRgba } from "../utils/colors";

function GroupHeaderIOS({
  title,
  subtitle,
  open,
  onToggle,
  counts,
  accentHex,
}) {
  const active = counts?.active ?? 0;
  const inactive = counts?.inactive ?? 0;

  const accent = hexToRgba(accentHex, 0.65);

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
      {accent && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: `linear-gradient(180deg, ${accent} 0%, rgba(255,255,255,0.06) 100%)`,
            opacity: 0.95,
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
          paddingLeft: accent ? 6 : 0,
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
            title={`Inactive: ${inactive}`}
          />
        </div>
        <Chevron open={open} />
      </div>
    </button>
  );
}

/** ---------- Row card (mini edit state + optional color accent + hover glow) ---------- */

function RequirementRowCard({
  S,
  r,
  leftLabel,
  accentHex,

  editingReqId,
  editReqStatus,
  setEditReqStatus,

  startEditReq,
  cancelEditReq,
  saveEditReq,

  onDelete,
  isFirst,
  isLast,
}) {
  const isEditing = String(editingReqId) === String(r.id);
  const accent = hexToRgba(accentHex, 0.78);
  const [hovered, setHovered] = useState(false);

  const hoverOn = (e) => {
    setHovered(true);
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 12px 26px rgba(0,0,0,0.22)";
    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
  };

  const hoverOff = (e) => {
    setHovered(false);
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.background = "transparent";
  };

  const isInteractiveTarget = (e) =>
    e.target.closest("button") ||
    e.target.closest("input") ||
    e.target.closest("select") ||
    e.target.closest("textarea") ||
    e.target.closest("label");

  const pressOn = (e) => {
    if (isInteractiveTarget(e)) return;
    e.currentTarget.style.transform = "translateY(0px) scale(0.995)";
  };

  const pressOff = (e) => {
    if (isInteractiveTarget(e)) return;
    e.currentTarget.style.transform = "translateY(-1px)";
  };

  return (
    <div
      onMouseEnter={hoverOn}
      onMouseLeave={hoverOff}
      onMouseDown={pressOn}
      onMouseUp={pressOff}
      style={{
        position: "relative",
        overflow: "hidden",
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
      {accent && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: hovered ? 4 : 3,
            background: `linear-gradient(180deg, ${accent} 0%, rgba(255,255,255,0.06) 100%)`,
            opacity: 0.95,
            boxShadow: hovered ? `0 0 14px ${accent}` : "none",
            transition: "box-shadow 160ms ease, width 160ms ease",
          }}
        />
      )}

      <div style={{ minWidth: 0, paddingLeft: accent ? 8 : 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 850,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={leftLabel}
        >
          {leftLabel}
        </div>

        <div style={{ marginTop: 10 }}>
          {isEditing ? (
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "end",
              }}
            >
              <div style={{ display: "grid", alignContent: "end" }}>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={editReqStatus}
                  onChange={(e) => setEditReqStatus(e.target.value)}
                  style={{ ...S.select, width: 170, height: 38 }}
                >
                  <option value="TRUE">Active</option>
                  <option value="FALSE">Inactive</option>
                </select>
              </div>

              <div style={{ ...S.mini, opacity: 0.72 }}>
                Current: {r.active ? "Active" : "Inactive"}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.78 }}>
                {r.active ? "Active" : "Inactive"}
              </span>
            </div>
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
                style={S.button("primary")}
                onClick={() => saveEditReq(r)}
              >
                Save
              </button>
              <button style={S.button("ghost")} onClick={cancelEditReq}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                style={S.button("subtle")}
                onClick={() => startEditReq(r)}
              >
                Edit
              </button>
              <button style={S.button("danger")} onClick={() => onDelete(r)}>
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

export default function RequirementsTab({
  S,

  tracks,
  trainings,
  requirements,
  trainingsLoading,
  trainingsError,
  requirementsLoading,
  requirementsError,

  reqNewTrackId,
  setReqNewTrackId,
  reqNewTrainingId,
  setReqNewTrainingId,
  reqNewActive,
  setReqNewActive,
  reqAdding,
  addTrainingRequirement,

  requirementsViewMode,
  setRequirementsViewMode,
  requirementsGroupedByTraining,
  requirementsGroupedByTrack,

  isTrainingExpanded,
  toggleTrainingExpanded,
  expandAllTrainings,
  collapseAllTrainings,

  isReqTrackExpanded,
  toggleReqTrackExpanded,
  expandAllReqTracks,
  collapseAllReqTracks,

  loadTracks,
  loadTrainings,
  loadRequirements,
  toggleRequirementRow,
  deleteRequirement,
}) {
  const [q, setQ] = useState("");

  // Mini edit state
  const [editingReqId, setEditingReqId] = useState(null);
  const [editReqStatus, setEditReqStatus] = useState("TRUE"); // "TRUE" | "FALSE"

  const startEditReq = useCallback((r) => {
    setEditingReqId(r.id);
    setEditReqStatus(r.active ? "TRUE" : "FALSE");
  }, []);

  const cancelEditReq = useCallback(() => {
    setEditingReqId(null);
    setEditReqStatus("TRUE");
  }, []);

  const saveEditReq = useCallback(
    async (r) => {
      const wantActive = String(editReqStatus) === "TRUE";
      const isActiveNow = !!r.active;

      // Existing behavior: only toggle available
      if (wantActive !== isActiveNow) {
        await toggleRequirementRow(r);
      }

      setEditingReqId(null);
      setEditReqStatus("TRUE");
    },
    [editReqStatus, toggleRequirementRow]
  );

  const canRender =
    !trainingsLoading &&
    !requirementsLoading &&
    !trainingsError &&
    !requirementsError;

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

  const trackColorById = useMemo(() => buildTrackColorMap(tracks), [tracks]);

  const filteredGroups = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    const base =
      requirementsViewMode === "training"
        ? requirementsGroupedByTraining
        : requirementsGroupedByTrack;

    if (!query) return base;

    if (requirementsViewMode === "training") {
      return (requirementsGroupedByTraining || [])
        .map((g) => {
          const headerHay = `${g.trainingName || ""}`.toLowerCase();
          const items = (g.items || []).filter((r) => {
            const hay = `${r.trackName || ""} ${
              r.trainingName || ""
            }`.toLowerCase();
            return hay.includes(query) || headerHay.includes(query);
          });
          return { ...g, items };
        })
        .filter((g) => (g.items || []).length > 0);
    }

    return (requirementsGroupedByTrack || [])
      .map((g) => {
        const headerHay = `${g.trackName || ""}`.toLowerCase();
        const items = (g.items || []).filter((r) => {
          const hay = `${r.trackName || ""} ${
            r.trainingName || ""
          }`.toLowerCase();
          return hay.includes(query) || headerHay.includes(query);
        });
        return { ...g, items };
      })
      .filter((g) => (g.items || []).length > 0);
  }, [
    q,
    requirementsViewMode,
    requirementsGroupedByTraining,
    requirementsGroupedByTrack,
  ]);

  const totals = useMemo(() => {
    const list = Array.isArray(requirements) ? requirements : [];
    let active = 0;
    for (const r of list) if (r?.active) active += 1;
    return { active, inactive: list.length - active, total: list.length };
  }, [requirements]);

  const expandAll = useCallback(() => {
    if (requirementsViewMode === "training") expandAllTrainings();
    else expandAllReqTracks();
  }, [requirementsViewMode, expandAllTrainings, expandAllReqTracks]);

  const collapseAll = useCallback(() => {
    if (requirementsViewMode === "training") collapseAllTrainings();
    else collapseAllReqTracks();
  }, [requirementsViewMode, collapseAllTrainings, collapseAllReqTracks]);

  const onRefresh = useCallback(async () => {
    await loadTracks(true);
    await loadTrainings(true);
    await loadRequirements(true);
  }, [loadTracks, loadTrainings, loadRequirements]);

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={S.cardTitle}>Training Requirements</h2>
          <div style={S.helper}>
            Define which trainings are required for each track.
          </div>
        </div>

        <div style={S.row}>
          <button
            style={S.button("subtle")}
            onClick={onRefresh}
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={S.cardBody}>
        {/* Add Requirement UI */}
        <div
          style={{
            padding: 12,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.18)",
            boxShadow: "0 14px 40px rgba(0,0,0,0.16)",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: "-0.01em",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                Add requirement
              </div>
              <div style={{ ...S.mini, opacity: 0.75 }}>
                Pick a track, pick a training, set active, add.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <select
                value={reqNewTrackId}
                onChange={(e) => setReqNewTrackId(e.target.value)}
                style={{ ...S.select, width: 240 }}
              >
                <option value="ALL">Pick a track</option>
                {tracks.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>

              <select
                value={reqNewTrainingId}
                onChange={(e) => setReqNewTrainingId(e.target.value)}
                style={{ ...S.select, width: 300 }}
              >
                <option value="ALL">Pick a training</option>
                {trainings.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>

              <select
                value={reqNewActive}
                onChange={(e) => setReqNewActive(e.target.value)}
                style={{ ...S.select, width: 160 }}
                title="Active state for the new requirement"
              >
                <option value="TRUE">Active</option>
                <option value="FALSE">Inactive</option>
              </select>

              <button
                style={S.button("primary", reqAdding)}
                disabled={reqAdding}
                onClick={addTrainingRequirement}
              >
                {reqAdding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>

        {/* Sticky command bar */}
        <div style={stickyShell}>
          <div style={commandBar}>
            <Segmented
              value={requirementsViewMode}
              onChange={(v) => {
                setRequirementsViewMode(v);
                cancelEditReq();
              }}
              options={[
                { value: "training", label: "By Training" },
                { value: "track", label: "By Track" },
              ]}
            />

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search training, track"
              style={{ ...S.input, width: 320, flex: "1 1 240px" }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.button("subtle")} onClick={expandAll}>
                Expand
              </button>
              <button style={S.button("subtle")} onClick={collapseAll}>
                Collapse
              </button>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <DotCount
                color="rgba(52,199,89,0.90)"
                count={totals.active}
                title={`Active: ${totals.active}`}
              />
              <DotCount
                color="rgba(142,142,147,0.85)"
                count={totals.inactive}
                title={`Inactive: ${totals.inactive}`}
              />
            </div>
          </div>
        </div>

        {trainingsLoading && <p style={S.loading}>Loading trainings...</p>}
        {trainingsError && <p style={S.error}>{trainingsError}</p>}
        {requirementsLoading && (
          <p style={S.loading}>Loading requirements...</p>
        )}
        {requirementsError && <p style={S.error}>{requirementsError}</p>}

        {canRender && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filteredGroups.length === 0 ? (
              <div style={{ padding: 18, opacity: 0.75 }}>
                No requirements found.
              </div>
            ) : (
              filteredGroups.map((g) => {
                const open =
                  requirementsViewMode === "training"
                    ? isTrainingExpanded(g.trainingId)
                    : isReqTrackExpanded(g.trackId);

                const items = g.items || [];
                const active = items.reduce(
                  (n, r) => n + (r.active ? 1 : 0),
                  0
                );
                const inactive = items.length - active;

                const title =
                  requirementsViewMode === "training"
                    ? g.trainingName
                    : g.trackName;

                const subtitle =
                  requirementsViewMode === "training"
                    ? `${items.length} track${items.length === 1 ? "" : "s"}`
                    : `${items.length} training${
                        items.length === 1 ? "" : "s"
                      }`;

                // Header strip only for By Track
                const headerAccentHex =
                  requirementsViewMode === "track"
                    ? trackColorById.get(String(g.trackId)) || ""
                    : "";

                const groupKey =
                  requirementsViewMode === "training"
                    ? `tr_${g.trainingId}`
                    : `tk_${g.trackId}`;

                return (
                  <div
                    key={groupKey}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <GroupHeaderIOS
                      title={title}
                      subtitle={subtitle}
                      open={open}
                      counts={{ active, inactive }}
                      accentHex={headerAccentHex}
                      onToggle={() => {
                        cancelEditReq();
                        if (requirementsViewMode === "training")
                          toggleTrainingExpanded(g.trainingId);
                        else toggleReqTrackExpanded(g.trackId);
                      }}
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
                          {items.map((r, idx) => {
                            const leftLabel =
                              requirementsViewMode === "training"
                                ? r.trackName
                                : r.trainingName;

                            // ✅ FIX:
                            // - By Training: row uses its trackId color
                            // - By Track: rows are neutral (no color)
                            const rowAccentHex =
                              requirementsViewMode === "training"
                                ? trackColorById.get(String(r.trackId)) || ""
                                : "";

                            return (
                              <RequirementRowCard
                                key={r.id}
                                S={S}
                                r={r}
                                leftLabel={leftLabel}
                                accentHex={rowAccentHex}
                                isFirst={idx === 0}
                                isLast={idx === items.length - 1}
                                editingReqId={editingReqId}
                                editReqStatus={editReqStatus}
                                setEditReqStatus={setEditReqStatus}
                                startEditReq={startEditReq}
                                cancelEditReq={cancelEditReq}
                                saveEditReq={saveEditReq}
                                onDelete={deleteRequirement}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
