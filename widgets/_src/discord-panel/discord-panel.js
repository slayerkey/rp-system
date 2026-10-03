var VOICE_BRIDGE_MARKETPLACE_URL = "https://marketplace.elgato.com/product/packrat-voice-bridge-b39501ef-6626-4807-9659-4103d9cc3db6";
var VOICE_BRIDGE_HELP_STORAGE_KEY = "packrat.discord-panel.bridge-help-dismissed.v1";

function openExternalLink(url) {
  try {
    if (window.plugins && window.plugins.Linkprovider &&
        typeof pluginLinkprovider_initialized !== "undefined" && pluginLinkprovider_initialized) {
      window.plugins.Linkprovider.open(url);
      return true;
    }
  } catch (error) {}
  try { window.open(url, "_blank"); return true; } catch (error) {}
  return false;
}

function bridgeHelpDismissed() {
  try { return localStorage.getItem(VOICE_BRIDGE_HELP_STORAGE_KEY) === "1"; }
  catch (error) { return false; }
}

function applyBridgeHelpDismissal() {
  document.body.classList.toggle("bridge-help-dismissed", bridgeHelpDismissed());
}

function dismissBridgeHelp() {
  try { localStorage.setItem(VOICE_BRIDGE_HELP_STORAGE_KEY, "1"); } catch (error) {}
  document.body.classList.add("bridge-help-dismissed");
}

function startFixture(fixture) {
  fixtureMode = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  model.account = fixture && fixture.user ? fixture.user : { username: "Discord User" };
  model.voice = {
    mute: Boolean(fixture && fixture.voice && fixture.voice.mute),
    deaf: Boolean(fixture && fixture.voice && fixture.voice.deaf)
  };
  model.activity = Array.isArray(fixture && fixture.activity) ? fixture.activity.slice(0, 8) : [];
  setChannel(fixture && fixture.channel ? fixture.channel : null);
  var speaking = Array.isArray(fixture && fixture.speaking) ? fixture.speaking : [];
  speaking.forEach(function (userId) {
    var member = findMember(userId);
    if (member) member.speaking = true;
  });
  if (fixture && fixture.state && fixture.state !== "voice" && fixture.state !== "idle") setState(String(fixture.state));
  render();
}

function installTestHooks() {
  globalThis.__PACKRAT_DISCORD_TEST__ = {
    getState: function () {
      return {
        state: model.state,
        channel: model.channel ? { id: model.channel.id, name: model.channel.name } : null,
        members: model.members.map(function (entry) {
          return {
            id: currentUserId(entry),
            name: displayName(entry),
            speaking: Boolean(entry.speaking),
            voice: stateOf(entry)
          };
        }),
        voice: { mute: model.voice.mute, deaf: model.voice.deaf },
        activityCount: model.activity.length,
        slot: document.body.getAttribute("data-slot")
      };
    },
    speaking: function (userId, active) { setSpeaking(String(userId), Boolean(active)); },
    voiceState: function (raw) { upsertVoiceState(raw); render(); },
    remove: function (raw) { removeVoiceState(raw); render(); },
    channel: function (channel) { setChannel(channel || null); },
    snapshot: function (snapshot) { applyBridgeSnapshot(snapshot || null); },
    selfVoice: function (voice) {
      if (voice && typeof voice.mute === "boolean") model.voice.mute = voice.mute;
      if (voice && typeof voice.deaf === "boolean") model.voice.deaf = voice.deaf;
      renderControls();
    }
  };
}

function refreshIcueSettings() {
  try {
    if (typeof globalThis.__ratpackIcueSyncGlobals === "function") globalThis.__ratpackIcueSyncGlobals();
    applySettings();
  } catch (error) {
    try { console.error("PackRat Voice Panel iCUE settings refresh failed", error); } catch (ignored) { }
  }
}

function installIcueLifecycle() {
  var events = null;
  try { events = globalThis.icueEvents; } catch (error) { events = null; }
  if (!events || typeof events !== "object") events = {};
  events.onICUEInitialized = refreshIcueSettings;
  events.onDataUpdated = refreshIcueSettings;
  globalThis.icueEvents = events;
}

function boot() {
  if (liveStarted) return;
  liveStarted = true;
  applyBridgeHelpDismissal();
  installIcueLifecycle();
  applySlot();
  refreshIcueSettings();
  installTestHooks();
  loadTranslations();

  var fixture = null;
  try { fixture = globalThis.__PACKRAT_DISCORD_FIXTURE__ || null; } catch (error) { fixture = null; }
  if (fixture) startFixture(fixture);
  else startLiveConnection();
}

document.getElementById("installBridgeButton").addEventListener("click", function () {
  openExternalLink(VOICE_BRIDGE_MARKETPLACE_URL);
});
document.getElementById("dismissBridgeHelp").addEventListener("click", dismissBridgeHelp);
document.getElementById("authorizeButton").addEventListener("click", beginAuthorization);
document.getElementById("muteButton").addEventListener("click", function () { setSelfVoice("mute", !model.voice.mute); });
document.getElementById("deafenButton").addEventListener("click", function () { setSelfVoice("deaf", !model.voice.deaf); });
document.getElementById("detailClose").addEventListener("click", closeMemberDetail);
window.addEventListener("resize", applySlot);
window.addEventListener("click", function (event) {
  var sheet = document.getElementById("memberDetail");
  if (!sheet.classList.contains("open")) return;
  if (sheet.contains(event.target)) return;
  if (event.target.closest && event.target.closest(".member-row")) return;
  closeMemberDetail();
});

setInterval(function () {
  refreshIcueSettings();
  if (model.activity.length) renderActivity();
  if (!fixtureMode && (!rpcSocket || rpcSocket.readyState !== WebSocket.OPEN)) startLiveConnection();
}, 1000);

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
