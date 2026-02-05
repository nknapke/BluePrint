// src/context/LocationContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LocationContextValue = {
  activeLocationId: number | null;
  setActiveLocationId: React.Dispatch<React.SetStateAction<number | null>>;
  cacheTag: string;
  withLoc: (path: string) => string;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [activeLocationId, setActiveLocationId] = useState<number | null>(() => {
    const raw = localStorage.getItem("blueprint_location_id");
    return raw ? Number(raw) : null;
  });

  // Keep localStorage in sync (so refresh keeps same location)
  useEffect(() => {
    if (!activeLocationId) return;
    localStorage.setItem("blueprint_location_id", String(activeLocationId));
  }, [activeLocationId]);

  const cacheTag = useMemo(
    () => `loc:${activeLocationId ?? "none"}`,
    [activeLocationId]
  );

  const withLoc = useCallback(
    (path: string) => {
      if (!activeLocationId) return path;
      const joiner = path.includes("?") ? "&" : "?";
      return `${path}${joiner}location_id=eq.${activeLocationId}`;
    },
    [activeLocationId]
  );

  const value = useMemo(
    () => ({
      activeLocationId,
      setActiveLocationId,
      cacheTag,
      withLoc,
    }),
    [activeLocationId, cacheTag, withLoc]
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation must be used inside <LocationProvider>.");
  }
  return ctx;
}
