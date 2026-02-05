export function prettyTitle(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const spaced = raw.replace(/_/g, " ").toLowerCase();
  return spaced.replace(/\b\w/g, (m) => m.toUpperCase());
}
