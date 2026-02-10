export function normalizeHex(hex?: string | null): string {
  const s = String(hex ?? "").trim();
  if (!s) return "";
  const m = s.match(/^#?[0-9a-f]{6}$/i);
  if (!m) return "";
  return s.startsWith("#") ? s.toUpperCase() : `#${s.toUpperCase()}`;
}

export function hexToRgba(hex?: string | null, alpha = 0.6): string {
  const h = normalizeHex(hex);
  if (!h) return "";
  const n = parseInt(h.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function tintFromHex(hex?: string | null, alpha = 0.18): string {
  return hexToRgba(hex, alpha) || `rgba(142,142,147,${alpha})`;
}

export type TrackGlow = {
  bg: string;
  border: string;
  shadow: string;
  inset: string;
};

export function trackGlowFromHex(hex?: string | null): TrackGlow | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    bg: hexToRgba(normalized, 0.18),
    border: hexToRgba(normalized, 0.45),
    shadow: hexToRgba(normalized, 0.35),
    inset: hexToRgba(normalized, 0.28),
  };
}
