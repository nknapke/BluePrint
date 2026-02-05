import { useCallback, useEffect, useState } from "react";

type Options = {
  defaultExpanded?: boolean;
};

export function useExpandableKeys<T extends string>(
  keys: T[],
  { defaultExpanded = true }: Options = {}
) {
  const [expanded, setExpanded] = useState<Set<T>>(() =>
    defaultExpanded ? new Set(keys) : new Set<T>()
  );
  const [userTouched, setUserTouched] = useState(false);

  useEffect(() => {
    setExpanded((prev) => {
      if (!userTouched) return new Set(keys);

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

  const toggle = useCallback((key: T) => {
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
