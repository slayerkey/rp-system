import { endpointIdentity, matchEndpoint } from "./device-matching.js";

export const SLOT_DEFS = Object.freeze([
  { key: "outputDefault", flow: "output", role: "default", snapshotId: "defaultOutputId", snapshotIds: ["defaultOutputId", "multimediaOutputId"], list: "outputs", restoreStateByDefault: true },
  { key: "outputCommunications", flow: "output", role: "communications", snapshotId: "communicationsOutputId", snapshotIds: ["communicationsOutputId"], list: "outputs", restoreStateByDefault: false },
  { key: "inputDefault", flow: "input", role: "default", snapshotId: "defaultInputId", snapshotIds: ["defaultInputId", "multimediaInputId"], list: "inputs", restoreStateByDefault: true },
  { key: "inputCommunications", flow: "input", role: "communications", snapshotId: "communicationsInputId", snapshotIds: ["communicationsInputId"], list: "inputs", restoreStateByDefault: false },
]);

function clampVolume(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : null;
}

export function emptyGlobalSettings() {
  return { schemaVersion: 1, profiles: [], lastAppliedProfileId: "" };
}

export function normalizeGlobalSettings(raw = {}) {
  const profiles = [];
  const seenIds = new Set();

  for (const source of Array.isArray(raw?.profiles) ? raw.profiles : []) {
    const profile = normalizeProfile(source);
    if (!profile || seenIds.has(profile.id)) continue;
    seenIds.add(profile.id);
    profiles.push(profile);
  }

  return {
    schemaVersion: 1,
    profiles,
    lastAppliedProfileId: profiles.some((profile) => profile.id === raw?.lastAppliedProfileId)
      ? String(raw.lastAppliedProfileId)
      : "",
  };
}

export function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const name = String(raw.name || "").trim().slice(0, 80);
  if (!id || !name) return null;

  const slots = {};
  for (const def of SLOT_DEFS) {
    const source = raw.slots?.[def.key];
    if (!source?.device) {
      slots[def.key] = null;
      continue;
    }
    slots[def.key] = {
      device: endpointIdentity(source.device),
      restoreVolume: source.restoreVolume === true,
      volume: clampVolume(source.volume),
      restoreMute: source.restoreMute === true,
      muted: source.muted === true,
    };
  }

  return {
    schemaVersion: 1,
    id,
    name,
    accent: /^#[0-9a-f]{6}$/i.test(String(raw.accent || "")) ? String(raw.accent).toUpperCase() : "#56F2A5",
    slots,
  };
}

function endpointById(snapshot, def) {
  const id = String(snapshot?.[def.snapshotId] || "");
  const list = Array.isArray(snapshot?.[def.list]) ? snapshot[def.list] : [];
  return list.find((endpoint) => String(endpoint.id || "") === id) || null;
}

export function snapshotDefaultRoleConflicts(snapshot) {
  const conflicts = [];
  const outputDefault = String(snapshot?.defaultOutputId || "");
  const outputMultimedia = String(snapshot?.multimediaOutputId || "");
  const inputDefault = String(snapshot?.defaultInputId || "");
  const inputMultimedia = String(snapshot?.multimediaInputId || "");

  if (outputDefault && outputMultimedia && outputDefault !== outputMultimedia)
    conflicts.push("Windows Console and Multimedia output defaults are currently split.");
  if (inputDefault && inputMultimedia && inputDefault !== inputMultimedia)
    conflicts.push("Windows Console and Multimedia input defaults are currently split.");

  return conflicts;
}

export function captureProfileFromSnapshot(name, snapshot, id) {
  const slots = {};
  for (const def of SLOT_DEFS) {
    const endpoint = endpointById(snapshot, def);
    if (!endpoint) {
      slots[def.key] = null;
      continue;
    }
    slots[def.key] = {
      device: endpointIdentity(endpoint),
      restoreVolume: def.restoreStateByDefault && endpoint.volumeAvailable === true,
      volume: def.restoreStateByDefault && endpoint.volumeAvailable === true ? clampVolume(endpoint.volume) : null,
      restoreMute: def.restoreStateByDefault && endpoint.muteAvailable === true,
      muted: Boolean(endpoint.muted),
    };
  }

  return normalizeProfile({
    schemaVersion: 1,
    id,
    name,
    accent: "#56F2A5",
    slots,
  });
}

function conflictKey(operation) {
  if (operation.kind === "set-volume" || operation.kind === "set-mute")
    return `${operation.kind}:${operation.endpointId}`;
  return "";
}

export function buildApplyPlan(profileInput, snapshot) {
  const profile = normalizeProfile(profileInput);
  const operations = [];
  const failures = [];
  const seenState = new Map();
  const blockedState = new Set();

  if (!profile) {
    return { profile: null, operations, failures: [{ slot: "profile", error: "Invalid Audio Profile." }] };
  }

  for (const def of SLOT_DEFS) {
    const slot = profile.slots?.[def.key];
    if (!slot?.device) continue;

    const endpoints = Array.isArray(snapshot?.[def.list]) ? snapshot[def.list] : [];
    const match = matchEndpoint(slot.device, endpoints);
    if (match.status !== "matched" || !match.endpoint) {
      failures.push({
        slot: def.key,
        error: match.reason || `Could not resolve ${slot.device.name || def.key}.`,
        matchStatus: match.status,
      });
      continue;
    }

    const endpoint = match.endpoint;
    operations.push({
      kind: "set-default",
      flow: def.flow,
      role: def.role,
      endpointId: endpoint.id,
      slot: def.key,
      label: endpoint.name,
    });

    if (slot.restoreVolume) {
      if (!endpoint.volumeAvailable || slot.volume === null) {
        failures.push({ slot: def.key, error: `Volume restore is unavailable for ${endpoint.name}.` });
      } else {
        const operation = {
          kind: "set-volume",
          endpointId: endpoint.id,
          value: clampVolume(slot.volume),
          slot: def.key,
          label: endpoint.name,
        };
        const key = conflictKey(operation);
        const prior = seenState.get(key);
        if (blockedState.has(key)) {
          // A contradictory state for this endpoint was already found. Apply neither value.
        } else if (prior && prior.value !== operation.value) {
          const priorIndex = operations.indexOf(prior);
          if (priorIndex >= 0) operations.splice(priorIndex, 1);
          seenState.delete(key);
          blockedState.add(key);
          failures.push({ slot: def.key, error: `Conflicting saved volumes target ${endpoint.name}; volume restore was skipped.` });
        } else if (!prior) {
          seenState.set(key, operation);
          operations.push(operation);
        }
      }
    }

    if (slot.restoreMute) {
      if (!endpoint.muteAvailable) {
        failures.push({ slot: def.key, error: `Mute restore is unavailable for ${endpoint.name}.` });
      } else {
        const operation = {
          kind: "set-mute",
          endpointId: endpoint.id,
          value: Boolean(slot.muted),
          slot: def.key,
          label: endpoint.name,
        };
        const key = conflictKey(operation);
        const prior = seenState.get(key);
        if (blockedState.has(key)) {
          // A contradictory state for this endpoint was already found. Apply neither value.
        } else if (prior && prior.value !== operation.value) {
          const priorIndex = operations.indexOf(prior);
          if (priorIndex >= 0) operations.splice(priorIndex, 1);
          seenState.delete(key);
          blockedState.add(key);
          failures.push({ slot: def.key, error: `Conflicting saved mute states target ${endpoint.name}; mute restore was skipped.` });
        } else if (!prior) {
          seenState.set(key, operation);
          operations.push(operation);
        }
      }
    }
  }

  if (!operations.length && !failures.length)
    failures.push({ slot: "profile", error: "This Audio Profile has no configured devices." });

  return { profile, operations, failures };
}

export function mergeApplyResult(plan, helperResponse) {
  const failures = [...(plan?.failures || [])];
  let successes = 0;
  const results = Array.isArray(helperResponse?.results) ? helperResponse.results : [];

  for (let index = 0; index < (plan?.operations || []).length; index += 1) {
    const operation = plan.operations[index];
    const result = results.find((entry) => Number(entry.index) === index);
    if (result?.ok) successes += 1;
    else failures.push({
      slot: operation.slot || "operation",
      error: String(result?.error || helperResponse?.error || "Audio operation failed."),
    });
  }

  const status = successes === 0
    ? "FAILED"
    : failures.length
      ? "PARTIAL"
      : "SUCCESS";

  return {
    status,
    successCount: successes,
    failureCount: failures.length,
    failures,
    snapshot: helperResponse?.snapshot || null,
  };
}

export function roleMatchesSnapshot(flow, role, endpointId, snapshot) {
  const wanted = String(endpointId || "");
  if (!wanted || !snapshot || snapshot.error) return false;

  const keys = flow === "output"
    ? role === "communications"
      ? ["communicationsOutputId"]
      : ["defaultOutputId", "multimediaOutputId"]
    : flow === "input"
      ? role === "communications"
        ? ["communicationsInputId"]
        : ["defaultInputId", "multimediaInputId"]
      : [];

  return keys.length > 0 && keys.every((key) => String(snapshot?.[key] || "") === wanted);
}

function snapshotEndpoint(snapshot, endpointId) {
  const wanted = String(endpointId || "");
  if (!wanted || !snapshot || snapshot.error) return null;
  const endpoints = [
    ...(Array.isArray(snapshot.outputs) ? snapshot.outputs : []),
    ...(Array.isArray(snapshot.inputs) ? snapshot.inputs : []),
  ];
  return endpoints.find((endpoint) => String(endpoint.id || "") === wanted) || null;
}

export function endpointVolumeMatches(snapshot, endpointId, value, tolerance = 1) {
  const endpoint = snapshotEndpoint(snapshot, endpointId);
  if (!endpoint?.volumeAvailable) return false;
  return Math.abs(Number(endpoint.volume) - Number(value)) <= Math.max(0, Number(tolerance) || 0);
}

export function endpointMuteMatches(snapshot, endpointId, value) {
  const endpoint = snapshotEndpoint(snapshot, endpointId);
  if (!endpoint?.muteAvailable) return false;
  return Boolean(endpoint.muted) === Boolean(value);
}

export function verifyApplyResult(profileInput, resultInput, snapshot) {
  const result = resultInput && typeof resultInput === "object"
    ? { ...resultInput, failures: [...(resultInput.failures || [])] }
    : { status: "FAILED", successCount: 0, failureCount: 1, failures: [] };

  if (result.status !== "SUCCESS") return result;

  const error = !snapshot
    ? "Applied audio operations but could not verify the final Windows audio state."
    : snapshot.error
      ? `Applied audio operations but final verification failed: ${snapshot.error}`
      : !profileMatchesSnapshot(profileInput, snapshot)
        ? "Applied audio operations but the final Windows audio state did not fully match the Audio Profile."
        : "";

  if (!error) return result;

  result.status = result.successCount > 0 ? "PARTIAL" : "FAILED";
  result.failures.push({ slot: "verification", error });
  result.failureCount = result.failures.length;
  result.snapshot = snapshot || result.snapshot || null;
  return result;
}

export function profileMatchesSnapshot(profileInput, snapshot) {
  const profile = normalizeProfile(profileInput);
  if (!profile) return false;
  let configured = 0;

  for (const def of SLOT_DEFS) {
    const slot = profile.slots?.[def.key];
    if (!slot?.device) continue;
    configured += 1;

    const endpoints = Array.isArray(snapshot?.[def.list]) ? snapshot[def.list] : [];
    const match = matchEndpoint(slot.device, endpoints);
    if (match.status !== "matched" || !match.endpoint) return false;
    const requiredRoleIds = Array.isArray(def.snapshotIds) && def.snapshotIds.length
      ? def.snapshotIds
      : [def.snapshotId];
    if (requiredRoleIds.some((key) => String(snapshot?.[key] || "") !== String(match.endpoint.id || "")))
      return false;

    if (slot.restoreVolume) {
      if (!match.endpoint.volumeAvailable || slot.volume === null) return false;
      if (Math.abs(Number(match.endpoint.volume) - Number(slot.volume)) > 1) return false;
    }
    if (slot.restoreMute) {
      if (!match.endpoint.muteAvailable) return false;
      if (Boolean(match.endpoint.muted) !== Boolean(slot.muted)) return false;
    }
  }

  return configured > 0;
}

export function findProfile(globalSettings, profileId) {
  return normalizeGlobalSettings(globalSettings).profiles.find((profile) => profile.id === String(profileId || "")) || null;
}

export function cycleCurrentIndex(globalSettings, snapshot, cursorProfileId = "") {
  const normalized = normalizeGlobalSettings(globalSettings);
  if (!normalized.profiles.length) return -1;

  const live = normalized.profiles.findIndex((profile) => profileMatchesSnapshot(profile, snapshot));
  if (live >= 0) return live;

  const cursor = normalized.profiles.findIndex((profile) => profile.id === String(cursorProfileId || ""));
  if (cursor >= 0) return cursor;

  return normalized.profiles.findIndex((profile) => profile.id === normalized.lastAppliedProfileId);
}
