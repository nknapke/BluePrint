// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Segmented } from "../components/ui/Segmented";

const EMPTY_ITEM_FORM = {
  name: "",
  photoUrl: "",
  lowStockThreshold: "",
  notes: "",
};

const EMPTY_LOCATION_FORM = {
  name: "",
  notes: "",
};

const DEFAULT_MOVE_FORM = {
  fromLocationId: "",
  toLocationId: "",
  quantity: "1",
};

const SORT_OPTIONS = [
  { value: "name", label: "Name (A-Z)" },
  { value: "total", label: "Total Inventory" },
  { value: "recent", label: "Recently Updated" },
  { value: "low", label: "Low Stock First" },
];

const INVENTORY_HISTORY_EVENT_OPTIONS = [
  { value: "ALL", label: "All Events" },
  { value: "adjustment", label: "Adjustments" },
  { value: "move_out", label: "Move Out" },
  { value: "move_in", label: "Move In" },
  { value: "item_created", label: "Item Created" },
  { value: "item_updated", label: "Item Updated" },
  { value: "item_deleted", label: "Item Deleted" },
  { value: "location_created", label: "Location Created" },
  { value: "location_updated", label: "Location Updated" },
  { value: "location_deleted", label: "Location Deleted" },
];

function getErrorMessage(error) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (
    raw.includes("inventory_") ||
    raw.includes("public.departments") ||
    raw.includes("v_inventory_item_summaries")
  ) {
    return "Inventory tables are not available yet. Run the inventory migration in Supabase first.";
  }
  return raw || "Request failed";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    sensitivity: "base",
  });
}

function clampQuantity(value) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  if (!digitsOnly) return "0";
  const parsed = Number.parseInt(digitsOnly, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return "0";
  return String(parsed);
}

function parseQuantity(value) {
  const parsed = Number.parseInt(String(value || "0"), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatDateTime(value) {
  if (!value) return "Never";
  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) return "Never";
  return stamp.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function isLowStock(item) {
  if (!item) return false;
  if (item.low_stock_threshold == null) return false;
  return Number(item.total_inventory || 0) <= Number(item.low_stock_threshold || 0);
}

function getInventoryEventLabel(type) {
  const key = String(type || "").trim();
  if (key === "adjustment") return "Adjustment";
  if (key === "move_out") return "Move Out";
  if (key === "move_in") return "Move In";
  if (key === "item_created") return "Item Created";
  if (key === "item_updated") return "Item Updated";
  if (key === "item_deleted") return "Item Deleted";
  if (key === "location_created") return "Location Created";
  if (key === "location_updated") return "Location Updated";
  if (key === "location_deleted") return "Location Deleted";
  return key || "Event";
}

function getInventoryEventTone(type) {
  const key = String(type || "").trim();
  if (key === "adjustment" || key === "move_in") return "good";
  if (key === "move_out") return "warn";
  if (key.includes("deleted")) return "bad";
  return "info";
}

async function fileToDataUrl(file) {
  if (!file) return "";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
}

function buildMoveDefaults(locations, stockByLocation) {
  const available = locations.filter(
    (location) => Number(stockByLocation.get(location.id)?.quantity || 0) > 0
  );
  const firstSource = available[0]?.id || locations[0]?.id || "";
  const firstTarget =
    locations.find((location) => location.id !== firstSource)?.id || firstSource;
  return {
    fromLocationId: firstSource,
    toLocationId: firstTarget,
    quantity: "1",
  };
}

function InventoryModal({ title, subtitle, onClose, children, width = 560 }) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3,6,12,0.68)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 120,
      }}
    >
      <div
        style={{
          width: "min(100%, " + width + "px)",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(24,28,38,0.98) 0%, rgba(16,20,30,0.98) 100%)",
          boxShadow: "0 28px 80px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "rgba(255,255,255,0.94)",
              }}
            >
              {title}
            </div>
            {subtitle ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "rgba(255,255,255,0.58)",
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.86)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, helper }) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          marginBottom: 7,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.56)",
        }}
      >
        {label}
      </div>
      {children}
      {helper ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.52)",
          }}
        >
          {helper}
        </div>
      ) : null}
    </label>
  );
}

export default function InventoryTab({
  S,
  supabaseGet,
  supabasePost,
  supabasePatch,
  supabaseDelete,
  markUpdated,
  inventoryActorId,
  inventoryActorName,
}) {
  const [departmentRows, setDepartmentRows] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [locations, setLocations] = useState([]);
  const [itemSummaries, setItemSummaries] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [stockRows, setStockRows] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState("grid");
  const [filterMode, setFilterMode] = useState("all");

  const [draftQuantities, setDraftQuantities] = useState({});
  const [stockSaving, setStockSaving] = useState(false);

  const [itemModalMode, setItemModalMode] = useState("");
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [itemSaving, setItemSaving] = useState(false);
  const itemPhotoInputRef = useRef(null);

  const [locationModalMode, setLocationModalMode] = useState("");
  const [editingLocationId, setEditingLocationId] = useState("");
  const [locationForm, setLocationForm] = useState(EMPTY_LOCATION_FORM);
  const [locationSaving, setLocationSaving] = useState(false);

  const [manageLocationsOpen, setManageLocationsOpen] = useState(false);
  const [locationDeletingId, setLocationDeletingId] = useState("");

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveForm, setMoveForm] = useState(DEFAULT_MOVE_FORM);
  const [moveSaving, setMoveSaving] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyActors, setHistoryActors] = useState([]);
  const [historyEventFilter, setHistoryEventFilter] = useState("ALL");
  const [historyItemFilter, setHistoryItemFilter] = useState("ALL");
  const [historyLocationFilter, setHistoryLocationFilter] = useState("ALL");

  const [deleteItemOpen, setDeleteItemOpen] = useState(false);
  const [deleteItemBusy, setDeleteItemBusy] = useState(false);

  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [navigationBusy, setNavigationBusy] = useState(false);

  const [toast, setToast] = useState(null);
  const [actorRows, setActorRows] = useState([]);

  const selectedDepartment = useMemo(
    () =>
      departmentRows.find((department) => department.id === selectedDepartmentId) || null,
    [departmentRows, selectedDepartmentId]
  );

  const selectedItem = useMemo(
    () => itemSummaries.find((item) => item.id === selectedItemId) || null,
    [itemSummaries, selectedItemId]
  );

  const itemNameById = useMemo(
    () => new Map(itemSummaries.map((item) => [String(item.id), String(item.name || "")])),
    [itemSummaries]
  );

  const locationNameById = useMemo(
    () => new Map(locations.map((location) => [String(location.id), String(location.name || "")])),
    [locations]
  );

  const stockByLocation = useMemo(() => {
    const map = new Map();
    for (const row of stockRows) {
      map.set(row.location_id, row);
    }
    return map;
  }, [stockRows]);

  const locationRows = useMemo(() => {
    return locations
      .slice()
      .sort((a, b) => compareText(a.name, b.name))
      .map((location) => {
        const currentRow = stockByLocation.get(location.id) || null;
        const currentQuantity = Number(currentRow?.quantity || 0);
        const draftValue =
          draftQuantities[location.id] == null
            ? String(currentQuantity)
            : String(draftQuantities[location.id]);
        const nextQuantity = parseQuantity(draftValue);
        return {
          ...location,
          currentRow,
          currentQuantity,
          draftValue,
          nextQuantity,
          lastUpdatedAt: currentRow?.last_updated_at || null,
          lastUpdatedBy: currentRow?.last_updated_by || null,
          isChanged: nextQuantity !== currentQuantity,
        };
      });
  }, [locations, stockByLocation, draftQuantities]);

  const selectedItemMetrics = useMemo(() => {
    if (!selectedItem) return null;
    const activeLocationCount = locationRows.filter((row) => row.nextQuantity > 0).length;
    const zeroLocationCount = Math.max(locationRows.length - activeLocationCount, 0);
    return {
      activeLocationCount,
      zeroLocationCount,
      recentlyUpdatedAt: formatDateTime(selectedItem.recently_updated_at),
    };
  }, [locationRows, selectedItem]);

  const canWriteInventory = Boolean(String(inventoryActorId || "").trim());
  const inventoryActorLabel = String(inventoryActorName || "").trim();

  const historyActorNameById = useMemo(
    () =>
      new Map(
        historyActors.map((actor) => [
          String(actor.id),
          String(actor.display_name || ""),
        ])
      ),
    [historyActors]
  );

  const actorNameById = useMemo(() => {
    const map = new Map(
      actorRows.map((actor) => [String(actor.id), String(actor.display_name || "")])
    );
    if (inventoryActorId && inventoryActorLabel) {
      map.set(String(inventoryActorId), inventoryActorLabel);
    }
    return map;
  }, [actorRows, inventoryActorId, inventoryActorLabel]);

  const filteredHistoryRows = useMemo(() => {
    return historyRows.filter((row) => {
      if (historyEventFilter !== "ALL" && row.event_type !== historyEventFilter) return false;
      if (historyItemFilter !== "ALL" && String(row.item_id || "") !== historyItemFilter) {
        return false;
      }
      if (
        historyLocationFilter !== "ALL" &&
        String(row.location_id || "") !== historyLocationFilter
      ) {
        return false;
      }
      return true;
    });
  }, [historyEventFilter, historyItemFilter, historyLocationFilter, historyRows]);

  const hasUnsavedChanges = useMemo(
    () => locationRows.some((row) => row.isChanged),
    [locationRows]
  );

  const visibleItems = useMemo(() => {
    const q = normalizeText(searchQuery);
    const base = itemSummaries.filter((item) => {
      const matchesSearch =
        !q ||
        normalizeText(item.name).includes(q) ||
        normalizeText(item.notes).includes(q) ||
        normalizeText(item.search_location_names).includes(q);

      const matchesFilter = filterMode !== "low" || isLowStock(item);
      return matchesSearch && matchesFilter;
    });

    const sorted = base.slice();
    sorted.sort((a, b) => {
      if (sortBy === "total") {
        const totalDiff = Number(b.total_inventory || 0) - Number(a.total_inventory || 0);
        if (totalDiff !== 0) return totalDiff;
        return compareText(a.name, b.name);
      }

      if (sortBy === "recent") {
        const aTime = new Date(a.recently_updated_at || 0).getTime();
        const bTime = new Date(b.recently_updated_at || 0).getTime();
        if (bTime !== aTime) return bTime - aTime;
        return compareText(a.name, b.name);
      }

      if (sortBy === "low") {
        const aLow = isLowStock(a) ? 1 : 0;
        const bLow = isLowStock(b) ? 1 : 0;
        if (bLow !== aLow) return bLow - aLow;
        const aGap =
          a.low_stock_threshold == null
            ? Number.NEGATIVE_INFINITY
            : Number(a.low_stock_threshold || 0) - Number(a.total_inventory || 0);
        const bGap =
          b.low_stock_threshold == null
            ? Number.NEGATIVE_INFINITY
            : Number(b.low_stock_threshold || 0) - Number(b.total_inventory || 0);
        if (bGap !== aGap) return bGap - aGap;
        return compareText(a.name, b.name);
      }

      return compareText(a.name, b.name);
    });

    return sorted;
  }, [filterMode, itemSummaries, searchQuery, sortBy]);

  const inventoryPreferenceKey = useMemo(() => {
    if (!selectedDepartmentId) return "";
    return `blueprint:inventory:${selectedDepartmentId}`;
  }, [selectedDepartmentId]);

  const showToast = useCallback((message, tone = "info") => {
    setToast({ message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!inventoryPreferenceKey) return;
    try {
      const savedView = window.localStorage.getItem(`${inventoryPreferenceKey}:view`);
      const savedSort = window.localStorage.getItem(`${inventoryPreferenceKey}:sort`);
      const savedFilter = window.localStorage.getItem(`${inventoryPreferenceKey}:filter`);
      setViewMode(savedView === "list" ? "list" : "grid");
      setSortBy(
        SORT_OPTIONS.some((option) => option.value === savedSort) ? savedSort : "name"
      );
      setFilterMode(savedFilter === "low" ? "low" : "all");
    } catch {
      setViewMode("grid");
      setSortBy("name");
      setFilterMode("all");
    }
  }, [inventoryPreferenceKey]);

  useEffect(() => {
    if (!inventoryPreferenceKey) return;
    try {
      window.localStorage.setItem(`${inventoryPreferenceKey}:view`, viewMode);
      window.localStorage.setItem(`${inventoryPreferenceKey}:sort`, sortBy);
      window.localStorage.setItem(`${inventoryPreferenceKey}:filter`, filterMode);
    } catch {
      // Keep preferences in memory if localStorage is unavailable.
    }
  }, [filterMode, inventoryPreferenceKey, sortBy, viewMode]);

  const loadDepartments = useCallback(async () => {
    setInventoryLoading(true);
    setError("");
    try {
      const rows =
        (await supabaseGet("/rest/v1/departments?select=id,name&order=name.asc", {
          bypassCache: true,
        })) || [];
      setDepartmentRows(rows);
      setSelectedDepartmentId((current) => {
        if (current && rows.some((row) => row.id === current)) return current;
        const propsRow =
          rows.find((row) => normalizeText(row.name) === "props") || rows[0] || null;
        return propsRow?.id || "";
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setInventoryLoading(false);
    }
  }, [supabaseGet]);

  const loadDepartmentData = useCallback(
    async (departmentId) => {
      if (!departmentId) {
        setLocations([]);
        setItemSummaries([]);
        setSelectedItemId("");
        return;
      }

      setInventoryLoading(true);
      setError("");
      try {
        const [locationRowsResponse, itemRowsResponse] = await Promise.all([
          supabaseGet(
            `/rest/v1/inventory_locations?select=id,name,notes,updated_at&department_id=eq.${encodeURIComponent(
              departmentId
            )}&order=name.asc`,
            { bypassCache: true }
          ),
          supabaseGet(
            `/rest/v1/v_inventory_item_summaries?select=id,department_id,name,photo_url,notes,low_stock_threshold,total_inventory,location_count,populated_location_count,stock_row_count,search_location_names,recently_updated_at,last_updated_by&department_id=eq.${encodeURIComponent(
              departmentId
            )}`,
            { bypassCache: true }
          ),
        ]);

        const nextLocations = Array.isArray(locationRowsResponse)
          ? locationRowsResponse
          : [];
        const nextItems = Array.isArray(itemRowsResponse) ? itemRowsResponse : [];

        setLocations(nextLocations);
        setItemSummaries(nextItems);
        setSelectedItemId((current) => {
          if (current && nextItems.some((item) => item.id === current)) return current;
          return nextItems[0]?.id || "";
        });
      } catch (loadError) {
        setError(getErrorMessage(loadError));
        setLocations([]);
        setItemSummaries([]);
        setSelectedItemId("");
      } finally {
        setInventoryLoading(false);
      }
    },
    [supabaseGet]
  );

  const loadSelectedItemStock = useCallback(
    async (departmentId, itemId) => {
      if (!departmentId || !itemId) {
        setStockRows([]);
        setDraftQuantities({});
        return;
      }

      setDetailLoading(true);
      try {
        const rows =
          (await supabaseGet(
            `/rest/v1/inventory_stock_levels?select=id,location_id,quantity,last_updated_at,last_updated_by&department_id=eq.${encodeURIComponent(
              departmentId
            )}&item_id=eq.${encodeURIComponent(itemId)}`,
            { bypassCache: true }
          )) || [];
        setStockRows(rows);
        setDraftQuantities({});
      } catch (loadError) {
        setError(getErrorMessage(loadError));
        setStockRows([]);
        setDraftQuantities({});
      } finally {
        setDetailLoading(false);
      }
    },
    [supabaseGet]
  );

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (!selectedDepartmentId) return;
    loadDepartmentData(selectedDepartmentId);
  }, [loadDepartmentData, selectedDepartmentId]);

  useEffect(() => {
    if (!selectedDepartmentId || !selectedItemId) {
      setStockRows([]);
      setDraftQuantities({});
      return;
    }
    loadSelectedItemStock(selectedDepartmentId, selectedItemId);
  }, [loadSelectedItemStock, selectedDepartmentId, selectedItemId]);

  useEffect(() => {
    let ignore = false;
    async function loadActors() {
      try {
        const rows =
          (await supabaseGet("/rest/v1/inventory_actors?select=id,display_name", {
            bypassCache: true,
          })) || [];
        if (!ignore) setActorRows(Array.isArray(rows) ? rows : []);
      } catch {
        if (!ignore) setActorRows([]);
      }
    }
    loadActors();
    return () => {
      ignore = true;
    };
  }, [supabaseGet]);

  useEffect(() => {
    if (selectedItemId) return;
    if (!itemSummaries.length) return;
    setSelectedItemId(itemSummaries[0].id);
  }, [itemSummaries, selectedItemId]);

  useEffect(() => {
    setHistoryOpen(false);
    setHistoryRows([]);
    setHistoryActors([]);
    setHistoryError("");
    setHistoryEventFilter("ALL");
    setHistoryItemFilter("ALL");
    setHistoryLocationFilter("ALL");
  }, [selectedDepartmentId]);

  const updateDraftQuantity = useCallback((locationId, nextValue) => {
    setDraftQuantities((current) => ({
      ...current,
      [locationId]: clampQuantity(nextValue),
    }));
  }, []);

  const resetDrafts = useCallback(() => {
    setDraftQuantities({});
  }, []);

  const refreshAfterMutation = useCallback(
    async (options = {}) => {
      const {
        reloadDepartment = true,
        reloadStock = true,
        nextSelectedItemId,
        nextSelectedDepartmentId,
      } = options;
      const departmentId = nextSelectedDepartmentId || selectedDepartmentId;

      if (reloadDepartment && departmentId) {
        await loadDepartmentData(departmentId);
      }

      const itemId = nextSelectedItemId ?? selectedItemId;
      if (reloadStock && departmentId && itemId) {
        await loadSelectedItemStock(departmentId, itemId);
      }

      if (typeof markUpdated === "function") markUpdated();
    },
    [
      loadDepartmentData,
      loadSelectedItemStock,
      markUpdated,
      selectedDepartmentId,
      selectedItemId,
    ]
  );

  const applyPendingNavigation = useCallback(() => {
    if (!pendingNavigation) return;
    const pending = pendingNavigation;
    setPendingNavigation(null);
    if (pending.type === "item") {
      setSelectedItemId(pending.value);
      return;
    }
    if (pending.type === "department") {
      setSelectedItemId("");
      setSelectedDepartmentId(pending.value);
    }
  }, [pendingNavigation]);

  const saveStockChanges = useCallback(async () => {
    if (!selectedDepartmentId || !selectedItemId) return true;
    if (!canWriteInventory || !inventoryActorId) {
      setError("Set Inventory User in Settings before making inventory changes.");
      showToast("Set Inventory User in Settings before making changes.", "warn");
      return false;
    }
    const changedRows = locationRows.filter((row) => row.isChanged);
    if (!changedRows.length) return true;

    setStockSaving(true);
    setError("");
    try {
      const stamp = new Date().toISOString();
      await supabasePost(
        "/rest/v1/inventory_stock_levels?on_conflict=item_id,location_id",
        changedRows.map((row) => ({
          department_id: selectedDepartmentId,
          item_id: selectedItemId,
          location_id: row.id,
          quantity: row.nextQuantity,
          last_updated_at: stamp,
          last_updated_by: inventoryActorId,
        })),
        {
          prefer: "resolution=merge-duplicates,return=representation",
        }
      );

      const events = changedRows.map((row) => ({
        department_id: selectedDepartmentId,
        item_id: selectedItemId,
        location_id: row.id,
        event_type: "adjustment",
        delta: row.nextQuantity - row.currentQuantity,
        new_quantity: row.nextQuantity,
        actor_id: inventoryActorId,
      }));

      if (events.length) {
        await supabasePost("/rest/v1/inventory_events", events, {
          prefer: "return=minimal",
        });
      }

      await refreshAfterMutation({ reloadDepartment: true, reloadStock: true });
      showToast("Inventory updated successfully", "good");
      return true;
    } catch (saveError) {
      setError(getErrorMessage(saveError));
      showToast("Unable to update inventory", "bad");
      return false;
    } finally {
      setStockSaving(false);
    }
  }, [
    locationRows,
    refreshAfterMutation,
    selectedDepartmentId,
    selectedItemId,
    showToast,
    canWriteInventory,
    inventoryActorId,
    supabasePost,
  ]);

  const confirmPendingNavigationSave = useCallback(async () => {
    if (!pendingNavigation) return;
    setNavigationBusy(true);
    const saved = await saveStockChanges();
    setNavigationBusy(false);
    if (!saved) return;
    applyPendingNavigation();
  }, [applyPendingNavigation, pendingNavigation, saveStockChanges]);

  const discardPendingNavigation = useCallback(() => {
    resetDrafts();
    applyPendingNavigation();
  }, [applyPendingNavigation, resetDrafts]);

  const openCreateItem = useCallback(() => {
    if (!canWriteInventory) {
      showToast("Set Inventory User in Settings before creating items.", "warn");
      return;
    }
    if (hasUnsavedChanges) {
      showToast("Save or discard stock edits before creating a new item.", "warn");
      return;
    }
    setItemForm(EMPTY_ITEM_FORM);
    setItemModalMode("create");
  }, [canWriteInventory, hasUnsavedChanges, showToast]);

  const openEditItem = useCallback(() => {
    if (!selectedItem) return;
    if (!canWriteInventory) {
      showToast("Set Inventory User in Settings before editing items.", "warn");
      return;
    }
    if (hasUnsavedChanges) {
      showToast("Save or discard stock edits before editing this item.", "warn");
      return;
    }
    setItemForm({
      name: selectedItem.name || "",
      photoUrl: selectedItem.photo_url || "",
      lowStockThreshold:
        selectedItem.low_stock_threshold == null
          ? ""
          : String(selectedItem.low_stock_threshold),
      notes: selectedItem.notes || "",
    });
    setItemModalMode("edit");
  }, [canWriteInventory, hasUnsavedChanges, selectedItem, showToast]);

  const saveItem = useCallback(async () => {
    if (!selectedDepartmentId) return;
    if (!canWriteInventory || !inventoryActorId) {
      setError("Set Inventory User in Settings before editing inventory.");
      showToast("Set Inventory User in Settings before making changes.", "warn");
      return;
    }
    const trimmedName = String(itemForm.name || "").trim();
    if (!trimmedName) {
      setError("Item name is required.");
      return;
    }

    const duplicate = itemSummaries.some((item) => {
      if (itemModalMode === "edit" && item.id === selectedItem?.id) return false;
      return normalizeText(item.name) === normalizeText(trimmedName);
    });
    if (duplicate) {
      setError(`"${trimmedName}" already exists in ${selectedDepartment?.name || "this department"}.`);
      return;
    }

    setItemSaving(true);
    setError("");
    try {
      const payload = {
        department_id: selectedDepartmentId,
        name: trimmedName,
        photo_url: String(itemForm.photoUrl || "").trim() || null,
        notes: String(itemForm.notes || "").trim() || null,
        low_stock_threshold:
          String(itemForm.lowStockThreshold || "").trim() === ""
            ? null
            : Math.max(0, parseQuantity(itemForm.lowStockThreshold)),
      };

      if (itemModalMode === "create") {
        const created = await supabasePost("/rest/v1/inventory_items", {
          ...payload,
          created_by: inventoryActorId,
        });
        if (created?.id) {
          await supabasePost(
            "/rest/v1/inventory_events",
            {
              department_id: selectedDepartmentId,
              item_id: created.id,
              location_id: null,
              event_type: "item_created",
              delta: 0,
              new_quantity: null,
              actor_id: inventoryActorId,
            },
            { prefer: "return=minimal" }
          );
        }
        setItemModalMode("");
        await loadDepartmentData(selectedDepartmentId);
        if (created?.id) setSelectedItemId(created.id);
        showToast("Item created", "good");
      } else if (itemModalMode === "edit" && selectedItem?.id) {
        await supabasePatch(
          `/rest/v1/inventory_items?id=eq.${encodeURIComponent(selectedItem.id)}`,
          payload
        );
        await supabasePost(
          "/rest/v1/inventory_events",
          {
            department_id: selectedDepartmentId,
            item_id: selectedItem.id,
            location_id: null,
            event_type: "item_updated",
            delta: 0,
            new_quantity: null,
            actor_id: inventoryActorId,
          },
          { prefer: "return=minimal" }
        );
        setItemModalMode("");
        await refreshAfterMutation({ reloadDepartment: true, reloadStock: false });
        showToast("Item updated", "good");
      }

      if (typeof markUpdated === "function") markUpdated();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
      showToast("Unable to save item", "bad");
    } finally {
      setItemSaving(false);
    }
  }, [
    itemForm.lowStockThreshold,
    itemForm.name,
    itemForm.notes,
    itemForm.photoUrl,
    itemModalMode,
    itemSummaries,
    loadDepartmentData,
    markUpdated,
    refreshAfterMutation,
    canWriteInventory,
    inventoryActorId,
    selectedDepartment?.name,
    selectedDepartmentId,
    selectedItem?.id,
    showToast,
    supabasePatch,
    supabasePost,
  ]);

  const confirmDeleteItem = useCallback(async () => {
    if (!selectedItem?.id) return;
    if (!canWriteInventory || !inventoryActorId) {
      setError("Set Inventory User in Settings before editing inventory.");
      showToast("Set Inventory User in Settings before making changes.", "warn");
      return;
    }
    setDeleteItemBusy(true);
    setError("");
    try {
      await supabasePost(
        "/rest/v1/inventory_events",
        {
          department_id: selectedDepartmentId,
          item_id: selectedItem.id,
          location_id: null,
          event_type: "item_deleted",
          delta: 0,
          new_quantity: null,
          actor_id: inventoryActorId,
        },
        { prefer: "return=minimal" }
      );
      await supabaseDelete(
        `/rest/v1/inventory_items?id=eq.${encodeURIComponent(selectedItem.id)}`
      );
      setDeleteItemOpen(false);
      await loadDepartmentData(selectedDepartmentId);
      showToast("Item deleted", "good");
      if (typeof markUpdated === "function") markUpdated();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      showToast("Unable to delete item", "bad");
    } finally {
      setDeleteItemBusy(false);
    }
  }, [
    loadDepartmentData,
    markUpdated,
    canWriteInventory,
    inventoryActorId,
    selectedDepartmentId,
    selectedItem?.id,
    showToast,
    supabasePost,
    supabaseDelete,
  ]);

  const openLocationCreator = useCallback(() => {
    if (!canWriteInventory) {
      showToast("Set Inventory User in Settings before changing locations.", "warn");
      return;
    }
    if (hasUnsavedChanges) {
      showToast("Save or discard stock edits before changing locations.", "warn");
      return;
    }
    setEditingLocationId("");
    setLocationForm(EMPTY_LOCATION_FORM);
    setLocationModalMode("create");
  }, [canWriteInventory, hasUnsavedChanges, showToast]);

  const openLocationEditor = useCallback(
    (location) => {
      if (!location?.id) return;
      if (!canWriteInventory) {
        showToast("Set Inventory User in Settings before changing locations.", "warn");
        return;
      }
      if (hasUnsavedChanges) {
        showToast("Save or discard stock edits before changing locations.", "warn");
        return;
      }
      setEditingLocationId(location.id);
      setLocationForm({
        name: location.name || "",
        notes: location.notes || "",
      });
      setLocationModalMode("edit");
    },
    [canWriteInventory, hasUnsavedChanges, showToast]
  );

  const saveLocation = useCallback(async () => {
    if (!selectedDepartmentId) return;
    if (!canWriteInventory || !inventoryActorId) {
      setError("Set Inventory User in Settings before editing inventory.");
      showToast("Set Inventory User in Settings before making changes.", "warn");
      return;
    }
    const trimmedName = String(locationForm.name || "").trim();
    if (!trimmedName) {
      setError("Location name is required.");
      return;
    }
    const duplicate = locations.some(
      (location) =>
        location.id !== editingLocationId &&
        normalizeText(location.name) === normalizeText(trimmedName)
    );
    if (duplicate) {
      setError(`"${trimmedName}" already exists in ${selectedDepartment?.name || "this department"}.`);
      return;
    }

    setLocationSaving(true);
    setError("");
    try {
      if (locationModalMode === "edit" && editingLocationId) {
        await supabasePatch(
          `/rest/v1/inventory_locations?id=eq.${encodeURIComponent(editingLocationId)}`,
          {
            name: trimmedName,
            notes: String(locationForm.notes || "").trim() || null,
          }
        );
        await supabasePost(
          "/rest/v1/inventory_events",
          {
            department_id: selectedDepartmentId,
            item_id: null,
            location_id: editingLocationId,
            event_type: "location_updated",
            delta: 0,
            new_quantity: null,
            actor_id: inventoryActorId,
          },
          { prefer: "return=minimal" }
        );
        setLocationModalMode("");
        setEditingLocationId("");
        await refreshAfterMutation({ reloadDepartment: true, reloadStock: true });
        showToast("Location updated", "good");
      } else {
        const created = await supabasePost("/rest/v1/inventory_locations", {
          department_id: selectedDepartmentId,
          name: trimmedName,
          notes: String(locationForm.notes || "").trim() || null,
          created_by: inventoryActorId,
        });
        if (created?.id) {
          await supabasePost(
            "/rest/v1/inventory_events",
            {
              department_id: selectedDepartmentId,
              item_id: null,
              location_id: created.id,
              event_type: "location_created",
              delta: 0,
              new_quantity: null,
              actor_id: inventoryActorId,
            },
            { prefer: "return=minimal" }
          );
        }
        setLocationModalMode("");
        setEditingLocationId("");
        await refreshAfterMutation({ reloadDepartment: true, reloadStock: true });
        showToast("Location created", "good");
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError));
      showToast(
        locationModalMode === "edit" ? "Unable to update location" : "Unable to create location",
        "bad"
      );
    } finally {
      setLocationSaving(false);
    }
  }, [
    canWriteInventory,
    inventoryActorId,
    editingLocationId,
    locationForm.name,
    locationForm.notes,
    locationModalMode,
    locations,
    refreshAfterMutation,
    selectedDepartment?.name,
    selectedDepartmentId,
    showToast,
    supabasePatch,
    supabasePost,
  ]);

  const deleteLocation = useCallback(
    async (location) => {
      if (!location?.id) return;
      if (!canWriteInventory || !inventoryActorId) {
        setError("Set Inventory User in Settings before editing inventory.");
        showToast("Set Inventory User in Settings before making changes.", "warn");
        return;
      }
      setLocationDeletingId(location.id);
      setError("");
      try {
        const existingQtyRows =
          (await supabaseGet(
            `/rest/v1/inventory_stock_levels?select=id&location_id=eq.${encodeURIComponent(
              location.id
            )}&quantity=gt.0&limit=1`,
            { bypassCache: true }
          )) || [];

        if (existingQtyRows.length) {
          throw new Error(
            "Cannot delete location.\n\nInventory exists in this location. Move or clear inventory before deleting."
          );
        }

        await supabaseDelete(
          `/rest/v1/inventory_stock_levels?location_id=eq.${encodeURIComponent(
            location.id
          )}&quantity=eq.0`
        );
        await supabaseDelete(
          `/rest/v1/inventory_locations?id=eq.${encodeURIComponent(location.id)}`
        );
        await supabasePost(
          "/rest/v1/inventory_events",
          {
            department_id: selectedDepartmentId,
            item_id: null,
            location_id: null,
            event_type: "location_deleted",
            delta: 0,
            new_quantity: null,
            actor_id: inventoryActorId,
          },
          { prefer: "return=minimal" }
        );
        await refreshAfterMutation({ reloadDepartment: true, reloadStock: true });
        showToast("Location deleted", "good");
      } catch (deleteError) {
        setError(getErrorMessage(deleteError));
        showToast("Unable to delete location", "bad");
      } finally {
        setLocationDeletingId("");
      }
    },
    [
      canWriteInventory,
      inventoryActorId,
      refreshAfterMutation,
      selectedDepartmentId,
      showToast,
      supabaseDelete,
      supabaseGet,
      supabasePost,
    ]
  );

  const openMoveDialog = useCallback(() => {
    if (!selectedItem) return;
    if (!canWriteInventory) {
      showToast("Set Inventory User in Settings before moving inventory.", "warn");
      return;
    }
    if (locations.length < 2) {
      showToast("Create at least two locations before moving inventory.", "warn");
      return;
    }
    if (hasUnsavedChanges) {
      showToast("Save or discard stock edits before moving inventory.", "warn");
      return;
    }
    setMoveForm(buildMoveDefaults(locations, stockByLocation));
    setMoveOpen(true);
  }, [canWriteInventory, hasUnsavedChanges, locations, selectedItem, showToast, stockByLocation]);

  const confirmMove = useCallback(async () => {
    if (!selectedItem?.id || !selectedDepartmentId) return;
    if (!canWriteInventory || !inventoryActorId) {
      setError("Set Inventory User in Settings before editing inventory.");
      showToast("Set Inventory User in Settings before making changes.", "warn");
      return;
    }
    const fromLocationId = moveForm.fromLocationId;
    const toLocationId = moveForm.toLocationId;
    const quantityToMove = Math.max(1, parseQuantity(moveForm.quantity));

    if (!fromLocationId || !toLocationId) {
      setError("Choose both a source and destination location.");
      return;
    }
    if (fromLocationId === toLocationId) {
      setError("Source and destination locations must be different.");
      return;
    }

    const sourceQuantity = Number(stockByLocation.get(fromLocationId)?.quantity || 0);
    if (quantityToMove > sourceQuantity) {
      const sourceName =
        locations.find((location) => location.id === fromLocationId)?.name || "that location";
      setError(
        `Cannot move ${quantityToMove} items. Only ${sourceQuantity} available in ${sourceName}.`
      );
      return;
    }

    const destinationQuantity = Number(stockByLocation.get(toLocationId)?.quantity || 0);
    const stamp = new Date().toISOString();

    setMoveSaving(true);
    setError("");
    try {
      await supabasePost(
        "/rest/v1/inventory_stock_levels?on_conflict=item_id,location_id",
        [
          {
            department_id: selectedDepartmentId,
            item_id: selectedItem.id,
            location_id: fromLocationId,
            quantity: sourceQuantity - quantityToMove,
            last_updated_at: stamp,
            last_updated_by: inventoryActorId,
          },
          {
            department_id: selectedDepartmentId,
            item_id: selectedItem.id,
            location_id: toLocationId,
            quantity: destinationQuantity + quantityToMove,
            last_updated_at: stamp,
            last_updated_by: inventoryActorId,
          },
        ],
        {
          prefer: "resolution=merge-duplicates,return=representation",
        }
      );

      await supabasePost(
        "/rest/v1/inventory_events",
        [
          {
            department_id: selectedDepartmentId,
            item_id: selectedItem.id,
            location_id: fromLocationId,
            event_type: "move_out",
            delta: -quantityToMove,
            new_quantity: sourceQuantity - quantityToMove,
            actor_id: inventoryActorId,
          },
          {
            department_id: selectedDepartmentId,
            item_id: selectedItem.id,
            location_id: toLocationId,
            event_type: "move_in",
            delta: quantityToMove,
            new_quantity: destinationQuantity + quantityToMove,
            actor_id: inventoryActorId,
          },
        ],
        { prefer: "return=minimal" }
      );

      setMoveOpen(false);
      await refreshAfterMutation({ reloadDepartment: true, reloadStock: true });
      showToast("Inventory moved", "good");
    } catch (moveError) {
      setError(getErrorMessage(moveError));
      showToast("Unable to move inventory", "bad");
    } finally {
      setMoveSaving(false);
    }
  }, [
    locations,
    moveForm.fromLocationId,
    moveForm.quantity,
    moveForm.toLocationId,
    refreshAfterMutation,
    canWriteInventory,
    inventoryActorId,
    selectedDepartmentId,
    selectedItem?.id,
    showToast,
    stockByLocation,
    supabasePost,
  ]);

  const exportCsv = useCallback(async () => {
    if (!selectedDepartmentId) return;
    setError("");
    try {
      let actorById = new Map();
      try {
        const actorRows =
          (await supabaseGet("/rest/v1/inventory_actors?select=id,display_name", {
            bypassCache: true,
          })) || [];
        actorById = new Map(
          actorRows.map((actor) => [String(actor.id), String(actor.display_name || "")])
        );
      } catch {
        actorById = new Map();
      }

      const stockRowsResponse =
        (await supabaseGet(
          `/rest/v1/inventory_stock_levels?select=item_id,location_id,quantity,last_updated_at,last_updated_by&department_id=eq.${encodeURIComponent(
            selectedDepartmentId
          )}`,
          { bypassCache: true }
        )) || [];

      const stockKey = new Map();
      for (const row of stockRowsResponse) {
        stockKey.set(`${row.item_id}:${row.location_id}`, row);
      }

      const csvRows = [
        [
          "Item Name",
          "Location",
          "Quantity",
          "Total Quantity",
          "Low Stock Threshold",
          "Last Updated",
          "Updated By",
          "Item Notes",
          "Location Notes",
        ],
      ];

      const sortedItems = itemSummaries.slice().sort((a, b) => compareText(a.name, b.name));
      const sortedLocations = locations.slice().sort((a, b) => compareText(a.name, b.name));

      for (const item of sortedItems) {
        if (!sortedLocations.length) {
          csvRows.push([
            item.name,
            "",
            "0",
            String(item.total_inventory || 0),
            item.low_stock_threshold == null ? "" : String(item.low_stock_threshold),
            formatDateTime(item.recently_updated_at),
            item.last_updated_by || "",
            item.notes || "",
            "",
          ]);
          continue;
        }

        for (const location of sortedLocations) {
          const row = stockKey.get(`${item.id}:${location.id}`);
          csvRows.push([
            item.name,
            location.name,
            String(row?.quantity ?? 0),
            String(item.total_inventory || 0),
            item.low_stock_threshold == null ? "" : String(item.low_stock_threshold),
            formatDateTime(row?.last_updated_at || item.recently_updated_at),
            row?.last_updated_by
              ? actorById.get(String(row.last_updated_by)) || String(row.last_updated_by)
              : item.last_updated_by
                ? actorById.get(String(item.last_updated_by)) || String(item.last_updated_by)
                : "",
            item.notes || "",
            location.notes || "",
          ]);
        }
      }

      const csvText = csvRows.map((row) => row.map(escapeCsv).join(",")).join("\n");
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedDepartment?.name || "Inventory"} Inventory.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showToast("CSV exported", "good");
    } catch (exportError) {
      setError(getErrorMessage(exportError));
      showToast("Unable to export CSV", "bad");
    }
  }, [
    itemSummaries,
    locations,
    selectedDepartment?.name,
    selectedDepartmentId,
    showToast,
    supabaseGet,
  ]);

  const loadHistoryRows = useCallback(
    async (departmentId) => {
      if (!departmentId) return;
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const [eventRows, actorRows] = await Promise.all([
          supabaseGet(
            `/rest/v1/inventory_events?select=id,item_id,location_id,event_type,delta,new_quantity,actor_id,created_at&department_id=eq.${encodeURIComponent(
              departmentId
            )}&order=created_at.desc&limit=500`,
            { bypassCache: true }
          ),
          supabaseGet("/rest/v1/inventory_actors?select=id,display_name", {
            bypassCache: true,
          }).catch(() => []),
        ]);
        setHistoryRows(Array.isArray(eventRows) ? eventRows : []);
        setHistoryActors(Array.isArray(actorRows) ? actorRows : []);
      } catch (loadError) {
        setHistoryRows([]);
        setHistoryActors([]);
        setHistoryError(getErrorMessage(loadError));
      } finally {
        setHistoryLoading(false);
      }
    },
    [supabaseGet]
  );

  const openHistory = useCallback(
    async (focusedItemId = "ALL") => {
      if (!selectedDepartmentId) return;
      setHistoryOpen(true);
      setHistoryEventFilter("ALL");
      setHistoryItemFilter(focusedItemId || "ALL");
      setHistoryLocationFilter("ALL");
      await loadHistoryRows(selectedDepartmentId);
    },
    [loadHistoryRows, selectedDepartmentId]
  );

  const departmentOptions = useMemo(
    () =>
      departmentRows.map((department) => ({
        value: department.id,
        label: department.name,
      })),
    [departmentRows]
  );

  const metricTone = selectedItem && isLowStock(selectedItem) ? "bad" : "info";
  const lowStockVisibleCount = useMemo(
    () => visibleItems.filter((item) => isLowStock(item)).length,
    [visibleItems]
  );
  const visibleUnitCount = useMemo(
    () =>
      visibleItems.reduce((sum, item) => sum + Number(item.total_inventory || 0), 0),
    [visibleItems]
  );

  return (
    <>
      <div
        style={{
          ...S.card,
          overflow: "hidden",
          background:
            "radial-gradient(circle at 12% 18%, rgba(80,140,255,0.18) 0%, rgba(80,140,255,0) 32%), radial-gradient(circle at 85% 22%, rgba(255,190,90,0.10) 0%, rgba(255,190,90,0) 28%), linear-gradient(145deg, rgba(25,31,46,0.98) 0%, rgba(18,22,34,0.98) 58%, rgba(13,16,26,0.98) 100%)",
        }}
      >
        <div
          style={{
            ...S.cardHeader,
            padding: "20px 20px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "transparent",
          }}
        >
          <div style={{ ...S.titleBlock, gap: 10 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.46)",
              }}
            >
              Department Inventory
            </div>
            <h2 style={{ ...S.title, fontSize: 30 }}>Inventory</h2>
            <p style={{ ...S.subtitle, maxWidth: 640, fontSize: 14 }}>
              Fast, photo-first stock tracking built for non-technical teams. Browse visually,
              update quickly, and keep location counts accurate without admin-heavy workflows.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
              <div style={S.badge("info")}>
                {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}
              </div>
              <div style={S.badge("info")}>{visibleUnitCount} total units</div>
              <div style={S.badge(lowStockVisibleCount > 0 ? "warn" : "good")}>
                {lowStockVisibleCount} low stock
              </div>
            </div>
          </div>
          {departmentOptions.length ? (
            <Segmented
              value={selectedDepartmentId}
              onChange={(nextDepartmentId) => {
                if (nextDepartmentId === selectedDepartmentId) return;
                if (hasUnsavedChanges) {
                  setPendingNavigation({
                    type: "department",
                    value: nextDepartmentId,
                  });
                  return;
                }
                setSelectedItemId("");
                setSelectedDepartmentId(nextDepartmentId);
              }}
              options={departmentOptions}
            />
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          style={{
            ...S.card,
            border: "1px solid rgba(255,59,48,0.22)",
            background:
              "linear-gradient(180deg, rgba(255,59,48,0.12) 0%, rgba(255,59,48,0.04) 100%)",
          }}
        >
          <div style={S.cardBody}>
            <div style={{ ...S.cardTitle, marginBottom: 6 }}>Inventory Error</div>
            <div style={{ color: "rgba(255,220,218,0.95)", whiteSpace: "pre-line" }}>
              {error}
            </div>
          </div>
        </div>
      ) : null}

      {!canWriteInventory ? (
        <div
          style={{
            ...S.card,
            border: "1px solid rgba(255,204,0,0.20)",
            background:
              "linear-gradient(180deg, rgba(255,204,0,0.10) 0%, rgba(255,204,0,0.03) 100%)",
          }}
        >
          <div style={S.cardBody}>
            <div style={{ ...S.cardTitle, marginBottom: 6 }}>Inventory Is Read-Only</div>
            <div style={{ color: "rgba(255,240,200,0.92)", lineHeight: 1.55 }}>
              Save an <strong>Inventory User</strong> in App Settings before creating items,
              changing quantities, or moving stock.
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.25fr) minmax(420px, 0.85fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={S.card}>
          <div
            style={{
              ...S.cardHeader,
              padding: "14px 14px 12px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            <div
              style={{
                ...S.row,
                flex: "1 1 520px",
                alignItems: "center",
                gap: 8,
                padding: 8,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ flex: "1 1 280px", minWidth: 220 }}>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search items, notes, or locations"
                  style={{
                    ...S.input,
                    borderRadius: 14,
                    background: "rgba(8,12,18,0.35)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
              </div>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                style={{
                  ...S.select,
                  minWidth: 170,
                  borderRadius: 14,
                  background: "rgba(8,12,18,0.35)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} style={{ color: "#111" }}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Segmented
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { value: "grid", label: "Grid" },
                  { value: "list", label: "List" },
                ]}
              />
              <Segmented
                value={filterMode}
                onChange={setFilterMode}
                options={[
                  { value: "all", label: "All Items" },
                  { value: "low", label: "Low Stock" },
                ]}
              />
            </div>
            <div
              style={{
                ...S.row,
                gap: 8,
                padding: 6,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  void openHistory("ALL");
                }}
                style={S.button("ghost", inventoryLoading || !selectedDepartmentId)}
                disabled={inventoryLoading || !selectedDepartmentId}
              >
                History
              </button>
              <button
                type="button"
                onClick={exportCsv}
                style={S.button("ghost", inventoryLoading || !selectedDepartmentId)}
                disabled={inventoryLoading || !selectedDepartmentId}
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={openCreateItem}
                style={S.button(
                  "primary",
                  inventoryLoading || !selectedDepartmentId || !canWriteInventory
                )}
                disabled={inventoryLoading || !selectedDepartmentId || !canWriteInventory}
              >
                Add Item
              </button>
            </div>
          </div>

          <div style={S.cardBody}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div style={S.helper}>
                {inventoryLoading
                  ? "Loading inventory..."
                  : `${visibleItems.length} visible item${visibleItems.length === 1 ? "" : "s"} in ${selectedDepartment?.name || "inventory"}`}
              </div>
              <div style={S.badge(metricTone)}>
                {filterMode === "low"
                  ? "Low stock focus"
                  : selectedDepartment?.name || "Department"}
              </div>
            </div>

            {!inventoryLoading && !visibleItems.length ? (
              <div
                style={{
                  borderRadius: 18,
                  border: "1px dashed rgba(255,255,255,0.14)",
                  padding: 24,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.65)",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>
                  No items yet
                </div>
                <div style={{ marginTop: 6, lineHeight: 1.5 }}>
                  Add the first {selectedDepartment?.name || ""} item to start tracking stock
                  across locations.
                </div>
              </div>
            ) : null}

            {viewMode === "grid" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                  gap: 16,
                }}
              >
                {visibleItems.map((item) => {
                  const active = item.id === selectedItemId;
                  const lowStock = isLowStock(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        hasUnsavedChanges
                          ? setPendingNavigation({ type: "item", value: item.id })
                          : setSelectedItemId(item.id)
                      }
                      style={{
                        textAlign: "left",
                        padding: 0,
                        borderRadius: 22,
                        border: active
                          ? "1px solid rgba(0,122,255,0.46)"
                          : lowStock
                            ? "1px solid rgba(255,159,10,0.44)"
                            : "1px solid rgba(255,255,255,0.08)",
                        background:
                          active
                            ? "linear-gradient(180deg, rgba(10,32,68,0.96) 0%, rgba(16,24,38,0.98) 100%)"
                            : "linear-gradient(180deg, rgba(30,35,48,0.98) 0%, rgba(18,22,30,0.98) 100%)",
                        boxShadow: active
                          ? "0 20px 42px rgba(0,122,255,0.18)"
                          : "0 18px 36px rgba(0,0,0,0.22)",
                        cursor: "pointer",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: 180,
                          background: item.photo_url
                            ? `center / cover no-repeat url("${item.photo_url}")`
                            : "linear-gradient(135deg, rgba(61,92,143,0.32) 0%, rgba(121,180,255,0.14) 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background:
                              "linear-gradient(180deg, rgba(5,10,18,0.08) 0%, rgba(5,10,18,0.14) 42%, rgba(5,10,18,0.58) 100%)",
                          }}
                        />
                        {!item.photo_url ? (
                          <div
                            style={{
                              position: "relative",
                              zIndex: 1,
                              fontSize: 44,
                              fontWeight: 800,
                              letterSpacing: "-0.03em",
                              color: "rgba(255,255,255,0.28)",
                            }}
                          >
                            {String(item.name || "?").slice(0, 1).toUpperCase()}
                          </div>
                        ) : null}
                        {lowStock ? (
                          <div
                            style={{
                              position: "absolute",
                              top: 10,
                              right: 10,
                              zIndex: 2,
                              ...S.badge("warn"),
                            }}
                          >
                            Low
                          </div>
                        ) : null}
                        <div
                          style={{
                            position: "absolute",
                            left: 12,
                            right: 12,
                            bottom: 12,
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "space-between",
                            gap: 8,
                            zIndex: 2,
                          }}
                        >
                          <div
                            style={{
                              minWidth: 0,
                              fontSize: 18,
                              fontWeight: 850,
                              lineHeight: 1.15,
                              color: "rgba(255,255,255,0.96)",
                              textShadow: "0 2px 12px rgba(0,0,0,0.38)",
                            }}
                          >
                            {item.name}
                          </div>
                          <div
                            style={{
                              flex: "0 0 auto",
                              padding: "6px 9px",
                              borderRadius: 999,
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: "rgba(6,10,18,0.34)",
                              fontSize: 11,
                              fontWeight: 800,
                              color: "rgba(255,255,255,0.82)",
                              backdropFilter: "blur(10px)",
                            }}
                          >
                            {Number(item.location_count || 0)} spots
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: 16 }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              padding: "10px 11px",
                              borderRadius: 14,
                              border: "1px solid rgba(255,255,255,0.07)",
                              background: "rgba(255,255,255,0.04)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "rgba(255,255,255,0.46)",
                              }}
                            >
                              Total
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 20,
                                fontWeight: 850,
                                color: lowStock
                                  ? "rgba(255,202,120,0.96)"
                                  : "rgba(255,255,255,0.94)",
                              }}
                            >
                              {Number(item.total_inventory || 0)}
                            </div>
                          </div>
                          <div
                            style={{
                              padding: "10px 11px",
                              borderRadius: 14,
                              border: "1px solid rgba(255,255,255,0.07)",
                              background: "rgba(255,255,255,0.04)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "rgba(255,255,255,0.46)",
                              }}
                            >
                              Updated
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 12,
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.86)",
                                lineHeight: 1.35,
                              }}
                            >
                              {formatDateTime(item.recently_updated_at)}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            marginTop: 12,
                            fontSize: 12,
                            lineHeight: 1.5,
                            minHeight: 40,
                            color: "rgba(255,255,255,0.56)",
                          }}
                        >
                          {item.search_location_names
                            ? item.search_location_names
                            : "No active locations yet"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {visibleItems.map((item) => {
                  const active = item.id === selectedItemId;
                  const lowStock = isLowStock(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        hasUnsavedChanges
                          ? setPendingNavigation({ type: "item", value: item.id })
                          : setSelectedItemId(item.id)
                      }
                      style={{
                        display: "grid",
                        gridTemplateColumns: "84px minmax(0, 1fr) auto",
                        gap: 14,
                        alignItems: "center",
                        width: "100%",
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 20,
                        border: active
                          ? "1px solid rgba(0,122,255,0.42)"
                          : lowStock
                            ? "1px solid rgba(255,159,10,0.30)"
                            : "1px solid rgba(255,255,255,0.08)",
                        background: active
                          ? "linear-gradient(180deg, rgba(10,32,68,0.32) 0%, rgba(22,28,40,0.98) 100%)"
                          : "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.025) 100%)",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: 18,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: item.photo_url
                            ? `center / cover no-repeat url("${item.photo_url}")`
                            : "linear-gradient(135deg, rgba(61,92,143,0.32) 0%, rgba(121,180,255,0.14) 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "rgba(255,255,255,0.28)",
                          fontSize: 28,
                          fontWeight: 850,
                          flex: "0 0 auto",
                        }}
                      >
                        {!item.photo_url
                          ? String(item.name || "?").slice(0, 1).toUpperCase()
                          : null}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 850,
                              color: "rgba(255,255,255,0.94)",
                            }}
                          >
                            {item.name}
                          </div>
                          {lowStock ? <div style={S.badge("warn")}>Low</div> : null}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            lineHeight: 1.45,
                            color: "rgba(255,255,255,0.56)",
                          }}
                        >
                          {item.search_location_names || "No active locations yet"}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gap: 6,
                          minWidth: 150,
                          justifyItems: "end",
                        }}
                      >
                        <div style={S.badge(lowStock ? "warn" : "info")}>
                          {Number(item.total_inventory || 0)} total
                        </div>
                        <div style={S.badge("ghost")}>
                          {Number(item.location_count || 0)} locations
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.46)",
                            textAlign: "right",
                          }}
                        >
                          {formatDateTime(item.recently_updated_at)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            ...S.card,
            position: "sticky",
            top: 92,
            background:
              "linear-gradient(180deg, rgba(22,27,38,0.98) 0%, rgba(14,18,28,0.98) 100%)",
          }}
        >
          {!selectedItem ? (
            <div style={S.cardBody}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
                Select an item
              </div>
              <div style={{ marginTop: 8, lineHeight: 1.5, color: "rgba(255,255,255,0.62)" }}>
                Choose an item from the inventory grid to review location counts, move stock,
                and make quick inline edits.
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: 18,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(16,22,34,0.16) 100%)",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    minHeight: 220,
                    borderRadius: 24,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: selectedItem.photo_url
                      ? `center / cover no-repeat url("${selectedItem.photo_url}")`
                      : "linear-gradient(135deg, rgba(61,92,143,0.30) 0%, rgba(121,180,255,0.12) 55%, rgba(255,255,255,0.02) 100%)",
                    boxShadow: "inset 0 -80px 120px rgba(4,8,16,0.62)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(180deg, rgba(6,10,18,0.12) 0%, rgba(6,10,18,0.22) 35%, rgba(6,10,18,0.72) 100%)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 14,
                      right: 14,
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          padding: "7px 10px",
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(8,12,18,0.34)",
                          color: "rgba(255,255,255,0.92)",
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          backdropFilter: "blur(10px)",
                        }}
                      >
                        Item Profile
                      </div>
                      <div
                        style={{
                          padding: "7px 10px",
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(8,12,18,0.30)",
                          color: "rgba(255,255,255,0.84)",
                          fontSize: 11,
                          fontWeight: 700,
                          backdropFilter: "blur(10px)",
                        }}
                      >
                        {selectedDepartment?.name || "Department"}
                      </div>
                    </div>
                    {isLowStock(selectedItem) ? (
                      <div
                        style={{
                          ...S.badge("warn"),
                          background: "rgba(54,30,0,0.52)",
                          border: "1px solid rgba(255,204,0,0.30)",
                          backdropFilter: "blur(10px)",
                        }}
                      >
                        Low Stock
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      position: "absolute",
                      left: 16,
                      right: 16,
                      bottom: 16,
                      zIndex: 2,
                      display: "grid",
                      gridTemplateColumns: "88px minmax(0, 1fr)",
                      gap: 14,
                      alignItems: "end",
                    }}
                  >
                    <div
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: 22,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: selectedItem.photo_url
                          ? `center / cover no-repeat url("${selectedItem.photo_url}")`
                          : "linear-gradient(135deg, rgba(61,92,143,0.35) 0%, rgba(121,180,255,0.18) 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
                        backdropFilter: "blur(10px)",
                      }}
                    >
                      {!selectedItem.photo_url ? (
                        <div
                          style={{
                            fontSize: 28,
                            fontWeight: 850,
                            color: "rgba(255,255,255,0.36)",
                          }}
                        >
                          {String(selectedItem.name || "?").slice(0, 1).toUpperCase()}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 900,
                          lineHeight: 1.05,
                          color: "rgba(255,255,255,0.98)",
                          textShadow: "0 6px 18px rgba(0,0,0,0.32)",
                        }}
                      >
                        {selectedItem.name}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            ...S.badge("info"),
                            background: "rgba(8,12,18,0.30)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            backdropFilter: "blur(10px)",
                          }}
                        >
                          {Number(selectedItem.total_inventory || 0)} total
                        </div>
                        <div
                          style={{
                            ...S.badge("info"),
                            background: "rgba(8,12,18,0.30)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            backdropFilter: "blur(10px)",
                          }}
                        >
                          {Number(selectedItem.location_count || 0)} locations
                        </div>
                        <div
                          style={{
                            ...S.badge("ghost"),
                            background: "rgba(8,12,18,0.30)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            backdropFilter: "blur(10px)",
                          }}
                        >
                          Threshold{" "}
                          {selectedItem.low_stock_threshold == null
                            ? "—"
                            : selectedItem.low_stock_threshold}
                        </div>
                        {canWriteInventory && inventoryActorLabel ? (
                          <div
                            style={{
                              ...S.badge("good"),
                              background: "rgba(8,24,16,0.34)",
                              border: "1px solid rgba(52,199,89,0.22)",
                              backdropFilter: "blur(10px)",
                            }}
                          >
                            {inventoryActorLabel}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: 8,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.025) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    }}
                  >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.48)",
                    }}
                  >
                    Quick Actions
                  </div>
                  <div style={{ ...S.row, gap: 8, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => {
                        void openHistory(selectedItem.id);
                      }}
                      style={S.button("ghost", false)}
                    >
                      History
                    </button>
                    <button
                      type="button"
                      onClick={openMoveDialog}
                      style={S.button(
                        "ghost",
                        hasUnsavedChanges || locations.length < 2 || !canWriteInventory
                      )}
                      disabled={hasUnsavedChanges || locations.length < 2 || !canWriteInventory}
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      onClick={openEditItem}
                      style={S.button("ghost", hasUnsavedChanges || !canWriteInventory)}
                      disabled={hasUnsavedChanges || !canWriteInventory}
                    >
                      Edit Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteItemOpen(true)}
                      style={S.button("danger", hasUnsavedChanges || !canWriteInventory)}
                      disabled={hasUnsavedChanges || !canWriteInventory}
                    >
                      Delete Item
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ ...S.cardBody, padding: 18 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      padding: "12px 13px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.46)",
                      }}
                    >
                      Active Locations
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 22,
                        fontWeight: 850,
                        color: "rgba(255,255,255,0.95)",
                      }}
                    >
                      {selectedItemMetrics?.activeLocationCount ?? 0}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px 13px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.46)",
                      }}
                    >
                      Zero Count
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 22,
                        fontWeight: 850,
                        color: "rgba(255,255,255,0.95)",
                      }}
                    >
                      {selectedItemMetrics?.zeroLocationCount ?? 0}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px 13px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.46)",
                      }}
                    >
                      Threshold
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 22,
                        fontWeight: 850,
                        color: "rgba(255,255,255,0.95)",
                      }}
                    >
                      {selectedItem.low_stock_threshold == null
                        ? "—"
                        : selectedItem.low_stock_threshold}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px 13px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.46)",
                      }}
                    >
                      Latest Item Change
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        fontWeight: 750,
                        lineHeight: 1.35,
                        color: "rgba(255,255,255,0.90)",
                      }}
                    >
                      {selectedItemMetrics?.recentlyUpdatedAt || "Never"}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: 16,
                    padding: "12px 14px",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.46)",
                      }}
                    >
                      Storage Presence
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        color: "rgba(255,255,255,0.76)",
                        lineHeight: 1.45,
                      }}
                    >
                      {selectedItem.search_location_names || "No active locations yet"}
                    </div>
                  </div>
                  <div style={S.badge(isLowStock(selectedItem) ? "warn" : "good")}>
                    {isLowStock(selectedItem) ? "Needs Attention" : "Healthy Stock"}
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: 16,
                    padding: "14px 15px",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.48)",
                    }}
                  >
                    Profile Notes
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      color: "rgba(255,255,255,0.74)",
                      lineHeight: 1.55,
                    }}
                  >
                    {selectedItem.notes || "No notes for this item yet."}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Storage Map</div>
                    <div style={S.helper}>
                      Edit counts inline, keep zero rows visible, and batch-save changes.
                    </div>
                  </div>
                  <div style={S.row}>
                    <button
                      type="button"
                      onClick={openLocationCreator}
                      style={S.button("ghost", hasUnsavedChanges || !canWriteInventory)}
                      disabled={hasUnsavedChanges || !canWriteInventory}
                    >
                      Add Location
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageLocationsOpen(true)}
                      style={S.button("ghost", hasUnsavedChanges)}
                      disabled={hasUnsavedChanges}
                    >
                      Manage Locations
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  {locationRows.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) 96px",
                        gap: 12,
                        alignItems: "center",
                        padding: "12px 14px",
                        borderRadius: 16,
                        border: row.isChanged
                          ? "1px solid rgba(255,204,0,0.30)"
                          : "1px solid rgba(255,255,255,0.08)",
                        background: row.isChanged
                          ? "rgba(255,204,0,0.08)"
                          : row.currentQuantity === 0 && row.nextQuantity === 0
                            ? "rgba(255,255,255,0.025)"
                            : "rgba(255,255,255,0.04)",
                        opacity: row.currentQuantity === 0 && row.nextQuantity === 0 ? 0.64 : 1,
                        transition: "background 140ms ease, border-color 140ms ease",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "rgba(255,255,255,0.92)",
                          }}
                        >
                          {row.name}
                        </div>
                        {row.notes ? (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              color: "rgba(255,255,255,0.48)",
                            }}
                          >
                            {row.notes}
                          </div>
                        ) : null}
                        <div
                          style={{
                            marginTop: row.notes ? 5 : 6,
                            fontSize: 11,
                            lineHeight: 1.4,
                            color: "rgba(255,255,255,0.44)",
                          }}
                        >
                          {row.lastUpdatedAt
                            ? `Updated ${formatDateTime(row.lastUpdatedAt)}${
                                row.lastUpdatedBy
                                  ? ` by ${
                                      actorNameById.get(String(row.lastUpdatedBy)) || "Unknown"
                                    }`
                                  : ""
                              }`
                            : "No updates yet"}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={row.draftValue}
                        onChange={(event) =>
                          updateDraftQuantity(row.id, event.target.value)
                        }
                        style={{
                          ...S.input,
                          width: "100%",
                          textAlign: "center",
                          fontWeight: 800,
                          borderColor: row.isChanged
                            ? "rgba(255,204,0,0.28)"
                            : "rgba(255,255,255,0.12)",
                          background: row.isChanged
                            ? "rgba(255,204,0,0.08)"
                            : "rgba(255,255,255,0.06)",
                        }}
                        disabled={!canWriteInventory}
                      />
                    </div>
                  ))}

                  {!locationRows.length ? (
                    <div
                      style={{
                        borderRadius: 16,
                        border: "1px dashed rgba(255,255,255,0.12)",
                        padding: 20,
                        textAlign: "center",
                        color: "rgba(255,255,255,0.58)",
                      }}
                    >
                      Create the first location for {selectedDepartment?.name || "this department"}
                      to start tracking inventory.
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={S.helper}>
                    {detailLoading ? "Refreshing counts..." : "Changes stay local until you save."}
                  </div>
                  {hasUnsavedChanges ? (
                    <div style={S.row}>
                      <button
                        type="button"
                        onClick={resetDrafts}
                        style={S.button("ghost", stockSaving)}
                        disabled={stockSaving}
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={saveStockChanges}
                        style={S.button("primary", stockSaving || !canWriteInventory)}
                        disabled={stockSaving || !canWriteInventory}
                      >
                        Save Changes
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {itemModalMode ? (
        <InventoryModal
          title={itemModalMode === "create" ? "Create Item" : "Edit Item"}
          subtitle={
            itemModalMode === "create"
              ? "Create a unique item in the selected department."
              : "Update the item details without affecting its history."
          }
          onClose={() => setItemModalMode("")}
          width={620}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "112px minmax(0, 1fr)", gap: 16 }}>
              <div
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: itemForm.photoUrl
                    ? `center / cover no-repeat url("${itemForm.photoUrl}")`
                    : "linear-gradient(135deg, rgba(61,92,143,0.28) 0%, rgba(121,180,255,0.12) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {!itemForm.photoUrl ? (
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.28)",
                    }}
                  >
                    {String(itemForm.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <Field label="Item Name">
                  <input
                    value={itemForm.name}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, name: event.target.value }))
                    }
                    style={S.input}
                    placeholder="Fake Apples"
                  />
                </Field>

                <div style={S.row}>
                  <button
                    type="button"
                    onClick={() => itemPhotoInputRef.current?.click()}
                    style={S.button("ghost", itemSaving)}
                    disabled={itemSaving}
                  >
                    {itemForm.photoUrl ? "Replace Photo" : "Add Photo"}
                  </button>
                  {itemForm.photoUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setItemForm((current) => ({ ...current, photoUrl: "" }))
                      }
                      style={S.button("ghost", itemSaving)}
                      disabled={itemSaving}
                    >
                      Remove Photo
                    </button>
                  ) : null}
                  <input
                    ref={itemPhotoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (event) => {
                      const input = event.currentTarget;
                      const file = input.files?.[0] || null;
                      if (!file) return;
                      try {
                        const dataUrl = await fileToDataUrl(file);
                        setItemForm((current) => ({ ...current, photoUrl: dataUrl }));
                      } catch (photoError) {
                        setError(getErrorMessage(photoError));
                      } finally {
                        input.value = "";
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 16 }}>
              <Field label="Low Stock Threshold" helper="Optional. Low stock triggers when total inventory is at or below this value.">
                <input
                  type="number"
                  min={0}
                  value={itemForm.lowStockThreshold}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      lowStockThreshold: clampQuantity(event.target.value),
                    }))
                  }
                  style={S.input}
                  placeholder="0"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  value={itemForm.notes}
                  onChange={(event) =>
                    setItemForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  style={{
                    ...S.input,
                    minHeight: 112,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                  placeholder="Optional details for non-technical users."
                />
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setItemModalMode("")}
                style={S.button("ghost", itemSaving)}
                disabled={itemSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveItem}
                style={S.button("primary", itemSaving || !canWriteInventory)}
                disabled={itemSaving || !canWriteInventory}
              >
                {itemModalMode === "create" ? "Create Item" : "Save Item"}
              </button>
            </div>
          </div>
        </InventoryModal>
      ) : null}

      {locationModalMode ? (
        <InventoryModal
          title={locationModalMode === "edit" ? "Edit Location" : "Create Location"}
          subtitle={
            locationModalMode === "edit"
              ? "Rename this location or update its notes. Duplicate names are blocked."
              : "Locations are shared across the selected department."
          }
          onClose={() => {
            setLocationModalMode("");
            setEditingLocationId("");
          }}
          width={520}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Location Name">
              <input
                value={locationForm.name}
                onChange={(event) =>
                  setLocationForm((current) => ({ ...current, name: event.target.value }))
                }
                style={S.input}
                placeholder="Prop Shop"
              />
            </Field>
            <Field label="Notes">
              <textarea
                value={locationForm.notes}
                onChange={(event) =>
                  setLocationForm((current) => ({ ...current, notes: event.target.value }))
                }
                style={{
                  ...S.input,
                  minHeight: 96,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                placeholder="Optional notes for the team."
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setLocationModalMode("");
                  setEditingLocationId("");
                }}
                style={S.button("ghost", locationSaving)}
                disabled={locationSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveLocation}
                style={S.button("primary", locationSaving || !canWriteInventory)}
                disabled={locationSaving || !canWriteInventory}
              >
                {locationModalMode === "edit" ? "Save Location" : "Create Location"}
              </button>
            </div>
          </div>
        </InventoryModal>
      ) : null}

      {manageLocationsOpen ? (
        <InventoryModal
          title="Location Management"
          subtitle="Delete only empty locations. Any location with inventory is protected."
          onClose={() => setManageLocationsOpen(false)}
          width={620}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={S.helper}>
                {locations.length} location{locations.length === 1 ? "" : "s"} in{" "}
                {selectedDepartment?.name || "this department"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setManageLocationsOpen(false);
                  openLocationCreator();
                }}
                style={S.button("ghost", !canWriteInventory)}
                disabled={!canWriteInventory}
              >
                Add Location
              </button>
            </div>
            <div style={{ display: "grid", gap: 10, maxHeight: 420, overflowY: "auto" }}>
              {locations.map((location) => (
                <div
                  key={location.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{location.name}</div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        lineHeight: 1.4,
                        color: "rgba(255,255,255,0.54)",
                      }}
                    >
                      {location.notes || "No notes"}
                    </div>
                  </div>
                  <div style={{ ...S.row, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => openLocationEditor(location)}
                      style={S.button(
                        "ghost",
                        locationDeletingId === location.id || !canWriteInventory
                      )}
                      disabled={locationDeletingId === location.id || !canWriteInventory}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLocation(location)}
                      style={S.button(
                        "danger",
                        locationDeletingId === location.id || !canWriteInventory
                      )}
                      disabled={locationDeletingId === location.id || !canWriteInventory}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </InventoryModal>
      ) : null}

      {historyOpen ? (
        <InventoryModal
          title="Inventory History"
          subtitle="Recent inventory activity for this department. Showing the 500 most recent events."
          onClose={() => setHistoryOpen(false)}
          width={1040}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "180px minmax(0, 1fr) minmax(0, 1fr)",
                gap: 10,
              }}
            >
              <Field label="Event Type">
                <select
                  value={historyEventFilter}
                  onChange={(event) => setHistoryEventFilter(event.target.value)}
                  style={{ ...S.select, width: "100%" }}
                >
                  {INVENTORY_HISTORY_EVENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={{ color: "#111" }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Item">
                <select
                  value={historyItemFilter}
                  onChange={(event) => setHistoryItemFilter(event.target.value)}
                  style={{ ...S.select, width: "100%" }}
                >
                  <option value="ALL" style={{ color: "#111" }}>
                    All Items
                  </option>
                  {itemSummaries
                    .slice()
                    .sort((a, b) => compareText(a.name, b.name))
                    .map((item) => (
                      <option key={item.id} value={item.id} style={{ color: "#111" }}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Location">
                <select
                  value={historyLocationFilter}
                  onChange={(event) => setHistoryLocationFilter(event.target.value)}
                  style={{ ...S.select, width: "100%" }}
                >
                  <option value="ALL" style={{ color: "#111" }}>
                    All Locations
                  </option>
                  {locations
                    .slice()
                    .sort((a, b) => compareText(a.name, b.name))
                    .map((location) => (
                      <option key={location.id} value={location.id} style={{ color: "#111" }}>
                        {location.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>

            {historyError ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,59,48,0.22)",
                  background: "rgba(255,59,48,0.08)",
                  color: "rgba(255,220,218,0.95)",
                  whiteSpace: "pre-line",
                }}
              >
                {historyError}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={S.helper}>
                {historyLoading
                  ? "Loading recent inventory history..."
                  : `${filteredHistoryRows.length} visible event${
                      filteredHistoryRows.length === 1 ? "" : "s"
                    }`}
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadHistoryRows(selectedDepartmentId);
                }}
                style={S.button("ghost", historyLoading)}
                disabled={historyLoading}
              >
                Refresh
              </button>
            </div>

            <div
              style={{
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                overflow: "hidden",
                background: "rgba(0,0,0,0.18)",
                maxHeight: "60vh",
                overflowY: "auto",
              }}
            >
              <table style={{ ...S.table, minWidth: 920 }}>
                <thead style={S.thead}>
                  <tr>
                    <th style={S.th}>When</th>
                    <th style={S.th}>Event</th>
                    <th style={S.th}>Item</th>
                    <th style={S.th}>Location</th>
                    <th style={S.th}>Change</th>
                    <th style={S.th}>New Qty</th>
                    <th style={S.th}>By</th>
                  </tr>
                </thead>
                <tbody>
                  {!historyLoading && !filteredHistoryRows.length ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          ...S.td,
                          textAlign: "center",
                          color: "rgba(255,255,255,0.58)",
                          padding: "24px 16px",
                        }}
                      >
                        No history events match the current filters.
                      </td>
                    </tr>
                  ) : null}

                  {filteredHistoryRows.map((row) => {
                    const deltaValue = Number(row.delta || 0);
                    const itemLabel = row.item_id
                      ? itemNameById.get(String(row.item_id)) || "Archived Item"
                      : row.event_type === "item_deleted"
                        ? "Deleted item"
                        : "—";
                    const locationLabel = row.location_id
                      ? locationNameById.get(String(row.location_id)) || "Archived Location"
                      : row.event_type === "location_deleted"
                        ? "Deleted location"
                        : "—";
                    const actorLabel = row.actor_id
                      ? historyActorNameById.get(String(row.actor_id)) || String(row.actor_id)
                      : "Unknown";
                    return (
                      <tr key={row.id}>
                        <td style={S.td}>{formatDateTime(row.created_at)}</td>
                        <td style={S.td}>
                          <div style={S.badge(getInventoryEventTone(row.event_type))}>
                            {getInventoryEventLabel(row.event_type)}
                          </div>
                        </td>
                        <td style={S.td}>{itemLabel}</td>
                        <td style={S.td}>{locationLabel}</td>
                        <td
                          style={{
                            ...S.td,
                            color:
                              deltaValue > 0
                                ? "rgba(214,255,226,0.95)"
                                : deltaValue < 0
                                  ? "rgba(255,220,180,0.95)"
                                  : "rgba(255,255,255,0.80)",
                            fontWeight: 800,
                          }}
                        >
                          {deltaValue === 0 ? "—" : deltaValue > 0 ? `+${deltaValue}` : deltaValue}
                        </td>
                        <td style={S.td}>
                          {row.new_quantity == null ? "—" : Number(row.new_quantity)}
                        </td>
                        <td style={S.td}>{actorLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </InventoryModal>
      ) : null}

      {moveOpen && selectedItem ? (
        <InventoryModal
          title="Move Item"
          subtitle={`Move ${selectedItem.name} between ${selectedDepartment?.name || "department"} locations.`}
          onClose={() => setMoveOpen(false)}
          width={540}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="From Location">
              <select
                value={moveForm.fromLocationId}
                onChange={(event) =>
                  setMoveForm((current) => ({
                    ...current,
                    fromLocationId: event.target.value,
                    toLocationId:
                      current.toLocationId === event.target.value
                        ? locations.find((location) => location.id !== event.target.value)?.id ||
                          current.toLocationId
                        : current.toLocationId,
                  }))
                }
                style={{ ...S.select, width: "100%" }}
              >
                {locations.map((location) => {
                  const available = Number(stockByLocation.get(location.id)?.quantity || 0);
                  return (
                    <option key={location.id} value={location.id} style={{ color: "#111" }}>
                      {location.name} ({available} available)
                    </option>
                  );
                })}
              </select>
            </Field>

            <Field label="To Location">
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 }}>
                <select
                  value={moveForm.toLocationId}
                  onChange={(event) =>
                    setMoveForm((current) => ({ ...current, toLocationId: event.target.value }))
                  }
                  style={{ ...S.select, width: "100%" }}
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id} style={{ color: "#111" }}>
                      {location.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={openLocationCreator} style={S.button("ghost")}>
                  New Location
                </button>
              </div>
            </Field>

            <Field label="Quantity">
              <input
                type="number"
                min={1}
                value={moveForm.quantity}
                onChange={(event) =>
                  setMoveForm((current) => ({
                    ...current,
                    quantity: String(Math.max(1, parseQuantity(event.target.value))),
                  }))
                }
                style={S.input}
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setMoveOpen(false)}
                style={S.button("ghost", moveSaving)}
                disabled={moveSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMove}
                style={S.button("primary", moveSaving || !canWriteInventory)}
                disabled={moveSaving || !canWriteInventory}
              >
                Move Inventory
              </button>
            </div>
          </div>
        </InventoryModal>
      ) : null}

      {deleteItemOpen && selectedItem ? (
        <InventoryModal
          title="Delete Item"
          subtitle="Inventory history remains, but the item and its stock rows are deleted."
          onClose={() => setDeleteItemOpen(false)}
          width={520}
        >
          <div style={{ lineHeight: 1.6, color: "rgba(255,255,255,0.74)" }}>
            Are you sure you want to delete <strong>"{selectedItem.name}"</strong>?
            <br />
            This action cannot be undone.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setDeleteItemOpen(false)}
              style={S.button("ghost", deleteItemBusy)}
              disabled={deleteItemBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteItem}
              style={S.button("danger", deleteItemBusy || !canWriteInventory)}
              disabled={deleteItemBusy || !canWriteInventory}
            >
              Delete Item
            </button>
          </div>
        </InventoryModal>
      ) : null}

      {pendingNavigation ? (
        <InventoryModal
          title="Unsaved Inventory Changes"
          subtitle="You have unsaved inventory changes."
          onClose={() => setPendingNavigation(null)}
          width={520}
        >
          <div style={{ lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
            Save your quantity edits before leaving this item, discard them, or stay here and keep
            editing.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setPendingNavigation(null)}
              style={S.button("ghost", navigationBusy)}
              disabled={navigationBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={discardPendingNavigation}
              style={S.button("ghost", navigationBusy)}
              disabled={navigationBusy}
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={confirmPendingNavigationSave}
              style={S.button("primary", navigationBusy)}
              disabled={navigationBusy}
            >
              Save Changes
            </button>
          </div>
        </InventoryModal>
      ) : null}

      {toast ? (
        <div
          style={{
            position: "fixed",
            right: 22,
            bottom: 22,
            zIndex: 140,
            padding: "12px 14px",
            borderRadius: 14,
            border:
              toast.tone === "good"
                ? "1px solid rgba(52,199,89,0.28)"
                : toast.tone === "bad"
                  ? "1px solid rgba(255,59,48,0.26)"
                  : toast.tone === "warn"
                    ? "1px solid rgba(255,204,0,0.26)"
                    : "1px solid rgba(0,122,255,0.24)",
            background:
              toast.tone === "good"
                ? "rgba(16,42,28,0.96)"
                : toast.tone === "bad"
                  ? "rgba(48,19,19,0.96)"
                  : toast.tone === "warn"
                    ? "rgba(48,34,10,0.96)"
                    : "rgba(16,24,42,0.96)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
            color: "rgba(255,255,255,0.94)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {toast.message}
        </div>
      ) : null}
    </>
  );
}
