export const REFRESH_MS = 10000;

export const TABS = [
  "crew",
  "trackDefs",
  "trainingHub",
  "signoffs",
  "records",
  "planner",
] as const;

export const DEPARTMENTS = [
  "Automation",
  "Carpentry",
  "Video",
  "Props",
  "Lighting",
  "Wardrobe",
  "Audio",
  "Stage Management",
  "Production Management",
  "Front of House",
  "Upper Management",
] as const;

export const LOCATION_SCOPED_CACHE_KEYS = [
  "/rest/v1/crew_roster",
  "/rest/v1/track_definitions",
  "/rest/v1/training_definitions",
  "/rest/v1/training_groups",
  "/rest/v1/track_training_requirements",
  "/rest/v1/crew_track_signoffs",
  "/rest/v1/crew_training_records",
  "/rest/v1/v_training_dashboard_with_signer",
  "/rest/v1/crew_training_record_history",
] as const;

export type TabId = (typeof TABS)[number];
export type Dept = (typeof DEPARTMENTS)[number] | "";
export type YesNo = "TRUE" | "FALSE";
export type ReqViewMode = "training" | "track";
export type ExpiryMode = "NEVER" | "WEEKS";
