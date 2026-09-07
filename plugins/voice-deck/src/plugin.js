import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import { AvatarCache } from "./avatar-cache.js";
import { clamp, normalizeAccent, speakingCount } from "./model.js";
import { dialFeedback, memberForAction, renderKey } from "./render.js";
import { VoiceSession } from "./voice-session.js";

const BUILD_VERSION = "1.0.0.0";
const ACTIONS = {
  status: "com.packrat.voice-deck.status",
  mute: "com.packrat.voice-deck.mute",
  deafen: "com.packrat.voice-deck.deafen",
  combined: "com.packrat.voice-deck.mute-deafen",
  channel: "com.packrat.voice-deck.channel",
  member: "com.packrat.voice-deck.member",
  "member-slot": "com.packrat.voice-deck.member-slot",
  spotlight: "com.packrat.voice-deck.spotlight",
  activity: "com.packrat.voice-deck.activity",
  count: "com.packrat.voice-deck.member-count",
  connection: "com.packrat.voice-deck.connection",
  navigator: "com.packrat.voice-deck.navigator",
};

const DEFAULT_SETTINGS = Object.freeze({
  displayMode: "detailed",
  showAvatar: true,
  showDisplayName: true,
  showChannel: true,
  showServer: true,
  ordering: "stable",
  slotIndex: 1,
  speakingAnimation: false,
  accent: "#2BE86A",
  fallbackInitials: true,
  combinedBehavior: "tap-mute-hold-deafen",
  channelPressBehavior: "refresh",
});

function normalizeSettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    displayMode: source.displayMode === "compact" ? "compact" : "detailed",
    showAvatar: source.showAvatar !== false,
    showDisplayName: source.showDisplayName !== false,
    showChannel: source.showChannel !== false,
    showServer: source.showServer !== false,
    ordering: source.ordering === "speaking-first" ? "speaking-first" : "stable",
    slotIndex: clamp(source.slotIndex ?? 1, 1, 50),
    speakingAnimation: source.speakingAnimation === true,
    accent: normalizeAccent(source.accent),
    fallbackInitials: source.fallbackInitials !== false,
    combinedBehavior: source.combinedBehavior === "tap-deafen-hold-mute" ? "tap-deafen-hold-mute" : "tap-mute-hold-deafen",
    channelPressBehavior: source.channelPressBehavior === "cycle-display" ? "cycle-display" : "refresh",
    memberId: String(source.memberId || ""),
  };
}

function safeSnapshotForInspector(snapshot) {
  return {
    buildVersion: BUILD_VERSION,
    connection: {
      ready: Boolean(snapshot?.discord?.ready),
      authenticated: Boolean(snapshot?.discord?.authenticated),
      handshake: snapshot?.discord?.handshake || "idle",
      authStage: snapshot?.auth?.stage || "idle",
      pipe: snapshot?.discord?.pipe || null,
      error: snapshot?.auth?.lastError || snapshot?.error || null,
    },
    guild: snapshot?.guild ? { id: String(snapshot.guild.id || ""), name: String(snapshot.guild.name || "") } : null,
    channel: snapshot?.channel ? { id: String(snapshot.channel.id || ""), name: String(snapshot.channel.name || "") } : null,
    voice: { mute: Boolean(snapshot?.voice?.mute), deaf: Boolean(snapshot?.voice?.deaf) },
    members: (snapshot?.members || []).map((member) => ({
      id: member.id,
      displayName: member.displayName,
      username: member.username,
      speaking: Boolean(member.speaking),
      mute: Boolean(member.mute),
      deaf: Boolean(member.deaf),
      self: Boolean(member.self),
    })),
  };
}

function logger(message) {
  try { streamDeck.logger.error(String(message)); } catch {}
}

function infoLogger(message) {
  try { streamDeck.logger.info(String(message)); } catch {}
}

const session = new VoiceSession({ log: logger });
const avatars = new AvatarCache();
const visible = new Map();
let latest = session.snapshot();
let renderTimer = null;
let pulsePhase = false;

function scheduleRender(delay = 30) {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    void renderAll();
  }, delay);
}

async function waitForCurrentConnection(timeoutMs = 8000) {
  if (!session.connecting) return;
  const deadline = Date.now() + timeoutMs;
  while (session.connecting && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function ensureSessionReady() {
  await waitForCurrentConnection();
  const ready = await session.ensureReady();
  if (!ready && session.connecting) {
    await waitForCurrentConnection();
    return session.ensureReady();
  }
  return ready;
}

async function sendInspector(record) {
  try {
    await record.action.sendToPropertyInspector({
      type: "voiceDeck.state",
      action: record.kind,
      snapshot: safeSnapshotForInspector(latest),
    });
  } catch {}
}

function selectedNavigatorMember(record) {
  const members = Array.isArray(latest.members) ? latest.members : [];
  if (!members.length) return null;
  record.navIndex = Math.max(0, Math.min(members.length - 1, Number(record.navIndex || 0)));
  return members[record.navIndex] || null;
}

async function renderRecord(record) {
  if (!record?.action) return;
  if (record.action.isDial?.()) {
    const member = selectedNavigatorMember(record);
    const feedback = dialFeedback(latest, member);
    const signature = JSON.stringify(feedback);
    if (signature !== record.lastFeedback) {
      record.lastFeedback = signature;
      await record.action.setFeedback(feedback).catch(logger);
    }
    return;
  }
  if (!record.action.isKey?.()) return;

  const options = { pulsePhase };
  if (["member", "member-slot", "spotlight"].includes(record.kind)) {
    const member = memberForAction(record.kind, latest, record.settings);
    if (member?.avatarUrl && record.settings.showAvatar) {
      options.avatarData = avatars.peek(member.avatarUrl);
      if (!options.avatarData) {
        void avatars.get(member.avatarUrl).then((value) => {
          if (value && visible.has(record.id)) scheduleRender(0);
        });
      }
    }
  }

  const image = renderKey(record.kind, latest, record.settings, options);
  if (image === record.lastImage) return;
  record.lastImage = image;
  await record.action.setImage(image).catch(logger);
}

async function renderAll() {
  const jobs = [];
  for (const record of visible.values()) jobs.push(renderRecord(record));
  await Promise.allSettled(jobs);
  for (const record of visible.values()) {
    if (record.inspectorOpen) void sendInspector(record);
  }
}

async function runControl(record, control) {
  try {
    const ready = await ensureSessionReady();
    if (!ready) return;
    if (control === "mute") await session.toggleMute();
    else if (control === "deafen") await session.toggleDeafen();
    else if (control === "refresh") await session.refresh();
    if (record?.action?.isKey?.()) await record.action.showOk().catch(() => {});
  } catch (error) {
    logger(error?.stack || error?.message || error);
  }
}

async function handleConnectionPress(record) {
  try {
    const ready = await ensureSessionReady();
    if (ready && session.snapshot().discord?.authenticated) await session.refresh();
    if (record?.action?.isKey?.()) await record.action.showOk().catch(() => {});
  } catch (error) {
    logger(error?.stack || error?.message || error);
  }
}

class VoiceDeckAction extends SingletonAction {
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
      settings: normalizeSettings(ev.payload?.settings),
      lastImage: "",
      lastFeedback: "",
      navIndex: 0,
      longTimer: null,
      longTriggered: false,
      inspectorOpen: false,
    };
    visible.set(id, record);
    if (ev.action?.isDial?.()) {
      await ev.action.setTriggerDescription({
        push: "Toggle mute",
        rotate: "Browse voice members",
        touch: "Toggle deafen",
      }).catch(logger);
    }
    await renderRecord(record);
  }

  onWillDisappear(ev) {
    const id = String(ev.action?.id || "");
    const record = visible.get(id);
    if (record?.longTimer) clearTimeout(record.longTimer);
    visible.delete(id);
  }

  async onDidReceiveSettings(ev) {
    const id = String(ev.action?.id || "");
    const record = visible.get(id);
    if (!record) return;
    record.settings = normalizeSettings(ev.payload?.settings);
    record.lastImage = "";
    await renderRecord(record);
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
    if (payload.type === "voiceDeck.inspect") {
      await sendInspector(record);
      return;
    }
    if (payload.type !== "voiceDeck.command") return;
    const command = String(payload.command || "");
    if (command === "authorize") await ensureSessionReady();
    else if (command === "reconnect") {
      try { session.discord.disconnect("manual reconnect"); } catch {}
      await ensureSessionReady();
    } else if (command === "refresh") await session.refresh();
    await sendInspector(record);
  }

  async onKeyDown(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    if (record.kind === "mute") return runControl(record, "mute");
    if (record.kind === "deafen") return runControl(record, "deafen");
    if (record.kind === "connection") return handleConnectionPress(record);
    if (record.kind === "combined") {
      record.longTriggered = false;
      if (record.longTimer) clearTimeout(record.longTimer);
      const longControl = record.settings.combinedBehavior === "tap-deafen-hold-mute" ? "mute" : "deafen";
      record.longTimer = setTimeout(() => {
        record.longTimer = null;
        record.longTriggered = true;
        void runControl(record, longControl);
      }, 650);
      return;
    }
    if (record.kind === "channel" && record.settings.channelPressBehavior === "cycle-display") {
      const next = { ...record.settings, displayMode: record.settings.displayMode === "compact" ? "detailed" : "compact" };
      record.settings = normalizeSettings(next);
      await ev.action.setSettings(next);
      await renderRecord(record);
      return;
    }
    return runControl(record, "refresh");
  }

  async onKeyUp(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record || record.kind !== "combined") return;
    if (record.longTimer) {
      clearTimeout(record.longTimer);
      record.longTimer = null;
    }
    if (record.longTriggered) {
      record.longTriggered = false;
      return;
    }
    const shortControl = record.settings.combinedBehavior === "tap-deafen-hold-mute" ? "deafen" : "mute";
    await runControl(record, shortControl);
  }

  async onDialDown(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (record) await runControl(record, "mute");
  }

  async onDialRotate(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    const members = Array.isArray(latest.members) ? latest.members : [];
    if (!members.length) {
      record.navIndex = 0;
      await renderRecord(record);
      return;
    }
    const ticks = Number(ev.payload?.ticks || 0);
    if (ticks !== 0) {
      const delta = ticks > 0 ? 1 : -1;
      record.navIndex = (Number(record.navIndex || 0) + delta + members.length) % members.length;
      record.lastFeedback = "";
      await renderRecord(record);
    }
  }

  async onTouchTap(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (record) await runControl(record, "deafen");
  }
}

for (const [kind, manifestId] of Object.entries(ACTIONS)) {
  streamDeck.actions.registerAction(new VoiceDeckAction(manifestId, kind));
}

session.on("state", (snapshot) => {
  latest = snapshot;
  scheduleRender();
});

session.discord.on("handshake", (info) => {
  const stage = String(info?.stage || "unknown");
  if (!["preferred_pipe", "pipe_opened", "ready", "failed", "scan_complete"].includes(stage)) return;
  const detail = [
    `stage=${stage}`,
    info?.pipe ? `pipe=${info.pipe}` : null,
    info?.username ? `user=${info.username}` : null,
    info?.environment ? `env=${info.environment}` : null,
    info?.error ? `error=${info.error}` : null,
  ].filter(Boolean).join(" ");
  infoLogger(`[Discord IPC] ${detail}`);
});

session.discord.on("ready", (data) => {
  const username = data?.user?.username ? String(data.user.username) : "unknown";
  const environment = data?.config?.environment ? String(data.config.environment) : "unknown";
  infoLogger(`[Discord IPC] READY pipe=${session.discord.pipe || "unknown"} user=${username} env=${environment}`);
});

session.discord.on("rpcClose", (info) => {
  infoLogger(`[Discord IPC] CLOSE ${String(info?.message || "unknown")}`);
});

session.discord.on("rpcError", (info) => {
  infoLogger(`[Discord IPC] RPC_ERROR ${JSON.stringify(info || {})}`);
});

setInterval(() => {
  const needsAnimation = speakingCount(latest.members) > 0 && Array.from(visible.values()).some((record) => record.settings.speakingAnimation);
  if (!needsAnimation) return;
  pulsePhase = !pulsePhase;
  scheduleRender(0);
}, 420).unref?.();

process.on("uncaughtException", (error) => logger(error?.stack || error));
process.on("unhandledRejection", (error) => logger(error?.stack || error));

async function main() {
  streamDeck.system.onSystemDidWakeUp(() => void session.connect());
  await streamDeck.connect();
  await session.connect();
}

main().catch((error) => {
  logger(error?.stack || error?.message || error);
  process.exitCode = 1;
});
