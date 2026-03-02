export function prettyTitle(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const spaced = raw.replace(/_/g, " ").toLowerCase();
  return spaced.replace(/\b\w/g, (m) => m.toUpperCase());
}

export function prettyDept(input: unknown, fallback = "Unassigned"): string {
  const raw = String(input ?? "").trim();
  return raw || fallback;
}

const CREW_SCHEDULE_DEPT_GROUPS = [
  {
    label: "Automation / Carpentry",
    members: ["Automation", "Carpentry"],
  },
  {
    label: "Audio / MIT",
    members: ["Audio", "MIT"],
  },
  {
    label: "Lighting / Video",
    members: ["Lighting", "Video"],
  },
];

export function getCrewScheduleDeptGroupLabel(input: unknown): string {
  const dept = prettyDept(input);
  const normalized = dept.toLowerCase();
  for (const group of CREW_SCHEDULE_DEPT_GROUPS) {
    if (group.members.some((member) => member.toLowerCase() === normalized)) {
      return group.label;
    }
  }
  return dept;
}

export function matchesCrewScheduleDeptFilter(
  input: unknown,
  selectedLabel: unknown
): boolean {
  const filter = String(selectedLabel ?? "").trim();
  if (!filter || filter === "ALL") return true;
  return getCrewScheduleDeptGroupLabel(input) === filter;
}
