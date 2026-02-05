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
