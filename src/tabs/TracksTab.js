// TracksTab.js
import { useMemo, useState, useCallback, useEffect, useRef } from "react";

/** ---------- Small hook: "default expand all" + keep keys in sync ---------- */
function useExpandableKeys(keys, { defaultExpanded = true } = {}) {
  const [expanded, setExpanded] = useState(() =>
    defaultExpanded ? new Set(keys) : new Set()
  );
  const [userTouched, setUserTouched] = useState(false);

  useEffect(() => {
    setExpanded((prev) => {
      // Before user touches anything: expand everything + keep in sync.
      if (!userTouched) return new Set(keys);

      // After user touches: keep their choices, but add new keys and remove missing ones.
      const next = new Set(prev);
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
  }, [keys, userTouched]);

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

/** ---------- helpers ---------- */

function hexToRgba(hex, a = 0.6) {
  const h = String(hex || "").trim();
  const m = h.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/** ---------- UI bits (same vibe) ---------- */

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

function IdMeta({ id, label = "#" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 9px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        fontSize: 12,
        fontWeight: 800,
        color: "rgba(255,255,255,0.72)",
        whiteSpace: "nowrap",
      }}
      title={label === "#" ? "Track #" : "Database Primary Key"}
    >
      {label} {id}
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
            title={`Inactive: ${inactive}`}
          />
        </div>
        <Chevron open={open} />
      </div>
    </button>
  );
}

/** ---------- Color Picker Row (only shown in Edit mode) ---------- */
function ColorPickerInline({
  S,
  value,
  onPreview,
  onCommit,
  onClear,
  disabled,
}) {
  const inputRef = useRef(null);

  const hex = String(value || "").trim();
  const pickerValue = hex || "#8E8E93";

  return (
    <div style={{ marginTop: 12 }}>
      <FieldLabel>Color</FieldLabel>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          title={hex ? `Color: ${hex}` : "Pick a color"}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: pickerValue,
            boxShadow: "0 14px 34px rgba(0,0,0,0.18)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.65 : 1,
          }}
        />

        <input
          ref={inputRef}
          type="color"
          value={pickerValue}
          disabled={disabled}
          onInput={(e) => onPreview?.(e.target.value)}
          onChange={(e) => onCommit?.(e.target.value)}
          style={{ display: "none" }}
        />

        <div
          style={{
            height: 38,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.18)",
            color: "rgba(255,255,255,0.82)",
            fontSize: 12,
            fontWeight: 850,
            letterSpacing: "-0.01em",
          }}
          title="Stored as HEX (e.g. #0A84FF)"
        >
          {hex ? hex.toUpperCase() : "Default"}
        </div>

        <button
          type="button"
          onClick={onClear}
          disabled={disabled || !hex}
          style={S.button("subtle", disabled || !hex)}
          title="Clear custom color"
        >
          Clear
        </button>

        <div style={{ ...S.mini, opacity: 0.75 }}>Saves when you finish</div>
      </div>
    </div>
  );
}

function TrackRowCard({
  S,
  t,
  edit,
  actions,
  isFirst,
  isLast,
  updateTrackColor,
}) {
  const isEditing = edit.editingTrackId === t.id;
  const accent = hexToRgba(t.color, 0.78);

  const [hovered, setHovered] = useState(false);

  const stop = (e) => e.stopPropagation();

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

  const pressOn = (e) => {
    if (e.target.closest("button")) return;
    if (e.target.closest("input")) return;
    if (e.target.closest("select")) return;
    if (e.target.closest("label")) return;
    e.currentTarget.style.transform = "translateY(0px) scale(0.995)";
  };

  const pressOff = (e) => {
    if (e.target.closest("button")) return;
    if (e.target.closest("input")) return;
    if (e.target.closest("select")) return;
    if (e.target.closest("label")) return;
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
            display: "grid",
            gridTemplateColumns: isEditing
              ? "minmax(240px, 1fr) auto auto"
              : "1fr",
            alignItems: "end",
            gap: 12,
          }}
          onClick={stop}
          onMouseDown={stop}
        >
          <div style={{ minWidth: 0 }}>
            {isEditing ? (
              <>
                <FieldLabel>Name</FieldLabel>
                <input
                  value={edit.editTrackName}
                  onChange={(e) => edit.setEditTrackName(e.target.value)}
                  style={{ ...S.input, width: "100%", maxWidth: 420 }}
                  placeholder="Track name"
                />
              </>
            ) : (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: "-0.01em",
                }}
              >
                {t.name}
              </div>
            )}
          </div>

          {isEditing && (
            <div style={{ display: "grid", alignContent: "end" }}>
              <FieldLabel>ID</FieldLabel>
              <div
                style={{ height: 38, display: "flex", alignItems: "center" }}
              >
                <div
                  style={{
                    height: 38,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <IdMeta id={t.localId ?? t.id} label="#" />
                  <IdMeta id={t.id} label="PK" />
                </div>
              </div>
            </div>
          )}

          {isEditing && (
            <div style={{ display: "grid", alignContent: "end" }}>
              <FieldLabel>Status</FieldLabel>
              <select
                value={edit.editTrackActive}
                onChange={(e) => edit.setEditTrackActive(e.target.value)}
                style={{ ...S.select, width: 170, height: 38 }}
              >
                <option value="TRUE">Active</option>
                <option value="FALSE">Inactive</option>
              </select>
            </div>
          )}
        </div>

        {isEditing && (
          <div onClick={stop} onMouseDown={stop}>
            <ColorPickerInline
              S={S}
              value={t.color}
              disabled={edit.editTrackSaving}
              onPreview={(hex) => updateTrackColor?.(t, hex, { preview: true })}
              onCommit={(hex) => updateTrackColor?.(t, hex)}
              onClear={() => updateTrackColor?.(t, "")}
            />
          </div>
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
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          onClick={stop}
          onMouseDown={stop}
        >
          {isEditing ? (
            <>
              <button
                onClick={() => actions.saveEditTrack(t)}
                disabled={edit.editTrackSaving}
                style={S.button("primary", edit.editTrackSaving)}
              >
                {edit.editTrackSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => actions.cancelEditTrack()}
                disabled={edit.editTrackSaving}
                style={S.button("ghost", edit.editTrackSaving)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => actions.startEditTrack(t)}
                style={S.button("subtle")}
              >
                Edit
              </button>
              <button
                onClick={() => actions.deleteTrackDefinition(t)}
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

export default function TracksTab({
  S,

  tracks,
  tracksLoading,
  tracksError,

  editingTrackId,
  editTrackName,
  setEditTrackName,
  editTrackActive,
  setEditTrackActive,
  editTrackSaving,

  openAddTrack,
  loadTracks,
  startEditTrack,
  cancelEditTrack,
  saveEditTrack,
  deleteTrackDefinition,
  toggleTrackActive,

  // passed from App.js
  updateTrackColor,
}) {
  const [q, setQ] = useState("");

  const baseList = useMemo(() => {
    const list = Array.isArray(tracks) ? tracks : [];
    const query = (q || "").trim().toLowerCase();
    if (!query) return list;

    return list.filter((t) => {
      const hay = `${t.localId ?? ""} ${t.id} ${t.name || ""} ${
        t.active ? "active" : "inactive"
      }`.toLowerCase();
      return hay.includes(query);
    });
  }, [tracks, q]);

  const grouped = useMemo(() => {
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
      { key: "Active", title: "Active", items: activeItems },
      { key: "Inactive", title: "Inactive", items: inactiveItems },
    ];
  }, [baseList]);

  const groupKeys = useMemo(() => grouped.map((g) => g.key), [grouped]);
  const expand = useExpandableKeys(groupKeys, { defaultExpanded: true });
  const toggleGroup = useCallback((key) => expand.toggle(key), [expand]);

  const resetAll = useCallback(() => {
    setQ("");
    expand.resetToDefault();
  }, [expand]);

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

  const canRender = !tracksLoading && !tracksError;

  const edit = {
    editingTrackId,
    editTrackName,
    setEditTrackName,
    editTrackActive,
    setEditTrackActive,
    editTrackSaving,
  };

  const actions = {
    startEditTrack,
    cancelEditTrack,
    saveEditTrack,
    deleteTrackDefinition,
    toggleTrackActive,
  };

  const activeCount = grouped[0]?.items?.length ?? 0;
  const inactiveCount = grouped[1]?.items?.length ?? 0;

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={S.cardTitle}>Show Tracks</h2>
          <div style={S.helper}>Add or remove show tracks.</div>
        </div>

        <div style={S.row}>
          <button style={S.button("primary")} onClick={openAddTrack}>
            Add Track
          </button>

          <button
            style={S.button("subtle")}
            onClick={() => loadTracks(true)}
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
              placeholder="Search tracks"
              style={{ ...S.input, width: 320, flex: "1 1 240px" }}
            />

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
                count={activeCount}
                title={`Active: ${activeCount}`}
              />
              <DotCount
                color="rgba(142,142,147,0.85)"
                count={inactiveCount}
                title={`Inactive: ${inactiveCount}`}
              />
            </div>
          </div>
        </div>

        {tracksLoading && <p style={S.loading}>Loading tracks...</p>}
        {tracksError && <p style={S.error}>{tracksError}</p>}

        {canRender && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {grouped.map((g) => {
              const open = expand.expanded.has(g.key);

              const counts =
                g.key === "Active"
                  ? { active: g.items.length, inactive: 0 }
                  : { active: 0, inactive: g.items.length };

              return (
                <div
                  key={g.key}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <GroupHeaderIOS
                    title={g.title}
                    subtitle={`${g.items.length} tracks`}
                    open={open}
                    onToggle={() => toggleGroup(g.key)}
                    counts={counts}
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
                        {g.items.map((t, idx) => (
                          <TrackRowCard
                            key={t.id}
                            S={S}
                            t={t}
                            edit={edit}
                            actions={actions}
                            updateTrackColor={updateTrackColor}
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
                No tracks match your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
