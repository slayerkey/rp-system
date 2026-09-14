import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
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

function keyXml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;"
  })[ch]);
}

function packRatKeyImage(kind, title = "") {
  const fallback = kind === "record" ? "RECORD" : kind === "stop" ? "STOP" : "PLAY";
  const lines = String(title || fallback).split("\n").filter(Boolean).slice(0, 2);
  const glyph = kind === "record"
    ? '<circle cx="78" cy="58" r="24" fill="none" stroke="#FF5D6C" stroke-width="7"/>'
    : kind === "stop"
      ? '<rect x="54" y="34" width="48" height="48" rx="4" fill="#F5F7FB"/>'
      : '<path d="M58 29 L108 58 L58 87 Z" fill="#2BE86A"/>';
  const text = lines.length > 1
    ? `<text x="78" y="112" text-anchor="middle" fill="#F5F7FB" font-family="Arial,Segoe UI,sans-serif" font-size="16" font-weight="700">${keyXml(lines[0])}</text><text x="78" y="133" text-anchor="middle" fill="#9AA2AF" font-family="Arial,Segoe UI,sans-serif" font-size="15" font-weight="700">${keyXml(lines[1])}</text>`
    : `<text x="78" y="128" text-anchor="middle" fill="#F5F7FB" font-family="Arial,Segoe UI,sans-serif" font-size="${lines[0]?.length > 8 ? 15 : 18}" font-weight="700">${keyXml(lines[0] || fallback)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="20" fill="#080A0E"/><rect x="5" y="18" width="5" height="108" rx="2.5" fill="#FFB21E"/>${glyph}${text}</svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

function safeExportName(value) {
  return String(value || "macro")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "macro";
}

function exportStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
}

async function exportMacroToDownloads(macro) {
  const folder = join(homedir(), "Downloads", "PackRat Macro Recorder");
  await mkdir(folder, { recursive: true });
  const filename = `${safeExportName(macro?.name)}-${exportStamp()}.packrat-macro.json`;
  const path = join(folder, filename);
  await writeFile(path, JSON.stringify(exportEnvelope(macro), null, 2) + "\n", "utf8");
  return { filename, path };
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
  let activeInspectorId = "";
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
      until: Date.now() + 15000,
    };
    savedFeedbackTimer = setTimeout(() => {
      savedFeedback = null;
      savedFeedbackTimer = null;
      void renderAll();
      void broadcastStatus();
    }, 15000);
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
        autoLatest: pro ? source.autoLatest !== false : false,
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
    } else if (record.kind === "stop") {
      title = "STOP";
    } else if (record.kind === "replay") {
      const macro = macroFor(record);
      if (playback?.actionId === record.id) title = "PLAYING";
      else if (saved && macro?.id === saved.macroId) title = "SAVED";
      else if (macro && record.settings.seedMacro) title = shortTitle(macro.name, 12);
    }
    if (pro) {
      await record.action.setImage(packRatKeyImage(record.kind, title)).catch(() => {});
      await record.action.setTitle("").catch(() => {});
    } else {
      await record.action.setTitle(title).catch(() => {});
    }
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
      settings: record ? { ...record.settings, seedMacro: undefined } : {},
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

  async function sendPropertyInspector(payload, record = null) {
    if (pro && streamDeck.ui?.sendToPropertyInspector) {
      await streamDeck.ui.sendToPropertyInspector(payload).catch(() => {});
      return;
    }
    if (record?.action?.sendToPropertyInspector) {
      await record.action.sendToPropertyInspector(payload).catch(() => {});
    }
  }

  async function sendInspector(record) {
    if (!record) return;
    await sendPropertyInspector(await inspectorState(record), record);
  }

  async function broadcastInspectors() {
    if (pro) {
      const record = visible.get(activeInspectorId);
      if (record) await sendInspector(record);
      return;
    }
    await Promise.all([...visible.values()].filter((record) => record.inspectorOpen).map(sendInspector));
  }

  async function broadcastStatus() {
    const status = inspectorStatus();
    if (pro) {
      const record = visible.get(activeInspectorId);
      if (record) await sendPropertyInspector(status, record);
      return;
    }
    await Promise.all([...visible.values()]
      .filter((record) => record.inspectorOpen && record.action?.sendToPropertyInspector)
      .map((record) => record.action.sendToPropertyInspector(status).catch(() => {})));
  }

  async function assignNewRecordingToReplayKeys(macro) {
    if (!pro || !macro?.id) return 0;
    const targets = [...visible.values()].filter((item) =>
      item.kind === "replay" &&
      item.settings.autoLatest !== false &&
      !item.settings.seedMacro
    );
    await Promise.all(targets.map(async (item) => {
      const next = { ...item.settings, macroId: macro.id, autoLatest: true };
      delete next.seedMacro;
      await item.action.setSettings(next);
      item.settings = settingsFor("replay", next);
    }));
    return targets.length;
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
    const assignedCount = await assignNewRecordingToReplayKeys(macro);
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

  async function buildDiagnostic(record, meta = {}, client = {}) {
    const disk = pro ? await library.diagnose() : null;
    let storedSettings = null;
    let settingsError = "";
    try {
      storedSettings = await record?.action?.getSettings?.();
    } catch (error) {
      settingsError = String(error?.message || error || "");
    }

    const selectedMacroId = String(record?.settings?.macroId || "");
    const selectedMacro = selectedMacroId && pro ? library.get(selectedMacroId) : null;
    const checks = [
      { name:"PI request reached plugin", ok:true, detail:meta.transport || "unknown" },
      { name:"Selected action resolved", ok:Boolean(record), detail:record?.id || meta.requestedActionContext || "none" },
      { name:"Selected action is visible", ok:Boolean(record && visible.has(record.id)), detail:`${visible.size} visible actions` },
      { name:"Action settings readable", ok:Boolean(storedSettings && !settingsError), detail:settingsError || "settings read from Stream Deck" },
      { name:"Macro Library has entries", ok:Boolean(disk?.inMemoryCount > 0), detail:`${disk?.inMemoryCount ?? 0} macros in memory` },
      { name:"Library file exists", ok:Boolean(disk?.disk?.exists), detail:disk?.disk?.error || disk?.file || "" },
      { name:"Library file readable", ok:Boolean(disk?.disk?.readable), detail:disk?.disk?.error || "" },
      { name:"Library file parseable", ok:Boolean(disk?.disk?.parseable), detail:disk?.disk?.error || "" },
      { name:"Disk matches memory", ok:Boolean(disk?.disk?.matchesMemory), detail:`disk=${disk?.disk?.macroCount ?? 0}, memory=${disk?.inMemoryCount ?? 0}` },
      { name:"Library directory writable", ok:Boolean(disk?.writeProbe?.ok), detail:disk?.writeProbe?.error || "non-destructive write/read/delete probe passed" },
      { name:"Assigned macro resolves", ok:!selectedMacroId || Boolean(selectedMacro), detail:selectedMacroId || "no macroId assigned" },
    ];
    const failures = checks.filter((item) => !item.ok).map((item) => item.name);
    return {
      type:"macroRecorder.diagnostic",
      timestamp:new Date().toISOString(),
      edition,
      version,
      summary:failures.length ? `FAIL: ${failures.join("; ")}` : "PASS: PI transport, library storage, and selected action state are consistent.",
      checks,
      transport:{
        mode:meta.transport || "",
        requestedActionContext:meta.requestedActionContext || "",
        eventActionId:meta.eventActionId || "",
        activeInspectorId,
      },
      client,
      selectedAction:record ? {
        id:record.id,
        kind:record.kind,
        inspectorOpen:Boolean(record.inspectorOpen),
        memorySettings:{ ...record.settings, seedMacro: undefined },
        storedSettings,
        settingsError,
        resolvedMacro:selectedMacro ? {
          id:selectedMacro.id,
          name:selectedMacro.name,
          eventCount:selectedMacro.events?.length || 0,
          durationMs:selectedMacro.durationMs || 0,
        } : null,
      } : null,
      runtime:{
        visibleActions:[...visible.values()].map((item) => ({
          id:item.id,
          kind:item.kind,
          inspectorOpen:Boolean(item.inspectorOpen),
          macroId:String(item.settings?.macroId || ""),
        })),
        recording:Boolean(recording),
        playback:playback ? { actionId:playback.actionId, macroName:playback.macro?.name || "" } : null,
        latestMacro:latestMacro ? { id:latestMacro.id, name:latestMacro.name, eventCount:latestMacro.events?.length || 0 } : null,
        lastError,
      },
      library:disk ? {
        ...disk,
        entries:library.list().map((item) => ({
          id:item.id,
          name:item.name,
          eventCount:item.eventCount,
          durationMs:item.durationMs,
          updatedAt:item.updatedAt,
        })),
      } : null,
    };
  }

  async function handleUiPayload(record, payload = {}, meta = {}) {
    if (payload.type === "macroRecorder.diagnostic") {
      const diagnostic = await buildDiagnostic(record, meta, payload.client || {});
      await sendPropertyInspector(diagnostic, record);
      return;
    }
    if (!record) return;
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
        const next = { ...record.settings, macroId: String(payload.macroId || ""), autoLatest: false };
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
          const next = { ...record.settings, macroId: copy.id, autoLatest: false };
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
        if (!macro) throw new Error("Choose a macro before exporting.");
        const exported = await exportMacroToDownloads(macro);
        await sendPropertyInspector({
          type:"macroRecorder.exportSaved",
          filename:exported.filename,
          path:exported.path,
        }, record);
      }
      await render(record);
      await broadcastInspectors();
    } catch (error) {
      lastError = String(error?.message || error);
      await record.action.showAlert?.().catch(() => {});
      await sendInspector(record);
    }
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
          const next = { ...record.settings, macroId: stored.id, autoLatest: false };
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
      if (pro) return;
      const record = visible.get(String(ev.action?.id || ""));
      if (!record) return;
      record.inspectorOpen = true;
      await sendInspector(record);
    }

    onPropertyInspectorDidDisappear(ev) {
      if (pro) return;
      const record = visible.get(String(ev.action?.id || ""));
      if (record) record.inspectorOpen = false;
    }

    async onSendToPlugin(ev) {
      if (pro) return;
      const record = visible.get(String(ev.action?.id || ""));
      await handleUiPayload(record, ev.payload || {}, {
        transport:"per-action",
        eventActionId:String(ev.action?.id || ""),
      });
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

  if (pro && streamDeck.ui) {
    streamDeck.ui.onDidAppear?.((ev) => {
      const id = String(ev.action?.id || "");
      activeInspectorId = id;
      for (const item of visible.values()) item.inspectorOpen = item.id === id;
      const record = visible.get(id);
      if (record) void sendInspector(record);
    });
    streamDeck.ui.onDidDisappear?.((ev) => {
      const id = String(ev.action?.id || "");
      const record = visible.get(id);
      if (record) record.inspectorOpen = false;
      if (activeInspectorId === id) activeInspectorId = "";
    });
    streamDeck.ui.onSendToPlugin?.((ev) => {
      const payload = ev.payload || {};
      const requestedActionContext = String(payload.actionContext || "");
      const eventActionId = String(ev.action?.id || "");
      const record =
        visible.get(requestedActionContext) ||
        visible.get(eventActionId) ||
        visible.get(activeInspectorId) ||
        null;
      void handleUiPayload(record, payload, {
        transport:"global-ui",
        requestedActionContext,
        eventActionId,
      });
    });
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