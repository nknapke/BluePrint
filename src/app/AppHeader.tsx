import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { TabId } from "./constants";

type LocationRow = {
  id: number;
  name: string;
};

type Props = {
  S: any;
  blueprintIcon: string;
  activeLocationId: number | null;
  setActiveLocationId: (id: number) => void;
  locations: LocationRow[];
  locationsLoading: boolean;
  locationsError: string;
  lastUpdatedLabel?: string;
  tabs: readonly TabId[];
  activeTab: TabId;
  setActiveTab: Dispatch<SetStateAction<TabId>>;
  tabLabel: (key: TabId) => string;
};

const LOGO_WRAPPER_STYLE: CSSProperties = {
  height: 68,
  padding: "0 14px",
  borderRadius: 14,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.54) 100%)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow:
    "0 3px 8px rgba(0,0,0,0.20), inset 0 -1px 0 rgba(255,255,255,0.0)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  flexShrink: 0,
};

const LOGO_IMAGE_STYLE: CSSProperties = {
  height: 54,
  maxWidth: 190,
  objectFit: "contain",
  display: "block",
};

const LOCATION_ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};
const LOCATION_LABEL_STYLE: CSSProperties = { opacity: 0.85, fontSize: 13 };
const LOCATION_SELECT_STYLE: CSSProperties = {
  height: 36,
  borderRadius: 10,
  padding: "0 10px",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
  outline: "none",
};
const LOCATION_ERROR_STYLE: CSSProperties = {
  color: "rgba(255,120,120,0.95)",
  fontSize: 12,
};
const LAST_UPDATED_STYLE: CSSProperties = { opacity: 0.6, fontSize: 11 };

export function AppHeader({
  S,
  blueprintIcon,
  activeLocationId,
  setActiveLocationId,
  locations,
  locationsLoading,
  locationsError,
  lastUpdatedLabel,
  tabs,
  activeTab,
  setActiveTab,
  tabLabel,
}: Props) {
  return (
    <div style={S.topBar}>
      <div style={S.headerRow}>
        <div style={S.titleBlock}>
          <div
            style={LOGO_WRAPPER_STYLE}
            title="BluePrint"
          >
            <img
              src={blueprintIcon}
              alt="BluePrint"
              style={LOGO_IMAGE_STYLE}
            />
          </div>
        </div>

        <div style={LOCATION_ROW_STYLE}>
          <div style={LOCATION_LABEL_STYLE}>Location</div>

          <select
            value={activeLocationId ?? ""}
            onChange={(e) => setActiveLocationId(Number(e.target.value))}
            disabled={locationsLoading || !locations.length}
            style={LOCATION_SELECT_STYLE}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id} style={{ color: "black" }}>
                {l.name}
              </option>
            ))}
          </select>

          {!!locationsError && (
            <div style={LOCATION_ERROR_STYLE}>{locationsError}</div>
          )}
          {lastUpdatedLabel ? (
            <div style={LAST_UPDATED_STYLE}>{lastUpdatedLabel}</div>
          ) : null}
        </div>

        <div style={S.pillBar}>
          {tabs.map((t) => (
            <div
              key={t}
              style={S.tabPill(activeTab === t)}
              onClick={() => setActiveTab(t)}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.98)";
                setTimeout(() => {
                  if (e.currentTarget)
                    e.currentTarget.style.transform = "scale(1)";
                }, 120);
              }}
              title={tabLabel(t)}
            >
              {tabLabel(t)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
