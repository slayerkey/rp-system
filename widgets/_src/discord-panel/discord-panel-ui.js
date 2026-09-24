/* PackRat Voice Panel UI and state layer for XENEON Edge.
 * Live Discord transport is owned by discord-panel-rpc.js and talks only to
 * the local PackRat Voice Bridge on ws://127.0.0.1:17483.
 */

var SPEAKER_HOLD_MS = 900;

var SLOT_SPECS = [
  { id: "s-h", w: 840, h: 344 },
  { id: "s-v", w: 696, h: 416 },
  { id: "m-h", w: 840, h: 696 },
  { id: "m-v", w: 696, h: 840 },
  { id: "l-h", w: 1688, h: 696 },
  { id: "l-v", w: 696, h: 1688 },
  { id: "xl-h", w: 2536, h: 696 },
  { id: "xl-v", w: 696, h: 2536 }
];

var rpcSocket = null;
var reconnectTimer = null;
var liveStarted = false;
var fixtureMode = false;
var copy = {};

var model = {
  state: "setup",
  account: null,
  channel: null,
  members: [],
  voice: { mute: false, deaf: false },
  activity: [],
  detailUserId: null
};

function getIcueProperty(name, fallback) {
  try {
    var value = globalThis[name];
    if (typeof Node !== "undefined" && value instanceof Node) return fallback;
    if (value === undefined || value === null) return fallback;
    return value;
  } catch (error) {
    return fallback;
  }
}

function readSettings() {
  return {
    showRecent: getIcueProperty("showRecentActivity", true) !== false,
    text: String(getIcueProperty("textColor", "#F4F6F8") || "#F4F6F8"),
    accent: String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A"),
    background: String(getIcueProperty("backgroundColor", "#090B10") || "#090B10")
  };
}

function applySettings() {
  var cfg = readSettings();
  document.documentElement.style.setProperty("--text", cfg.text);
  document.documentElement.style.setProperty("--accent", cfg.accent);
  document.documentElement.style.setProperty("--bg", cfg.background);
  document.body.classList.toggle("recent-off", !cfg.showRecent);
  renderActivity();
}

async function t(key) {
  try {
    if (typeof tr === "function") {
      var value = await tr(key);
      if (value !== undefined && value !== null && String(value)) return String(value);
    }
  } catch (error) { }
  return key;
}

async function loadTranslations() {
  var keys = [
    "PackRat Voice Panel",
    "VOICE CHANNEL",
    "Connecting to Discord",
    "The panel will update automatically.",
    "Discord authorization required",
    "Connect Discord",
    "Not in a voice channel",
    "member",
    "members",
    "Mute",
    "Unmute",
    "Deafen",
    "Undeafen",
    "Mute microphone",
    "Unmute microphone",
    "Deafen audio",
    "Undeafen audio",
    "RECENT ACTIVITY",
    "Recent activity",
    "No recent speakers yet",
    "Speaking",
    "Muted",
    "Deafened",
    "Listening",
    "Close details",
    "Account",
    "Voice channel members",
    "Unknown member",
    "No username available",
    "Disconnected",
    "Connected",
    "Authorization failed",
    "Voice",
    "Show Recent Activity",
    "Recent speaking activity stays in memory only for this widget session.",
    "Appearance",
    "Text Color",
    "Accent Color",
    "Background Color"
  ];
  var values = await Promise.all(keys.map(function (key) { return t(key); }));
  for (var index = 0; index < keys.length; index += 1) copy[keys[index]] = values[index];
  document.getElementById("stage").setAttribute("aria-label", copy["PackRat Voice Panel"] || "PackRat Voice Panel");
  document.getElementById("roster").setAttribute("aria-label", copy["Voice channel members"] || "Voice channel members");
  document.getElementById("activityPanel").setAttribute("aria-label", copy["Recent activity"] || "Recent activity");
  document.getElementById("accountChip").setAttribute("aria-label", copy["Account"] || "Account");
  document.getElementById("detailClose").setAttribute("aria-label", copy["Close details"] || "Close details");
  render();
}

function nearestSlot() {
  var width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
  var height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
  var best = SLOT_SPECS[0];
  var score = Infinity;
  for (var index = 0; index < SLOT_SPECS.length; index += 1) {
    var spec = SLOT_SPECS[index];
    var next = Math.abs(Math.log(width / spec.w)) + Math.abs(Math.log(height / spec.h));
    if (next < score) {
      score = next;
      best = spec;
    }
  }
  return best.id;
}

function applySlot() {
  document.body.setAttribute("data-slot", nearestSlot());
}

function setState(nextState) {
  model.state = nextState;
  document.body.setAttribute("data-state", nextState);
  render();
}

function initials(value) {
  var parts = String(value || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function currentUserId(raw) {
  if (!raw) return "";
  if (raw.user && raw.user.id) return String(raw.user.id);
  if (raw.user_id) return String(raw.user_id);
  return "";
}

function displayName(raw) {
  if (!raw) return copy["Unknown member"] || "Unknown member";
  if (raw.nick) return String(raw.nick);
  if (raw.user && raw.user.global_name) return String(raw.user.global_name);
  if (raw.user && raw.user.username) return String(raw.user.username);
  return copy["Unknown member"] || "Unknown member";
}

function username(raw) {
  if (!raw || !raw.user || !raw.user.username) return copy["No username available"] || "No username available";
  if (raw.user.discriminator && raw.user.discriminator !== "0") return raw.user.username + "#" + raw.user.discriminator;
  return "@" + raw.user.username;
}

function stateOf(raw) {
  var state = raw && raw.voice_state ? raw.voice_state : raw || {};
  return {
    mute: Boolean(state.mute || state.self_mute),
    deaf: Boolean(state.deaf || state.self_deaf)
  };
}

function normalizeMember(raw, order) {
  var entry = raw || {};
  var user = entry.user || (entry.voice_state && entry.voice_state.user) || {};
  var voice = entry.voice_state || entry;
  return {
    user: user,
    user_id: user.id || entry.user_id || voice.user_id || "",
    nick: entry.nick || voice.nick || user.global_name || user.username || "",
    voice_state: voice,
    speaking: Boolean(entry.speaking),
    speakerHoldUntil: Number(entry.speakerHoldUntil) || 0,
    _order: Number(order) || 0
  };
}

function speakerPriority(raw) {
  if (raw.speaking) return 2;
  if (raw.speakerHoldUntil > Date.now()) return 1;
  return 0;
}

function sortedMembers() {
  return model.members.slice().sort(function (left, right) {
    var delta = speakerPriority(right) - speakerPriority(left);
    if (delta) return delta;
    return left._order - right._order;
  });
}

function avatarUrl(raw) {
  if (!raw || !raw.user || !raw.user.id || !raw.user.avatar) return "";
  return "https://cdn.discordapp.com/avatars/" + encodeURIComponent(raw.user.id) + "/" + encodeURIComponent(raw.user.avatar) + ".png?size=128";
}

function avatarNode(raw, className) {
  var node = document.createElement("div");
  node.className = className || "avatar";
  node.textContent = initials(displayName(raw));
  var src = avatarUrl(raw);
  if (!src) return node;
  var image = document.createElement("img");
  image.alt = "";
  image.decoding = "async";
  image.src = src;
  image.addEventListener("load", function () {
    node.textContent = "";
    node.appendChild(image);
  }, { once: true });
  return node;
}

function statusIcon(kind) {
  var span = document.createElement("span");
  span.className = "state-icon " + kind;
  span.setAttribute("aria-hidden", "true");
  if (kind === "mute") span.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M9.5 9.5V6a2.5 2.5 0 0 1 5 0v6c0 .4-.1.8-.2 1.1M5 11v1a7 7 0 0 0 11.2 5.6M12 19v3M9 22h6" /></svg>';
  else span.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 13v-2a8 8 0 0 1 13.7-5.6M20 13h-3v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2zM4 13h3v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2zM3 3l18 18" /></svg>';
  return span;
}

function openMemberDetail(userId) {
  model.detailUserId = String(userId || "");
  renderMemberDetail();
}

function closeMemberDetail() {
  model.detailUserId = null;
  renderMemberDetail();
}

function renderMemberDetail() {
  var sheet = document.getElementById("memberDetail");
  var member = model.detailUserId ? findMember(model.detailUserId) : null;
  if (!member) {
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    return;
  }
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
  var avatar = document.getElementById("detailAvatar");
  avatar.replaceChildren(avatarNode(member, "detail-avatar-inner"));
  document.getElementById("detailDisplayName").textContent = displayName(member);
  document.getElementById("detailUsername").textContent = username(member);
  var states = [];
  var voice = stateOf(member);
  if (member.speaking) states.push(copy["Speaking"] || "Speaking");
  if (voice.mute) states.push(copy["Muted"] || "Muted");
  if (voice.deaf) states.push(copy["Deafened"] || "Deafened");
  if (!states.length) states.push(copy["Listening"] || "Listening");
  document.getElementById("detailStates").textContent = states.join("  •  ");
}

function renderRoster() {
  var roster = document.getElementById("roster");
  roster.replaceChildren();
  sortedMembers().forEach(function (member) {
    var row = document.createElement("button");
    row.className = "member-row interactive" + (member.speaking ? " speaking" : "");
    row.type = "button";
    row.setAttribute("role", "listitem");
    row.addEventListener("click", function () { openMemberDetail(currentUserId(member)); });

    var avatarWrap = document.createElement("div");
    avatarWrap.className = "avatar-wrap";
    avatarWrap.appendChild(avatarNode(member, "avatar"));
    var ring = document.createElement("span");
    ring.className = "speaker-ring";
    ring.setAttribute("aria-hidden", "true");
    avatarWrap.appendChild(ring);

    var name = document.createElement("span");
    name.className = "member-name";
    name.textContent = displayName(member);

    var states = document.createElement("span");
    states.className = "member-states";
    var voice = stateOf(member);
    if (voice.mute) states.appendChild(statusIcon("mute"));
    if (voice.deaf) states.appendChild(statusIcon("deaf"));

    row.appendChild(avatarWrap);
    row.appendChild(name);
    row.appendChild(states);
    roster.appendChild(row);
  });
}

function renderActivity() {
  var list = document.getElementById("activityList");
  if (!list) return;
  list.replaceChildren();
  var cfg = readSettings();
  var items = cfg.showRecent ? model.activity.slice(0, 6) : [];
  items.forEach(function (entry) {
    var li = document.createElement("li");
    li.className = "activity-item";
    var name = document.createElement("span");
    name.className = "activity-name";
    name.textContent = entry.name;
    var age = document.createElement("span");
    age.className = "activity-age";
    var seconds = Math.max(0, Math.round((Date.now() - entry.at) / 1000));
    age.textContent = seconds < 2 ? "now" : seconds + "s";
    li.appendChild(name);
    li.appendChild(age);
    list.appendChild(li);
  });
  document.getElementById("activityCount").textContent = String(items.length);
  document.getElementById("activityEmpty").style.display = items.length ? "none" : "block";
}

function renderControls() {
  var mute = document.getElementById("muteButton");
  var deafen = document.getElementById("deafenButton");
  var enabled = model.state === "voice";
  mute.disabled = !enabled;
  deafen.disabled = !enabled;
  mute.classList.toggle("active", model.voice.mute);
  deafen.classList.toggle("active", model.voice.deaf);
  document.getElementById("muteLabel").textContent = model.voice.mute ? (copy["Unmute"] || "Unmute") : (copy["Mute"] || "Mute");
  document.getElementById("deafenLabel").textContent = model.voice.deaf ? (copy["Undeafen"] || "Undeafen") : (copy["Deafen"] || "Deafen");
  mute.setAttribute("aria-label", model.voice.mute ? (copy["Unmute microphone"] || "Unmute microphone") : (copy["Mute microphone"] || "Mute microphone"));
  deafen.setAttribute("aria-label", model.voice.deaf ? (copy["Undeafen audio"] || "Undeafen audio") : (copy["Deafen audio"] || "Deafen audio"));
}

function stateCopy() {
  if (model.state === "setup") return ["Starting Voice Panel", "Looking for the PackRat Voice Bridge on this PC.", false];
  if (model.state === "disconnected") return ["PackRat Voice Bridge offline", "Install the free Voice Bridge below, then keep Stream Deck and Discord open. The panel will reconnect automatically.", false];
  if (model.state === "authorization") return [copy["Discord authorization required"] || "Discord authorization required", "Tap Connect Discord once, then approve the Discord prompt.", true];
  if (model.state === "auth-failed") return [copy["Authorization failed"] || "Authorization failed", "Tap Connect Discord to retry. The bridge status page has the exact error.", true];
  return [copy["Not in a voice channel"] || "Not in a voice channel", "Join any Discord voice channel and the panel will follow automatically.", false];
}

function renderHeader() {
  var channelName = document.getElementById("channelName");
  var count = document.getElementById("memberCount");
  var account = document.getElementById("accountName");
  document.getElementById("eyebrow").textContent = copy["VOICE CHANNEL"] || "VOICE CHANNEL";
  account.textContent = model.account ? (model.account.global_name || model.account.username || "Discord") : "Discord";
  document.getElementById("accountDot").classList.toggle("connected", Boolean(rpcSocket || fixtureMode));
  if (model.state === "voice" && model.channel) {
    channelName.textContent = model.channel.name || "Voice";
    var length = model.members.length;
    count.textContent = length + " " + (length === 1 ? (copy["member"] || "member") : (copy["members"] || "members"));
  } else {
    var text = stateCopy();
    channelName.textContent = text[0];
    count.textContent = "";
  }
}

function renderEmpty() {
  var empty = document.getElementById("emptyState");
  var rosterVisible = model.state === "voice" && model.members.length > 0;
  empty.style.display = rosterVisible ? "none" : "grid";
  document.getElementById("roster").style.display = rosterVisible ? "grid" : "none";
  if (rosterVisible) return;
  var text = stateCopy();
  document.getElementById("emptyTitle").textContent = text[0];
  document.getElementById("emptyHint").textContent = text[1];
  var button = document.getElementById("authorizeButton");
  button.style.display = text[2] ? "inline-grid" : "none";
  button.textContent = copy["Connect Discord"] || "Connect Discord";
}

function render() {
  renderHeader();
  renderEmpty();
  if (model.state === "voice") renderRoster();
  else document.getElementById("roster").replaceChildren();
  renderControls();
  renderActivity();
  renderMemberDetail();
}
