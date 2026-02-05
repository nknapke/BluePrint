import type { Dispatch, SetStateAction } from "react";
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
  tabs: readonly TabId[];
  activeTab: TabId;
  setActiveTab: Dispatch<SetStateAction<TabId>>;
  tabLabel: (key: TabId) => string;
};

export function AppHeader({
  S,
  blueprintIcon,
  activeLocationId,
  setActiveLocationId,
  locations,
  locationsLoading,
  locationsError,
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
            style={{
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
            }}
            title="BluePrint"
          >
            <img
              src={blueprintIcon}
              alt="BluePrint"
              style={{
                height: 54,
                maxWidth: 190,
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ opacity: 0.85, fontSize: 13 }}>Location</div>

          <select
            value={activeLocationId ?? ""}
            onChange={(e) => setActiveLocationId(Number(e.target.value))}
            disabled={locationsLoading || !locations.length}
            style={{
              height: 36,
              borderRadius: 10,
              padding: "0 10px",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.12)",
              outline: "none",
            }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id} style={{ color: "black" }}>
                {l.name}
              </option>
            ))}
          </select>

          {!!locationsError && (
            <div style={{ color: "rgba(255,120,120,0.95)", fontSize: 12 }}>
              {locationsError}
            </div>
          )}
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
