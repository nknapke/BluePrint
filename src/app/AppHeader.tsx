import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
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
  placeholderSettingEnabled: boolean;
  setPlaceholderSettingEnabled: Dispatch<SetStateAction<boolean>>;
  onImportShowCalendarPdf: (file: File) => Promise<void> | void;
  showCalendarImporting: boolean;
  showCalendarImportMessage: string;
  showCalendarImportError: string;
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
const SETTINGS_WRAPPER_STYLE: CSSProperties = {
  position: "relative",
  flex: "0 0 auto",
};
const SETTINGS_BUTTON_STYLE = (active: boolean): CSSProperties => ({
  width: 44,
  height: 44,
  borderRadius: 14,
  border: active
    ? "1px solid rgba(76,146,255,0.28)"
    : "1px solid rgba(255,255,255,0.10)",
  background: active
    ? "linear-gradient(180deg, rgba(0,122,255,0.18) 0%, rgba(255,255,255,0.08) 100%)"
    : "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.9)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: active
    ? "0 10px 20px rgba(0,0,0,0.18)"
    : "0 8px 18px rgba(0,0,0,0.12)",
  transition:
    "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease",
});
const SETTINGS_POPOVER_STYLE: CSSProperties = {
  position: "absolute",
  top: 54,
  right: 0,
  width: 320,
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(180deg, rgba(20,24,34,0.98) 0%, rgba(12,15,24,0.98) 100%)",
  boxShadow: "0 20px 40px rgba(0,0,0,0.28)",
  zIndex: 40,
  backdropFilter: "blur(18px)",
};
const SETTINGS_TITLE_STYLE: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.04em",
  color: "rgba(255,255,255,0.94)",
};
const SETTINGS_SUBTITLE_STYLE: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  lineHeight: 1.4,
  color: "rgba(255,255,255,0.58)",
};
const SETTINGS_OPTION_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginTop: 14,
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.04)",
  cursor: "pointer",
};
const SETTINGS_OPTION_TITLE_STYLE: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(255,255,255,0.9)",
};
const SETTINGS_OPTION_HELP_STYLE: CSSProperties = {
  marginTop: 3,
  fontSize: 11,
  lineHeight: 1.35,
  color: "rgba(255,255,255,0.55)",
};
const SETTINGS_CHECKBOX_STYLE: CSSProperties = {
  width: 16,
  height: 16,
  accentColor: "#007aff",
  cursor: "pointer",
};
const SETTINGS_ACTION_STYLE = (disabled: boolean): CSSProperties => ({
  width: "100%",
  marginTop: 14,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(76,146,255,0.22)",
  background: disabled
    ? "rgba(255,255,255,0.05)"
    : "linear-gradient(180deg, rgba(0,122,255,0.18) 0%, rgba(255,255,255,0.05) 100%)",
  color: disabled ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.92)",
  fontSize: 12,
  fontWeight: 700,
  textAlign: "left",
  cursor: disabled ? "default" : "pointer",
});
const SETTINGS_STATUS_STYLE = (tone: "neutral" | "error"): CSSProperties => ({
  marginTop: 10,
  fontSize: 11,
  lineHeight: 1.4,
  color:
    tone === "error"
      ? "rgba(255,140,140,0.92)"
      : "rgba(255,255,255,0.62)",
});

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
  placeholderSettingEnabled,
  setPlaceholderSettingEnabled,
  onImportShowCalendarPdf,
  showCalendarImporting,
  showCalendarImportMessage,
  showCalendarImportError,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const showCalendarInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (!settingsOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (!settingsRef.current) return;
      const target = event.target;
      if (target instanceof Node && !settingsRef.current.contains(target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    setSettingsOpen(false);
  }, [activeTab, activeLocationId]);

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

        <div style={SETTINGS_WRAPPER_STYLE} ref={settingsRef}>
          <button
            type="button"
            style={SETTINGS_BUTTON_STYLE(settingsOpen)}
            onClick={() => setSettingsOpen((prev) => !prev)}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.98)";
              setTimeout(() => {
                if (e.currentTarget) e.currentTarget.style.transform = "scale(1)";
              }, 120);
            }}
            aria-label="Open app settings"
            title="App settings"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3.25" />
              <path d="M12 2.75v2.1" />
              <path d="M12 19.15v2.1" />
              <path d="M21.25 12h-2.1" />
              <path d="M4.85 12h-2.1" />
              <path d="m18.54 5.46-1.48 1.48" />
              <path d="m6.94 17.06-1.48 1.48" />
              <path d="m18.54 18.54-1.48-1.48" />
              <path d="M6.94 6.94 5.46 5.46" />
            </svg>
          </button>

          {settingsOpen ? (
            <div style={SETTINGS_POPOVER_STYLE}>
              <div style={SETTINGS_TITLE_STYLE}>App Settings</div>
              <div style={SETTINGS_SUBTITLE_STYLE}>
                Placeholder space for global BluePrint options.
              </div>

              <label style={SETTINGS_OPTION_STYLE}>
                <div>
                  <div style={SETTINGS_OPTION_TITLE_STYLE}>Placeholder setting</div>
                  <div style={SETTINGS_OPTION_HELP_STYLE}>
                    Stored app-wide. No behavior is attached yet.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={placeholderSettingEnabled}
                  onChange={(e) =>
                    setPlaceholderSettingEnabled(e.currentTarget.checked)
                  }
                  style={SETTINGS_CHECKBOX_STYLE}
                />
              </label>

              <button
                type="button"
                style={SETTINGS_ACTION_STYLE(showCalendarImporting || !activeLocationId)}
                disabled={showCalendarImporting || !activeLocationId}
                onClick={() => {
                  if (!showCalendarInputRef.current) return;
                  showCalendarInputRef.current.value = "";
                  showCalendarInputRef.current.click();
                }}
              >
                {showCalendarImporting
                  ? "Importing show calendar PDF..."
                  : "Import Annual Show Calendar PDF"}
              </button>
              <div style={SETTINGS_OPTION_HELP_STYLE}>
                Upload the annual performance calendar PDF to sync show times and
                DARK days for the active location.
              </div>
              <input
                ref={showCalendarInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const file = input.files?.[0];
                  if (!file) return;
                  await onImportShowCalendarPdf(file);
                  input.value = "";
                }}
              />
              {showCalendarImportError ? (
                <div style={SETTINGS_STATUS_STYLE("error")}>
                  {showCalendarImportError}
                </div>
              ) : showCalendarImportMessage ? (
                <div style={SETTINGS_STATUS_STYLE("neutral")}>
                  {showCalendarImportMessage}
                </div>
              ) : null}
            </div>
          ) : null}
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
