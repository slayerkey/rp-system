import type {
  ApplyResult,
  ApplyStep,
  BackendReply,
  ModeDefinition,
  ModeSettings,
  SystemSnapshot,
  TimeoutState
} from "./types.js";

export const DEFAULT_MODES: ModeDefinition[] = [
  { id: "gaming", name: "GAMING", settings: {} },
  { id: "work", name: "WORK", settings: {} },
  { id: "night", name: "NIGHT", settings: {} },
  { id: "present", name: "PRESENT", settings: {} },
  { id: "movie", name: "MOVIE", settings: {} }
];

export function hasConfiguredSettings(mode: ModeDefinition): boolean {
  return Object.keys(mode.settings ?? {}).length > 0;
}

export function modeMatchesSnapshot(mode: ModeDefinition, snapshot: SystemSnapshot): boolean {
  const settings = mode.settings ?? {};
  if (!hasConfiguredSettings(mode) || !snapshot.backendOnline) return false;

  if (typeof settings.hdr === "boolean") {
    if (!snapshot.hdr.available || snapshot.hdr.mixed) return false;
    const enabled = snapshot.hdr.supportedCount > 0 && snapshot.hdr.enabledCount === snapshot.hdr.supportedCount;
    if (enabled !== settings.hdr) return false;
  }
  if (settings.topology && snapshot.topology !== settings.topology) return false;
  if (settings.powerPlanGuid && snapshot.powerPlanGuid?.toLowerCase() !== settings.powerPlanGuid.toLowerCase()) return false;
  if (settings.timeout && !timeoutEquals(settings.timeout, snapshot.timeout)) return false;
  if (typeof settings.keepAwake === "boolean" && snapshot.keepAwake !== settings.keepAwake) return false;
  return true;
}

export function matchingModes(modes: ModeDefinition[], snapshot: SystemSnapshot): ModeDefinition[] {
  return modes.filter((mode) => modeMatchesSnapshot(mode, snapshot));
}

export function captureModeSettings(snapshot: SystemSnapshot): ModeSettings {
  const captured: ModeSettings = {};
  if (snapshot.hdr.available && !snapshot.hdr.mixed && snapshot.hdr.supportedCount > 0) {
    captured.hdr = snapshot.hdr.enabledCount === snapshot.hdr.supportedCount;
  }
  if (snapshot.topology !== "unknown") captured.topology = snapshot.topology;
  if (snapshot.powerPlanGuid) captured.powerPlanGuid = snapshot.powerPlanGuid;
  if (snapshot.timeout) captured.timeout = { ...snapshot.timeout };
  captured.keepAwake = snapshot.keepAwake;
  return captured;
}

export async function applyMode(
  mode: ModeDefinition,
  execute: (op: string, args: Record<string, unknown>) => Promise<BackendReply<any>>
): Promise<ApplyResult> {
  const operations = buildOperations(mode.settings);
  const steps: ApplyStep[] = [];
  if (!operations.length) {
    return { status: "FAILED", modeId: mode.id, modeName: mode.name, steps: [] };
  }

  for (const operation of operations) {
    try {
      const reply = await execute(operation.op, operation.args);
      const reported = typeof reply.result?.status === "string" ? reply.result.status : undefined;
      const ok = reply.ok && reported !== "FAILED";
      steps.push({
        key: operation.key,
        label: operation.label,
        ok,
        error: ok ? undefined : (reply.error || reply.result?.error || "Windows did not confirm the requested state")
      });
    } catch (error) {
      steps.push({
        key: operation.key,
        label: operation.label,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const successes = steps.filter((step) => step.ok).length;
  const status = successes === steps.length ? "COMPLETE" : successes === 0 ? "FAILED" : "PARTIAL";
  return { status, modeId: mode.id, modeName: mode.name, steps };
}

function buildOperations(settings: ModeSettings) {
  const operations: Array<{
    key: keyof ModeSettings;
    label: string;
    op: string;
    args: Record<string, unknown>;
  }> = [];

  // Topology goes first so HDR is applied to the displays that will actually be active.
  if (settings.topology) operations.push({
    key: "topology", label: "Display", op: "setTopology", args: { topology: settings.topology }
  });
  if (typeof settings.hdr === "boolean") operations.push({
    key: "hdr", label: "HDR", op: "setHdr", args: { enabled: settings.hdr }
  });
  if (settings.powerPlanGuid) operations.push({
    key: "powerPlanGuid", label: "Power", op: "setPowerPlan", args: { guid: settings.powerPlanGuid }
  });
  if (settings.timeout) operations.push({
    key: "timeout", label: "Timeout", op: "setTimeout", args: { ...settings.timeout }
  });
  if (typeof settings.keepAwake === "boolean") operations.push({
    key: "keepAwake", label: "Awake", op: "setKeepAwake", args: { enabled: settings.keepAwake }
  });
  return operations;
}

function timeoutEquals(expected: TimeoutState, actual?: TimeoutState): boolean {
  if (!actual) return false;
  return expected.monitorAcSeconds === actual.monitorAcSeconds
    && expected.monitorDcSeconds === actual.monitorDcSeconds
    && expected.sleepAcSeconds === actual.sleepAcSeconds
    && expected.sleepDcSeconds === actual.sleepDcSeconds;
}
