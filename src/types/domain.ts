export type Location = {
  id: number;
  code?: string;
  name: string;
  active?: boolean;
};

export type Crew = {
  id: number;
  name: string;
  dept: string;
  active: boolean;
  statusRaw: string;
};

export type Department = {
  id: number | null;
  name: string;
  active: boolean;
};

export type Track = {
  id: number;
  localId: number | null;
  name: string;
  active: boolean;
  showCritical: boolean;
  color: string;
};

export type TrainingGroup = {
  id: number;
  localId: number | null;
  name: string;
  active: boolean;
  sortOrder?: number | null;
  color: string;
  description: string;
};

export type Training = {
  id: number;
  localId: number | null;
  name: string;
  active: boolean;
  expiresAfterWeeks: number | null;
  trainingGroupId: number | null;
};

export type Requirement = {
  id: number;
  trackId: number;
  trainingId: number;
  active: boolean | null;
};

export type Signoff = {
  id: number;
  crewId: number;
  trackId: number;
  status: string;
  active: boolean | null;
};

export type TrainingRecord = {
  id: number;
  locationId?: number | null;
  crewId: number;
  trackId: number;
  trainingId: number;
  active: boolean;
  lastCompleted?: string | null;
  status?: string | null;
  dueDate?: string | null;
  daysUntilDue?: number | null;
  daysOverdue?: number | null;
  crewName?: string | null;
  homeDepartment?: string | null;
  trackName?: string | null;
  trainingName?: string | null;
  lastSignedOffBy?: string | null;
  lastSignedOffOn?: string | null;
};
