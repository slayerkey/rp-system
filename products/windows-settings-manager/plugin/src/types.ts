export type Flavor = "lite" | "pro";
export type Topology = "internal" | "clone" | "extend" | "external" | "unknown";
export type ModeId = "gaming" | "work" | "night" | "present" | "movie" | string;

export type HdrState = {
  available: boolean;
  api: "hdr-state" | "advanced-color-legacy" | "unavailable";
  supportedCount: number;
  enabledCount: number;
  mixed: boolean;
};

export type TimeoutState = {
  monitorAcSeconds: number;
  monitorDcSeconds: number;
  sleepAcSeconds: number;
  sleepDcSeconds: number;
};

export type PowerPlan = {
  guid: string;
  name: string;
  active: boolean;
};

export type SystemSnapshot = {
  backendOnline: boolean;
  capturedAt: string;
  osBuild?: number;
  hdr: HdrState;
  topology: Topology;
  powerPlanGuid?: string;
  powerPlanName?: string;
  powerPlans: PowerPlan[];
  timeout?: TimeoutState;
  keepAwake: boolean;
  errors: string[];
};

export type ModeSettings = {
  hdr?: boolean;
  topology?: Exclude<Topology, "unknown">;
  powerPlanGuid?: string;
  timeout?: TimeoutState;
  keepAwake?: boolean;
};

export type ModeDefinition = {
  id: ModeId;
  name: string;
  settings: ModeSettings;
};

export type GlobalSettings = {
  schemaVersion: 1;
  modes: ModeDefinition[];
};

export type ApplyStatus = "COMPLETE" | "PARTIAL" | "FAILED";

export type ApplyStep = {
  key: keyof ModeSettings;
  label: string;
  status: ApplyStatus;
  ok: boolean;
  error?: string;
};

export type ApplyResult = {
  status: ApplyStatus;
  modeId: string;
  modeName: string;
  steps: ApplyStep[];
};

export type BackendReply<T = unknown> = {
  ok: boolean;
  result?: T;
  error?: string;
};
