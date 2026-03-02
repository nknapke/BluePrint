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
  wide?: boolean;
  secondaryTabs?: { value: string; label: string }[];
  activeSecondaryTab?: string;
  setActiveSecondaryTab?: (value: string) => void;
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
const LOCATION_SELECT_STYLE: CSSProperties = {
  height: 48,
  borderRadius: 14,
  padding: "0 14px",
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
  wide = false,
  secondaryTabs = [],
  activeSecondaryTab = "",
  setActiveSecondaryTab,
}: Props) {
  const headerRowStyle: CSSProperties = wide
    ? {
        ...S.headerRow,
        justifyContent: "flex-start",
        alignItems: "center",
        gap: 12,
      }
    : S.headerRow;
  const tabsBarStyle: CSSProperties = wide
    ? {
        ...S.pillBar,
        flex: "1 1 720px",
        marginLeft: "auto",
        justifyContent: "space-between",
        maxWidth: 1020,
      }
    : S.pillBar;
  const hasSecondaryTabs =
    secondaryTabs.length > 1 && typeof setActiveSecondaryTab === "function";
  const secondaryRowStyle: CSSProperties = wide
    ? {
        display: "flex",
        justifyContent: "flex-end",
        marginTop: 8,
      }
    : {
        display: "flex",
        justifyContent: "center",
        marginTop: 8,
      };
  const secondaryBarStyle: CSSProperties = wide
    ? {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 3,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.035)",
        boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
        flex: "0 1 auto",
        maxWidth: 1020,
        width: "min(100%, 1020px)",
        overflowX: "auto",
        justifyContent: "flex-start",
      }
    : {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 3,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.035)",
        boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
        overflowX: "auto",
        justifyContent: "flex-start",
      };
  const secondaryTabPillStyle = (active: boolean): CSSProperties => ({
    padding: "6px 10px",
    borderRadius: 10,
    border: active
      ? "1px solid rgba(76,146,255,0.26)"
      : "1px solid transparent",
    background: active
      ? "linear-gradient(180deg, rgba(0,122,255,0.14) 0%, rgba(255,255,255,0.04) 100%)"
      : "transparent",
    color: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.66)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease, transform 120ms ease",
  });

  return (
    <div style={S.topBar} data-app-topbar="true">
      <div style={headerRowStyle}>
        <div style={S.titleBlock}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div style={LOGO_WRAPPER_STYLE} title="BluePrint">
              <img
                src={blueprintIcon}
                alt="BluePrint"
                style={LOGO_IMAGE_STYLE}
              />
            </div>
            {lastUpdatedLabel ? (
              <div style={{ ...LAST_UPDATED_STYLE, textAlign: "center" }}>
                {lastUpdatedLabel}
              </div>
            ) : null}
          </div>
        </div>

        <div style={LOCATION_ROW_STYLE}>
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
        </div>

        <div style={tabsBarStyle}>
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

      {hasSecondaryTabs ? (
        <div style={secondaryRowStyle}>
          <div style={secondaryBarStyle}>
            {secondaryTabs.map((t) => (
              <div
                key={t.value}
                style={secondaryTabPillStyle(activeSecondaryTab === t.value)}
                onClick={() => setActiveSecondaryTab?.(t.value)}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "scale(0.98)";
                  setTimeout(() => {
                    if (e.currentTarget)
                      e.currentTarget.style.transform = "scale(1)";
                  }, 120);
                }}
                title={t.label}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
