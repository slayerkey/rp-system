import { InputHost } from "./input-host.mjs";
import { MacroLibrary } from "./storage.mjs";
import {
  LITE_LIMITS, PRO_LIMITS, exportEnvelope, importEnvelope,
  normalizeMacro, playbackSafetyError, playbackSettings, validateMacro
} from "./model.mjs";

function recordingName() {
  return `Recording ${new Date().toLocaleString([], { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}`;
}

function shortTitle(text, max = 16) {
  const value = String(text || "").trim();
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}

function proStarterMacros() {
  const clickPair = (delay = 65) => [
    { type:"mouseDown", delayMs:delay, button:"left", x:960, y:540, relX:.5, relY:.5 },
    { type:"mouseUp", delayMs:45, button:"left", x:960, y:540, relX:.5, relY:.5 },
  ];
  const make = (id, name, events) => ({
    schema:1,
    id,
    name,
    createdAt:"2026-09-14T00:00:00.000Z",
    updatedAt:"2026-09-14T00:00:00.000Z",
    durationMs:events.reduce((sum, event) => sum + Number(event.delayMs || 0), 0),
    events,
  });
  return [
    make("starter-rapid-click", "Rapid Left Click", Array.from({ length:8 }, () => clickPair()).flat()),
    make("starter-double-click", "Double Click", [...clickPair(60), ...clickPair(90)]),
    make("starter-scroll-burst", "Scroll Burst", [
      { type:"wheel", delayMs:80, x:960, y:540, relX:.5, relY:.5, delta:-120, horizontal:false },
      { type:"wheel", delayMs:90, x:960, y:540, relX:.5, relY:.5, delta:-120, horizontal:false },
      { type:"wheel", delayMs:90, x:960, y:540, relX:.5, relY:.5, delta:-120, horizontal:false },
    ]),
  ];
}

export async function startMacroRecorder({ streamDeck, SingletonAction, pro, prefix, version }) {
  const edition = pro ? "pro" : "lite";
  const limits = pro ? PRO_LIMITS : LITE_LIMITS;
  const ids = {
    record: `${prefix}.record`,
    stop: `${prefix}.stop`,
    replay: `${prefix}.replay`,
  };
  const visible = new Map();
  const host = new InputHost((message) => streamDeck.logger?.error?.(String(message)));
  const library = pro ? await new MacroLibrary().load() : null;
  if (pro) {
    for (const starter of proStarterMacros()) await library.ensure(starter);
  }
  let recording = null;
  let latestMacro = null;
  let playback = null;
  let lastError = "";
  let latestSignature = "";
  let recoveringCrash = false;
  let savedFeedback = null;
  let savedFeedbackTimer = null;

  function currentSavedFeedback() {
    if (!savedFeedback || savedFeedback.until <= Date.now()) return null;
    return savedFeedback;
  }

  function setSavedFeedback(macro, assignedCount) {
    if (savedFeedbackTimer) clearTimeout(savedFeedbackTimer);
    savedFeedback = {
      macroId: macro.id,
      name: macro.name,
      assignedToPlay: assignedCount > 0,
      until: Date.now() + 4000,
    };
    savedFeedbackTimer = setTimeout(() => {
      savedFeedback = null;
      savedFeedbackTimer = null;
      void renderAll();
      void broadcastStatus();
    }, 4000);
  }

  function settingsFor(kind, raw = {}) {
    const source = raw && typeof raw === "object" ? raw : {};
    if (kind === "record") {
      return {
        captureMouseMovement: pro ? source.captureMouseMovement !== false : false,
      };
    }
    if (kind === "replay") {
      return {
        macro: !pro && source.macro ? normalizeMacro(source.macro, { pro: false, limits }) : null,
        macroId: pro ? String(source.macroId || "") : "",
        seedMacro: pro && source.seedMacro ? normalizeMacro(source.seedMacro, { pro:true, limits }) : null,
        playbackSpeed: pro ? Number(source.playbackSpeed || 1) : 1,
        playbackMode: pro ? String(source.playbackMode || "once") : "once",
        repeatCount: pro ? Number(source.repeatCount || 2) : 1,
        coordinateMode: pro && source.coordinateMode === "active-window" ? "active-window" : "absolute",
      };
    }
    return {};
  }

  function macroFor(record) {
    if (!record || record.kind !== "replay") return null;
    return pro ? library.get(record.settings.macroId) : record.settings.macro;
  }

  async function render(record) {
    if (!record?.action?.isKey?.()) return;
    const saved = currentSavedFeedback();
    let title = "";
    if (record.kind === "record") {
      if (recording) title = `REC\n${Math.max(0, Math.round(Number(recording.elapsedMs || 0) / 100) / 10).toFixed(1)}s`;
      else if (saved) title = "SAVED";
    } else if (record.kind === "stop") {
      title = recording || playback ? "STOP\nNOW" : "EMERGENCY\nSTOP";
    } else if (record.kind === "replay") {
      const macro = macroFor(record);
      if (playback?.actionId === record.id) title = "PLAYING";
      else if (saved && macro?.id === saved.macroId) title = "SAVED\nREADY";
      else if (macro && record.settings.seedMacro) title = shortTitle(macro.name, 12);
    }
    await record.action.setTitle(title).catch(() => {});
  }

  async function renderAll() {
    await Promise.all([...visible.values()].map(render));
  }

  async function inspectorState(record) {
    const macro = macroFor(record);
    return {
      type: "macroRecorder.state",
      edition,
      version,
      kind: record?.kind || "",
      limits,
      recording,
      playback: playback ? { actionId: playback.actionId, macroName: playback.macro?.name || "" } : null,
      hasLatestMacro: Boolean(latestMacro?.events?.length),
      latestMacroId: String(latestMacro?.id || ""),
      recentSaved: currentSavedFeedback(),
      macro,
      library: pro ? library.list() : [],
      libraryWarning: pro ? library.warning : "",
      lastError,
      validation: macro ? validateMacro(macro, { pro }) : null,
      proLockedFeatures: pro ? [] : ["Mouse recording","Long macros","Playback speed","Loops","Macro Library","Import / export"],
    };
  }

  function inspectorStatus() {
    return {
      type: "macroRecorder.status",
      recording,
      playback: playback ? { actionId: playback.actionId, macroName: playback.macro?.name || "" } : null,
      hasLatestMacro: Boolean(latestMacro?.events?.length),
      latestMacroId: String(latestMacro?.id || ""),
      recentSaved: currentSavedFeedback(),
      lastError,
    };
  }

  async function sendInspector(record) {
    if (!record?.action?.sendToPropertyInspector) return;
    await record.action.sendToPropertyInspector(await inspectorState(record)).catch(() => {});
  }

  async function broadcastInspectors() {
    await Promise.all([...visible.values()].filter((record) => record.inspectorOpen).map(sendInspector));
  }

  async function broadcastStatus() {
    const status = inspectorStatus();
    await Promise.all([...visible.values()]
      .filter((record) => record.inspectorOpen && record.action?.sendToPropertyInspector)
      .map((record) => record.action.sendToPropertyInspector(status).catch(() => {})));
  }

  async function assignNewRecordingToBlankReplayKeys(macro) {
    if (!pro || !macro?.id) return 0;
    const blankReplayKeys = [...visible.values()].filter((item) => item.kind === "replay" && !item.settings.macroId && !item.settings.seedMacro);
    await Promise.all(blankReplayKeys.map(async (item) => {
      const next = { ...item.settings, macroId: macro.id };
      delete next.seedMacro;
      await item.action.setSettings(next);
      item.settings = settingsFor("replay", next);
    }));
    return blankReplayKeys.length;
  }

  async function finalizeCapture(raw) {
    if (!raw?.events) return;
    const signature = JSON.stringify(raw.events) + ":" + raw.durationMs;
    if (signature === latestSignature) return;
    latestSignature = signature;
    let macro = normalizeMacro({ ...raw, name: recordingName() }, { pro, limits });
    recording = null;
    if (!macro.events.length) {
      latestMacro = null;
      lastError = "Nothing was captured. Press Record, perform the workflow, then press the same Record key again to save.";
      await renderAll();
      await broadcastInspectors();
      return;
    }
    if (pro) macro = await library.add(macro);
    latestMacro = macro;
    const assignedCount = await assignNewRecordingToBlankReplayKeys(macro);
    setSavedFeedback(macro, assignedCount);
    lastError = "";
    await renderAll();
    await broadcastInspectors();
  }

  host.on("recordingStarted", async (message) => {
    recording = { startedAt: message.startedAt || new Date().toISOString(), eventCount: 0, elapsedMs: 0 };
    await renderAll();
    await broadcastInspectors();
  });
  host.on("recordingProgress", async (message) => {
    if (!recording) return;
    recording = { ...recording, eventCount: Number(message.eventCount || 0), elapsedMs: Number(message.elapsedMs || 0) };
    await renderAll();
    await broadcastStatus();
  });
  host.on("recordingStopped", (message) => {
    void finalizeCapture(message.macro).catch(async (error) => {
      recording = null;
      lastError = `The recording was captured but could not be saved: ${String(error?.message || error)}`;
      streamDeck.logger?.error?.(lastError);
      await renderAll();
      await broadcastInspectors();
    });
  });
  host.on("recordingCancelled", async () => {
    recording = null;
    await renderAll();
    await broadcastInspectors();
  });
  host.on("playbackStarted", async () => {
    await renderAll();
    await broadcastInspectors();
  });
  host.on("playbackStopped", async (message) => {
    playback = null;
    if (message?.error) lastError = String(message.error);
    await renderAll();
    await broadcastInspectors();
  });
  host.on("crash", () => { void recoverFromCrash(); });

  async function recoverFromCrash() {
    if (recoveringCrash) return;
    recoveringCrash = true;
    playback = null;
    recording = null;
    lastError = "The input engine stopped unexpectedly. Playback was cancelled; one local recovery restart will be attempted.";
    await renderAll();
    await broadcastInspectors();
    try {
      await host.ensure();
      lastError = "";
      streamDeck.logger?.info?.("Macro Recorder input engine restarted after a crash and completed startup recovery.");
    } catch {
      lastError = "The input engine could not restart automatically. Playback remains stopped; the next action will retry the local helper.";
    } finally {
      recoveringCrash = false;
      await renderAll();
      await broadcastInspectors();
    }
  }

  async function surfaceRecoverableError(error, action = null) {
    lastError = String(error?.message || error || "Macro Recorder command failed.");
    await renderAll();
    await broadcastInspectors();
    await action?.showAlert?.().catch(() => {});
  }

  async function startRecording(record) {
    if (recording) return stopRecording(record.action);
    if (playback) await stopPlayback(record.action);
    lastError = "";
    try {
      await host.command("startRecording", {
        includeMouse: pro,
        includeMouseMove: pro && record.settings.captureMouseMovement !== false,
        maxDurationMs: limits.maxDurationMs,
        maxEvents: limits.maxEvents,
      });
    } catch (error) {
      await surfaceRecoverableError(error, record.action);
    }
  }

  async function cancelRecording(action = null) {
    if (!recording) return;
    try {
      await host.command("cancelRecording");
    } catch (error) {
      await surfaceRecoverableError(error, action);
    }
  }

  async function stopRecording(action = null) {
    if (!recording) return;
    try {
      await host.command("stopRecording");
    } catch (error) {
      await surfaceRecoverableError(error, action);
    }
  }

  async function stopAll(action = null) {
    const hadKnownState = Boolean(recording || playback);
    const options = hadKnownState ? { timeoutMs: 3000 } : { skipEnsure: true, timeoutMs: 1500 };
    const errors = [];
    try { await host.command("stopRecording", {}, options); }
    catch (error) { if (hadKnownState) errors.push(error); }
    try { await host.command("stopPlayback", {}, { skipEnsure: true, timeoutMs: 1500 }); }
    catch (error) { if (hadKnownState) errors.push(error); }
    if (errors.length) {
      lastError = errors.map((error) => String(error?.message || error)).join(" · ");
      await action?.showAlert?.().catch(() => {});
    }
    await renderAll();
    await broadcastInspectors();
  }

  async function startPlayback(record) {
    const macro = macroFor(record);
    if (!macro?.events?.length) {
      lastError = "No macro is assigned to this Play key. Record a workflow first, or choose one from Macro Library in the Play key settings.";
      await renderAll();
      await broadcastInspectors();
      await record.action.showAlert?.().catch(() => {});
      return;
    }
    const settings = playbackSettings(record.settings, { pro });
    const safetyError = playbackSafetyError(macro, settings);
    if (safetyError) {
      lastError = safetyError;
      await renderAll();
      await broadcastInspectors();
      await record.action.showAlert?.().catch(() => {});
      return;
    }
    if (settings.mode === "toggle" && playback?.actionId === record.id) {
      await stopPlayback(record.action);
      return;
    }
    if (playback) await stopPlayback(record.action);
    if (recording) await stopRecording(record.action);
    playback = { actionId: record.id, macro, mode: settings.mode };
    lastError = "";
    await renderAll();
    try {
      await host.command("play", {
        events: macro.events,
        speed: settings.speed,
        repeatCount: settings.repeatCount,
        coordinateMode: settings.coordinateMode,
      });
    } catch (error) {
      playback = null;
      lastError = String(error?.message || error);
      await renderAll();
      await broadcastInspectors();
      await record.action.showAlert?.().catch(() => {});
    }
  }

  async function stopPlayback(action = null) {
    const knownPlayback = Boolean(playback);
    let stopError = null;
    try {
      await host.command("stopPlayback", {}, knownPlayback ? { timeoutMs: 3000 } : { skipEnsure: true, timeoutMs: 1500 });
    } catch (error) {
      stopError = error;
      if (knownPlayback) lastError = String(error?.message || error);
    }
    playback = null;
    await renderAll();
    await broadcastInspectors();
    if (knownPlayback && stopError) await action?.showAlert?.().catch(() => {});
  }

  class MacroAction extends SingletonAction {
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
        settings: settingsFor(this.kind, ev.payload?.settings),
        inspectorOpen: false,
      };
      visible.set(id, record);
      try {
        if (pro && this.kind === "replay" && record.settings.macroId && !library.get(record.settings.macroId)) {
          const next = { ...record.settings, macroId: "" };
          await ev.action.setSettings(next);
          record.settings = settingsFor(this.kind, next);
        }
        if (pro && this.kind === "replay" && !record.settings.macroId && record.settings.seedMacro) {
          const seed = record.settings.seedMacro;
          const stored = await library.ensure(seed);
          const next = { ...record.settings, macroId: stored.id };
          delete next.seedMacro;
          await ev.action.setSettings(next);
          record.settings = settingsFor(this.kind, next);
        }
      } catch (error) {
        await surfaceRecoverableError(error, record.action);
      }
      await render(record);
    }

    async onWillDisappear(ev) {
      const id = String(ev.action?.id || "");
      const record = visible.get(id);
      if (record?.kind === "replay" && playback?.actionId === id && (playback.mode === "while-held" || playback.mode === "toggle")) await stopPlayback();
      visible.delete(id);
    }

    async onDidReceiveSettings(ev) {
      const record = visible.get(String(ev.action?.id || ""));
      if (!record) return;
      record.settings = settingsFor(record.kind, ev.payload?.settings);
      await render(record);
      if (record.inspectorOpen) await sendInspector(record);
    }

    async onPropertyInspectorDidAppear(ev) {
      const record = visible.get(String(ev.action?.id || ""));
      if (!record) return;
      record.inspectorOpen = true;
      await sendInspector(record);
    }

    onPropertyInspectorDidDisappear(ev) {
      const record = visible.get(String(ev.action?.id || ""));
      if (record) record.inspectorOpen = false;
    }

    async onSendToPlugin(ev) {
      const record = visible.get(String(ev.action?.id || ""));
      if (!record) return;
      const payload = ev.payload || {};
      if (payload.type === "macroRecorder.inspect") return sendInspector(record);
      if (payload.type !== "macroRecorder.command") return;
      const command = String(payload.command || "");
      lastError = "";
      try {
        if (command === "cancelRecording") await cancelRecording(record.action);
        else if (command === "stopPlayback") await stopPlayback(record.action);
        else if (command === "stopAll") await stopAll(record.action);
        else if (command === "assignLatest" && !pro && latestMacro) {
          const next = { ...record.settings, macro: normalizeMacro(latestMacro, { pro:false, limits }) };
          await record.action.setSettings(next);
          record.settings = settingsFor("replay", next);
        } else if (command === "saveLiteMacro" && !pro) {
          const next = { ...record.settings, macro: normalizeMacro(payload.macro, { pro:false, limits }) };
          await record.action.setSettings(next);
          record.settings = settingsFor("replay", next);
        } else if (command === "selectMacro" && pro) {
          const next = { ...record.settings, macroId: String(payload.macroId || "") };
          await record.action.setSettings(next);
          record.settings = settingsFor("replay", next);
        } else if (command === "saveMacro" && pro) {
          await library.update(String(payload.macroId || record.settings.macroId), payload.macro || {});
          await renderAll();
        } else if (command === "deleteMacro" && pro) {
          const id = String(payload.macroId || record.settings.macroId);
          await library.remove(id);
          await Promise.all([...visible.values()]
            .filter((item) => item.kind === "replay" && item.settings.macroId === id)
            .map(async (item) => {
              const next = { ...item.settings, macroId: "" };
              await item.action.setSettings(next);
              item.settings = settingsFor("replay", next);
            }));
          await renderAll();
        } else if (command === "duplicateMacro" && pro) {
          const macro = library.get(String(payload.macroId || record.settings.macroId));
          if (macro) {
            const copy = await library.add({ ...macro, id: undefined, createdAt: undefined, updatedAt: undefined, name: `${macro.name} Copy` });
            const next = { ...record.settings, macroId: copy.id };
            await record.action.setSettings(next);
            record.settings = settingsFor("replay", next);
          }
        } else if (command === "importMacro" && pro) {
          const imported = importEnvelope(payload.data);
          const stored = await library.add({ ...imported, id: undefined });
          const next = { ...record.settings, macroId: stored.id };
          await record.action.setSettings(next);
          record.settings = settingsFor("replay", next);
        } else if (command === "exportMacro" && pro) {
          const macro = library.get(String(payload.macroId || record.settings.macroId));
          if (macro) await record.action.sendToPropertyInspector({ type:"macroRecorder.export", filename:`${macro.name.replace(/[^a-z0-9-_]+/gi,"-").replace(/^-+|-+$/g,"") || "macro"}.packrat-macro.json`, data: exportEnvelope(macro) });
        }
        await render(record);
        await broadcastInspectors();
      } catch (error) {
        lastError = String(error?.message || error);
        await record.action.showAlert?.().catch(() => {});
        await sendInspector(record);
      }
    }

    async onKeyDown(ev) {
      const record = visible.get(String(ev.action?.id || ""));
      if (!record) return;
      if (record.kind === "record") return startRecording(record);
      if (record.kind === "stop") return stopAll(record.action);
      if (record.kind === "replay") return startPlayback(record);
    }

    async onKeyUp(ev) {
      const record = visible.get(String(ev.action?.id || ""));
      if (!record || record.kind !== "replay" || !pro) return;
      const settings = playbackSettings(record.settings, { pro:true });
      if (settings.mode === "while-held" && playback?.actionId === record.id) await stopPlayback(record.action);
    }
  }

  for (const [kind, uuid] of Object.entries(ids)) streamDeck.actions.registerAction(new MacroAction(uuid, kind));

  let terminating = false;
  async function terminate(error, exitCode) {
    if (terminating) return;
    terminating = true;
    if (error) {
      lastError = String(error?.stack || error);
      streamDeck.logger?.error?.(lastError);
    }
    try { await host.close(); } catch {}
    process.exit(exitCode);
  }

  process.on("uncaughtException", (error) => { void terminate(error, 1); });
  process.on("unhandledRejection", (error) => { void terminate(error, 1); });
  process.once("SIGTERM", () => { void terminate(null, 0); });
  process.once("SIGINT", () => { void terminate(null, 0); });

  await streamDeck.connect();
}