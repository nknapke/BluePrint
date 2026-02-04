// src/context/LocationContext.js
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [activeLocationId, setActiveLocationId] = useState(() => {
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
    (path) => {
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

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation must be used inside <LocationProvider>.");
  }
  return ctx;
}
