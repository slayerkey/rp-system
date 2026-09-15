import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import { randomUUID } from "node:crypto";
import { AudioHelper } from "./audio-helper.js";
import { endpointIdentity, matchEndpoint } from "./device-matching.js";
import {
  buildApplyPlan,
  captureProfileFromSnapshot,
  cycleCurrentIndex,
  emptyGlobalSettings,
  endpointMuteMatches,
  endpointVolumeMatches,
  findProfile,
  mergeApplyResult,
  normalizeGlobalSettings,
  normalizeProfile,
  profileMatchesSnapshot,
  roleMatchesSnapshot,
  snapshotDefaultRoleConflicts,
  verifyApplyResult,
} from "./profiles.js";
import { dialFeedback, renderKey } from "./render.js";

const BUILD_VERSION = "1.0.0.0";
const ACTIONS = {
  apply: "com.packrat.audio-manager-pro.apply-profile",
  "set-output": "com.packrat.audio-manager-pro.set-output",
  "set-input": "com.packrat.audio-manager-pro.set-input",
  cycle: "com.packrat.audio-manager-pro.cycle-profile",
  status: "com.packrat.audio-manager-pro.profile-status",
  "mute-mic": "com.packrat.audio-manager-pro.mute-default-mic",
  volume: "com.packrat.audio-manager-pro.profile-output-volume",
};

streamDeck.logger.setLevel("info");

const helper = new AudioHelper({ log: logger });
const visible = new Map();
let globalSettings = emptyGlobalSettings();
let latestSnapshot = null;
let latestError = "";
let renderTimer = null;
let pollTimer = null;
let audioMutationQueue = Promise.resolve();

function logger(message) {
  try { streamDeck.logger.error(String(message)); } catch {}
}

function logInfo(message) {
  try { streamDeck.logger.info(String(message)); } catch {}
}

function enqueueAudioMutation(task) {
  const run = audioMutationQueue
    .catch(() => {})
    .then(task);
  audioMutationQueue = run.catch((error) => {
    logger(error?.stack || error?.message || error);
  });
  return run;
}

function actionSettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    profileId: String(source.profileId || ""),
    role: source.role === "communications" ? "communications" : "default",
    device: source.device && typeof source.device === "object" ? endpointIdentity(source.device) : null,
    step: [1, 2, 5, 10].includes(Number(source.step)) ? Number(source.step) : 2,
  };
}

async function saveGlobal(next) {
  globalSettings = normalizeGlobalSettings(next);
  await streamDeck.settings.setGlobalSettings(globalSettings);
  for (const record of visible.values()) {
    record.feedbackNote = "";
    record.lastFeedback = "";
  }
  scheduleRender(0);
}

function acceptSnapshot(snapshot) {
  latestSnapshot = snapshot || null;
  latestError = String(snapshot?.error || "");
  return latestSnapshot;
}

function markHelperError(error) {
  latestSnapshot = null;
  latestError = String(error?.message || error || "Audio helper unavailable.");
  scheduleRender(0);
  return latestError;
}

async function refreshSnapshot({ quiet = true } = {}) {
  try {
    const response = await helper.snapshot();
    acceptSnapshot(response?.snapshot || null);
    latestError = String(response?.error || latestError || "");
    if (!latestError) {
      for (const record of visible.values()) {
        if (["Helper offline", "Audio unavailable", "Rebind output"].includes(record.feedbackNote)) {
          record.feedbackNote = "";
          record.lastFeedback = "";
        }
      }
    }
    scheduleRender();
    return latestSnapshot;
  } catch (error) {
    markHelperError(error);
    if (!quiet) logger(latestError);
    scheduleRender();
    return null;
  }
}

function scheduleRender(delay = 25) {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    void renderAll();
  }, delay);
  renderTimer.unref?.();
}

function profileForRecord(record) {
  const selectedId = String(record?.settings?.profileId || "");
  if (selectedId) return findProfile(globalSettings, selectedId);

  if (record?.kind === "cycle") {
    return findProfile(globalSettings, globalSettings.lastAppliedProfileId)
      || globalSettings.profiles[0]
      || null;
  }

  return null;
}

function endpointForDeviceRecord(record) {
  const isOutput = record.kind === "set-output";
  const list = isOutput ? latestSnapshot?.outputs : latestSnapshot?.inputs;
  const match = matchEndpoint(record.settings.device, list || []);
  return { match, endpoint: match.endpoint || null };
}

function profileOutput(profile) {
  if (!profile)
    return { match: { status: "unconfigured", reason: "Select profile" }, endpoint: null };

  const slot = profile.slots?.outputDefault;
  if (!slot?.device)
    return { match: { status: "unconfigured", reason: "No default output" }, endpoint: null };

  const match = matchEndpoint(slot.device, latestSnapshot?.outputs || []);
  return { match, endpoint: match.endpoint || null };
}

async function renderRecord(record) {
  if (!record?.action) return;

  if (record.action.isDial?.()) {
    const profile = profileForRecord(record);
    const { match, endpoint } = profileOutput(profile);
    const note = match.status === "matched"
      ? record.feedbackNote || ""
      : match.status === "unconfigured"
        ? match.reason
        : latestError
          ? "Audio unavailable"
          : "Rebind output";
    const feedback = dialFeedback(profile, endpoint, note);
    const signature = JSON.stringify(feedback);
    if (signature !== record.lastFeedback) {
      record.lastFeedback = signature;
      await record.action.setFeedback(feedback).catch(logger);
    }
    return;
  }

  if (!record.action.isKey?.()) return;

  let image;
  if (["apply", "cycle", "status"].includes(record.kind)) {
    let profile = profileForRecord(record);
    if (record.kind === "cycle" && globalSettings.profiles.length) {
      const index = cycleCurrentIndex(globalSettings, latestSnapshot, record.settings.profileId);
      if (index >= 0) profile = globalSettings.profiles[index] || profile;
    }
    const active = profile ? profileMatchesSnapshot(profile, latestSnapshot) : false;
    const transientStatus = record.lastStatusAt && (Date.now() - record.lastStatusAt) < 2200
      ? record.lastStatus
      : "";
    const status = latestError
      ? "OFFLINE"
      : record.kind === "status"
        ? (active ? "ACTIVE" : "INACTIVE")
        : transientStatus;
    image = renderKey(record.kind, { profile, active, status });
  } else if (record.kind === "set-output" || record.kind === "set-input") {
    const { match, endpoint } = endpointForDeviceRecord(record);
    const configured = Boolean(
      record.settings.device &&
      (record.settings.device.endpointId ||
        record.settings.device.name ||
        record.settings.device.instanceId ||
        record.settings.device.containerId)
    );
    image = renderKey(record.kind, {
      endpoint: endpoint || record.settings.device,
      missing: configured && match.status !== "matched",
      offline: Boolean(latestError),
      role: record.settings.role,
    });
  } else if (record.kind === "mute-mic") {
    const endpoint = (latestSnapshot?.inputs || []).find((item) => item.id === latestSnapshot?.defaultInputId);
    image = renderKey(record.kind, {
      endpoint,
      muted: Boolean(endpoint?.muted),
      missing: !endpoint,
      offline: Boolean(latestError),
    });
  } else {
    image = renderKey(record.kind);
  }

  if (image === record.lastImage) return;
  record.lastImage = image;
  await record.action.setImage(image).catch(logger);
}

async function renderAll() {
  await Promise.allSettled(Array.from(visible.values()).map(renderRecord));
  for (const record of visible.values()) {
    if (record.inspectorOpen) void sendInspector(record);
  }
}

function inspectorPayload(record) {
  return {
    type: "audioManager.state",
    buildVersion: BUILD_VERSION,
    action: record.kind,
    snapshot: latestSnapshot,
    globalSettings,
    latestError,
    lastResult: record.lastResult || null,
  };
}

async function sendInspectorPayload(record, payload) {
  try {
    await record.action.sendToPropertyInspector(payload);
    return;
  } catch {}
  try {
    await streamDeck.ui.sendToPropertyInspector(payload);
  } catch {}
}

async function sendInspector(record) {
  await sendInspectorPayload(record, inspectorPayload(record));
}

function snapshotUnavailable(snapshot) {
  if (!snapshot) return latestError || "Windows audio state is unavailable.";
  return snapshot.error || "";
}

function failedResult(error) {
  return {
    status: "FAILED",
    successCount: 0,
    failureCount: 1,
    failures: [{ slot: "audio", error: String(error || "Windows audio state is unavailable.") }],
    snapshot: null,
  };
}

async function applyProfile(profile, record = null) {
  const before = await refreshSnapshot({ quiet: false });
  const unavailable = snapshotUnavailable(before);
  if (unavailable) {
    const result = failedResult(unavailable);
    if (record) {
      record.lastStatus = result.status;
      record.lastStatusAt = Date.now();
      record.lastResult = result;
      record.lastImage = "";
      record.lastFeedback = "";
    }
    scheduleRender(0);
    return result;
  }

  const plan = buildApplyPlan(profile, before);
  let response = { results: [], snapshot: before, error: "No valid operations." };

  if (plan.operations.length) {
    try {
      response = await helper.apply(plan.operations);
    } catch (error) {
      markHelperError(error);
      response = { results: [], snapshot: null, error: latestError };
    }
  }

  let result = mergeApplyResult(plan, response);
  result = verifyApplyResult(profile, result, response?.snapshot || null);
  if (response?.snapshot) acceptSnapshot(response.snapshot);
  else await refreshSnapshot({ quiet: true });

  if (result.status === "SUCCESS" && profile?.id) {
    try {
      await saveGlobal({ ...globalSettings, lastAppliedProfileId: profile.id });
    } catch (error) {
      result = {
        ...result,
        status: "PARTIAL",
        failureCount: Number(result.failureCount || 0) + 1,
        failures: [
          ...(result.failures || []),
          { slot: "settings", error: "Audio Profile applied, but Stream Deck could not persist the last-applied profile." },
        ],
      };
      logger(error?.message || error);
    }
  }

  if (record) {
    record.lastStatus = result.status;
    record.lastStatusAt = Date.now();
    record.lastResult = result;
    record.lastImage = "";
    record.lastFeedback = "";
  }
  scheduleRender(0);
  return result;
}

async function feedbackForResult(record, result) {
  if (!record?.action) return;
  if (result.status === "SUCCESS") {
    if (record.action.isKey?.()) await record.action.showOk().catch(() => {});
    return;
  }
  await record.action.showAlert().catch(() => {});
}

async function applySelected(record) {
  const profile = profileForRecord(record);
  if (!profile) {
    const message = globalSettings.profiles.length
      ? "Select an Audio Profile for this action first."
      : "Create an Audio Profile first.";
    const result = { status: "FAILED", failures: [{ error: message }] };
    record.lastStatus = "FAILED";
    record.lastStatusAt = Date.now();
    record.lastResult = result;
    await feedbackForResult(record, result);
    scheduleRender(0);
    return result;
  }
  const result = await applyProfile(profile, record);
  await feedbackForResult(record, result);
  return result;
}

async function checkSelectedProfile(record) {
  const profile = profileForRecord(record);
  const snapshot = await refreshSnapshot({ quiet: false });
  const unavailable = snapshotUnavailable(snapshot);
  const active = Boolean(!unavailable && profile && profileMatchesSnapshot(profile, snapshot));
  const result = unavailable
    ? failedResult(unavailable)
    : profile
      ? {
          status: active ? "SUCCESS" : "FAILED",
          failures: active ? [] : [{ error: "Selected Audio Profile is not currently active." }],
        }
      : {
          status: "FAILED",
          failures: [{ error: "Create or select an Audio Profile first." }],
        };

  record.lastResult = result;
  record.lastStatus = active ? "ACTIVE" : "INACTIVE";
  record.lastImage = "";
  await feedbackForResult(record, result);
  scheduleRender(0);
  return result;
}

async function setSelectedDevice(record) {
  const snapshot = await refreshSnapshot({ quiet: false });
  const unavailable = snapshotUnavailable(snapshot);
  if (unavailable) {
    const result = failedResult(unavailable);
    record.lastStatus = "FAILED";
    record.lastResult = result;
    await feedbackForResult(record, result);
    scheduleRender(0);
    return;
  }

  const isOutput = record.kind === "set-output";
  const match = matchEndpoint(record.settings.device, isOutput ? snapshot.outputs || [] : snapshot.inputs || []);
  if (match.status !== "matched" || !match.endpoint) {
    const result = { status: "FAILED", failures: [{ error: match.reason || "Rebind the audio device." }] };
    record.lastStatus = "FAILED";
    record.lastResult = result;
    await feedbackForResult(record, result);
    scheduleRender(0);
    return;
  }

  let response;
  try {
    response = await helper.apply([{
      kind: "set-default",
      flow: isOutput ? "output" : "input",
      role: record.settings.role,
      endpointId: match.endpoint.id,
    }]);
  } catch (error) {
    markHelperError(error);
    response = { results: [], error: latestError, snapshot: null };
  }
  const ok = response?.results?.[0]?.ok === true;
  const verified = ok && roleMatchesSnapshot(
    isOutput ? "output" : "input",
    record.settings.role,
    match.endpoint.id,
    response?.snapshot || null,
  );
  const result = {
    status: verified ? "SUCCESS" : ok ? "PARTIAL" : "FAILED",
    failures: verified
      ? []
      : [{
          error: ok
            ? "Windows accepted the device switch, but the final audio role could not be verified."
            : response?.results?.[0]?.error || response?.error || "Device switch failed.",
        }],
  };
  record.lastStatus = result.status;
  record.lastResult = result;
  if (response?.snapshot) acceptSnapshot(response.snapshot);
  else await refreshSnapshot({ quiet: true });
  await feedbackForResult(record, result);
  scheduleRender(0);
}

async function cycleProfile(record) {
  if (!globalSettings.profiles.length) return applySelected(record);
  await refreshSnapshot({ quiet: true });
  const current = cycleCurrentIndex(globalSettings, latestSnapshot, record.settings.profileId);
  const nextIndex = current < 0 ? 0 : (current + 1) % globalSettings.profiles.length;
  const next = globalSettings.profiles[nextIndex];
  record.settings = { ...record.settings, profileId: next.id };
  await record.action.setSettings(record.settings).catch(() => {});
  const result = await applyProfile(next, record);
  await feedbackForResult(record, result);
}

async function toggleDefaultMic(record) {
  const snapshot = await refreshSnapshot({ quiet: false });
  const unavailable = snapshotUnavailable(snapshot);
  if (unavailable) {
    const result = failedResult(unavailable);
    record.lastResult = result;
    record.lastStatus = "FAILED";
    await feedbackForResult(record, result);
    scheduleRender(0);
    return;
  }

  const defaultConflicts = snapshotDefaultRoleConflicts(snapshot);
  if (defaultConflicts.some((message) => message.includes("input"))) {
    const result = {
      status: "FAILED",
      failures: [{ error: "Windows Default input is split between Console and Multimedia. Align the Default input before toggling mute." }],
    };
    record.lastResult = result;
    record.lastStatus = "FAILED";
    await feedbackForResult(record, result);
    scheduleRender(0);
    return;
  }

  const endpoint = (snapshot.inputs || []).find((item) => item.id === snapshot.defaultInputId);
  if (!endpoint?.id || !endpoint.muteAvailable) {
    const result = { status: "FAILED", failures: [{ error: "Default microphone mute is unavailable." }] };
    record.lastResult = result;
    record.lastStatus = "FAILED";
    await feedbackForResult(record, result);
    return;
  }

  let response;
  try {
    response = await helper.apply([{ kind: "set-mute", endpointId: endpoint.id, value: !endpoint.muted }]);
  } catch (error) {
    markHelperError(error);
    response = { results: [], error: latestError, snapshot: null };
  }
  const ok = response?.results?.[0]?.ok === true;
  const expectedMute = !endpoint.muted;
  const verified = ok && endpointMuteMatches(response?.snapshot || null, endpoint.id, expectedMute);
  const result = {
    status: verified ? "SUCCESS" : ok ? "PARTIAL" : "FAILED",
    failures: verified
      ? []
      : [{
          error: ok
            ? "Windows accepted the microphone mute change, but the final mute state could not be verified."
            : response?.results?.[0]?.error || response?.error || "Mute failed.",
        }],
  };
  record.lastResult = result;
  record.lastStatus = result.status;
  if (response?.snapshot) acceptSnapshot(response.snapshot);
  await feedbackForResult(record, result);
  scheduleRender(0);
}

async function adjustProfileVolume(record, ticks) {
  const profile = profileForRecord(record);
  if (!profile) {
    record.feedbackNote = "Select profile";
    await record.action.showAlert().catch(() => {});
    scheduleRender(0);
    return;
  }
  await refreshSnapshot({ quiet: true });
  const { match, endpoint } = profileOutput(profile);
  if (match.status !== "matched" || !endpoint?.volumeAvailable) {
    record.feedbackNote = match.status === "unconfigured"
      ? match.reason
      : latestError
        ? "Audio unavailable"
        : match.status === "matched"
          ? "Volume unavailable"
          : "Rebind output";
    await record.action.showAlert().catch(() => {});
    scheduleRender(0);
    return;
  }

  const next = Math.max(0, Math.min(100, Math.round(Number(endpoint.volume || 0) + Number(ticks || 0) * record.settings.step)));
  if (next === Number(endpoint.volume)) return;

  try {
    const response = await helper.apply([{ kind: "set-volume", endpointId: endpoint.id, value: next }]);
    const ok = response?.results?.[0]?.ok === true;
    const verified = ok && endpointVolumeMatches(response?.snapshot || null, endpoint.id, next);
    if (response?.snapshot) acceptSnapshot(response.snapshot);
    record.feedbackNote = verified ? "" : ok ? "Verify failed" : "Volume failed";
    if (!verified) await record.action.showAlert().catch(() => {});
  } catch (error) {
    markHelperError(error);
    record.feedbackNote = "Helper offline";
    await record.action.showAlert().catch(() => {});
    logger(error?.message || error);
  }
  record.lastFeedback = "";
  scheduleRender(0);
}

async function toggleProfileOutputMute(record) {
  const profile = profileForRecord(record);
  if (!profile) {
    record.feedbackNote = "Select profile";
    await record.action.showAlert().catch(() => {});
    scheduleRender(0);
    return;
  }
  await refreshSnapshot({ quiet: true });
  const { match, endpoint } = profileOutput(profile);
  if (match.status !== "matched" || !endpoint?.muteAvailable) {
    record.feedbackNote = match.status === "unconfigured"
      ? match.reason
      : latestError
        ? "Audio unavailable"
        : match.status === "matched"
          ? "Mute unavailable"
          : "Rebind output";
    await record.action.showAlert().catch(() => {});
    scheduleRender(0);
    return;
  }
  try {
    const response = await helper.apply([{ kind: "set-mute", endpointId: endpoint.id, value: !endpoint.muted }]);
    const ok = response?.results?.[0]?.ok === true;
    const expectedMute = !endpoint.muted;
    const verified = ok && endpointMuteMatches(response?.snapshot || null, endpoint.id, expectedMute);
    if (response?.snapshot) acceptSnapshot(response.snapshot);
    record.feedbackNote = verified ? "" : ok ? "Verify failed" : "Mute failed";
    record.lastFeedback = "";
    if (!verified) await record.action.showAlert().catch(() => {});
    scheduleRender(0);
  } catch (error) {
    markHelperError(error);
    record.feedbackNote = "Helper offline";
    await record.action.showAlert().catch(() => {});
    logger(error?.message || error);
    scheduleRender(0);
  }
}

async function createProfile(name) {
  const snapshot = await refreshSnapshot({ quiet: false });
  const unavailable = snapshotUnavailable(snapshot);
  if (unavailable) throw new Error(unavailable);

  const conflicts = snapshotDefaultRoleConflicts(snapshot);
  if (conflicts.length) {
    throw new Error(`Cannot capture this setup exactly. ${conflicts.join(" ")} Align each Windows Default role, refresh, then capture again.`);
  }

  const profile = captureProfileFromSnapshot(String(name || "New Audio Profile").trim().slice(0, 80) || "New Audio Profile", snapshot, randomUUID());
  if (!profile) throw new Error("Could not capture an Audio Profile.");
  if (!Object.values(profile.slots || {}).some((slot) => slot?.device))
    throw new Error("No Windows audio defaults are available to capture.");
  await saveGlobal({ ...globalSettings, profiles: [...globalSettings.profiles, profile] });
  return profile;
}

async function upsertProfile(input) {
  const profile = normalizeProfile(input);
  if (!profile) throw new Error("Invalid Audio Profile.");
  const profiles = [...globalSettings.profiles];
  const index = profiles.findIndex((item) => item.id === profile.id);
  if (index >= 0) profiles[index] = profile;
  else profiles.push(profile);
  await saveGlobal({ ...globalSettings, profiles });
  return profile;
}

async function deleteProfile(profileId) {
  const id = String(profileId || "");
  const profiles = globalSettings.profiles.filter((profile) => profile.id !== id);
  await saveGlobal({
    ...globalSettings,
    profiles,
    lastAppliedProfileId: globalSettings.lastAppliedProfileId === id ? "" : globalSettings.lastAppliedProfileId,
  });
}


const recentInspectorRequestIds = [];
const recentInspectorRequestSet = new Set();

function acceptInspectorRequest(requestId) {
  const id = String(requestId || "");
  if (!id) return true;
  if (recentInspectorRequestSet.has(id)) return false;
  recentInspectorRequestSet.add(id);
  recentInspectorRequestIds.push(id);
  while (recentInspectorRequestIds.length > 100) {
    recentInspectorRequestSet.delete(recentInspectorRequestIds.shift());
  }
  return true;
}

function recordForInspectorEvent(ev, payload) {
  const explicit = String(payload?.actionContext || "");
  if (explicit && visible.has(explicit)) return visible.get(explicit);

  const eventId = String(ev?.action?.id || "");
  if (eventId && visible.has(eventId)) return visible.get(eventId);

  const currentId = String(streamDeck.ui?.action?.id || "");
  if (currentId && visible.has(currentId)) return visible.get(currentId);

  return null;
}

async function handleInspectorEvent(ev) {
  const payload = ev?.payload || {};
  if (!acceptInspectorRequest(payload.requestId)) return;

  const record = recordForInspectorEvent(ev, payload);
  if (!record) {
    logger(`Property Inspector request could not resolve an action instance. type=${String(payload.type || "unknown")} actionContext=${String(payload.actionContext || "")}`);
    return;
  }

  record.inspectorOpen = true;
  logInfo(`Property Inspector request: ${String(payload.type || "unknown")} / ${String(payload.command || "")}`);

  if (payload.type === "audioManager.inspect") {
    await refreshSnapshot({ quiet: true });
    await sendInspector(record);
    return;
  }
  if (payload.type !== "audioManager.command") return;

  let createdProfileId = "";
  try {
    const command = String(payload.command || "");
    if (command === "refresh") await refreshSnapshot({ quiet: false });
    else if (command === "create-profile") {
      const profile = await createProfile(payload.name);
      createdProfileId = profile.id;
      record.settings = { ...record.settings, profileId: profile.id };
      if (["apply", "status", "volume"].includes(record.kind))
        await record.action.setSettings(record.settings);
    } else if (command === "save-profile") {
      await upsertProfile(payload.profile);
    } else if (command === "delete-profile") {
      await deleteProfile(payload.profileId);
    }
    record.lastResult = null;
  } catch (error) {
    logger(`Property Inspector command failed: ${String(error?.message || error)}`);
    record.lastResult = { status: "FAILED", failures: [{ error: String(error?.message || error) }] };
  }

  await sendInspector(record);
  if (createdProfileId) {
    await sendInspectorPayload(record, {
      type: "audioManager.profile-created",
      profileId: createdProfileId,
    });
  }
}

class AudioManagerAction extends SingletonAction {
  constructor(manifestId, kind) {
    super();
    this.manifestId = manifestId;
    this.kind = kind;
  }

  async onWillAppear(ev) {
    const id = String(ev.action?.id || "");
    if (!id) return;
    const record = {
      id,
      kind: this.kind,
      action: ev.action,
      settings: actionSettings(ev.payload?.settings),
      lastImage: "",
      lastFeedback: "",
      lastStatus: "",
      lastStatusAt: 0,
      lastResult: null,
      feedbackNote: "",
      inspectorOpen: false,
    };
    visible.set(id, record);

    if (!latestSnapshot) await refreshSnapshot({ quiet: true });

    if (ev.action?.isDial?.()) {
      await ev.action.setTriggerDescription({
        push: "Apply audio profile",
        rotate: "Adjust profile output volume",
        touch: "Toggle profile output mute",
      }).catch(logger);
    }
    await renderRecord(record);
  }

  onWillDisappear(ev) {
    visible.delete(String(ev.action?.id || ""));
  }

  async onDidReceiveSettings(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    record.settings = actionSettings(ev.payload?.settings);
    record.lastImage = "";
    record.lastFeedback = "";
    record.lastStatus = "";
    record.lastStatusAt = 0;
    record.feedbackNote = "";
    await renderRecord(record);
  }

  async onPropertyInspectorDidAppear(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    record.inspectorOpen = true;
    await refreshSnapshot({ quiet: true });
    await sendInspector(record);
  }

  onPropertyInspectorDidDisappear(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (record) record.inspectorOpen = false;
  }

  async onSendToPlugin(ev) {
    return handleInspectorEvent(ev);
  }

  async onKeyDown(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;

    return enqueueAudioMutation(async () => {
      record.lastStatus = "";
      record.lastStatusAt = 0;
      if (record.kind === "apply") return applySelected(record);
      if (record.kind === "set-output" || record.kind === "set-input") return setSelectedDevice(record);
      if (record.kind === "cycle") return cycleProfile(record);
      if (record.kind === "status") return checkSelectedProfile(record);
      if (record.kind === "mute-mic") return toggleDefaultMic(record);
    });
  }

  async onDialDown(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (record?.kind === "volume")
      return enqueueAudioMutation(() => applySelected(record));
  }

  async onDialRotate(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (record?.kind !== "volume") return;
    const ticks = Number(ev.payload?.ticks || 0);
    if (ticks)
      return enqueueAudioMutation(() => adjustProfileVolume(record, ticks));
  }

  async onTouchTap(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (record?.kind === "volume")
      return enqueueAudioMutation(() => toggleProfileOutputMute(record));
  }
}

for (const [kind, manifestId] of Object.entries(ACTIONS)) {
  streamDeck.actions.registerAction(new AudioManagerAction(manifestId, kind));
}

streamDeck.ui.onDidAppear(() => {
  const id = String(streamDeck.ui?.action?.id || "");
  const record = id ? visible.get(id) : null;
  if (!record) return;
  record.inspectorOpen = true;
  void refreshSnapshot({ quiet: true }).then(() => sendInspector(record));
});

streamDeck.ui.onDidDisappear(() => {
  for (const record of visible.values()) record.inspectorOpen = false;
});

streamDeck.ui.onSendToPlugin((ev) => {
  void handleInspectorEvent(ev);
});

process.on("uncaughtException", (error) => logger(error?.stack || error));
process.on("unhandledRejection", (error) => logger(error?.stack || error));
process.on("exit", () => helper.shutdown());
process.on("SIGTERM", () => {
  helper.shutdown();
  setTimeout(() => process.exit(0), 300);
});
process.on("SIGINT", () => {
  helper.shutdown();
  setTimeout(() => process.exit(0), 300);
});

async function main() {
  await streamDeck.connect();
  logInfo(`Audio Manager Pro ${BUILD_VERSION} connected to Stream Deck.`);
  globalSettings = normalizeGlobalSettings(await streamDeck.settings.getGlobalSettings());
  streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
    globalSettings = normalizeGlobalSettings(ev.settings || ev.payload?.settings || ev);
    scheduleRender(0);
  });
  streamDeck.system.onSystemDidWakeUp(() => {
    latestSnapshot = null;
    if (visible.size) void refreshSnapshot({ quiet: true });
  });
  pollTimer = setInterval(() => {
    if (visible.size) void refreshSnapshot({ quiet: true });
  }, 1500);
  pollTimer.unref?.();
}

main().catch((error) => {
  logger(error?.stack || error?.message || error);
  process.exitCode = 1;
});
