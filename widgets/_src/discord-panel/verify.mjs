import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(".");
const source = path.join(repo, "widgets", "_src", "discord-panel");
const files = [
  "discord-panel-ui.js",
  "discord-panel-appearance.js",
  "discord-panel-stable-roster.js",
  "discord-panel-rpc.js",
  "discord-panel.js",
];

for (const file of files) {
  const full = path.join(source, file);
  assert.equal(fs.existsSync(full), true, `missing ${file}`);
  const result = spawnSync(process.execPath, ["--check", full], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

const html = fs.readFileSync(path.join(source, "index.html"), "utf8");
assert.equal(html.includes('content="discordServerId"'), false);
assert.equal(html.includes('content="discordVoiceChannelId"'), false);
assert.equal(html.includes('content="discordChannelLabel"'), false);
assert.match(html, /content="showRecentActivity"/);
assert.match(html, /content="textColor"/);
assert.match(html, /content="accentColor"/);
assert.match(html, /content="backgroundColor"/);
assert.match(html, /content="panelOpacity"/);
assert.match(html, /content="fontFamily"/);
assert.match(html, /discord-panel-fixes\.css/);
assert.match(html, /discord-panel-roster\.css/);
assert.match(html, /discord-panel-appearance\.js/);
assert.match(html, /discord-panel-stable-roster\.js/);
assert.match(html, /discord-panel-rpc\.js/);
assert.match(html, /id="bridgeInstallPrompt"/);
assert.match(html, /id="installBridgeButton"/);
assert.match(html, /id="dismissBridgeHelp"/);

const panelCss = fs.readFileSync(path.join(source, "discord-panel.css"), "utf8");
assert.match(panelCss, /#bridgeInstallPrompt/);
assert.match(panelCss, /\.bridge-install-button/);
assert.match(panelCss, /\.bridge-install-dismiss/);
assert.match(panelCss, /bridge-help-dismissed/);

const fixes = fs.readFileSync(path.join(source, "discord-panel-fixes.css"), "utf8");
assert.match(fixes, /\.avatar-wrap > \.avatar/);
assert.match(fixes, /overflow:\s*hidden/);
assert.match(fixes, /\.avatar > img/);
assert.match(fixes, /object-fit:\s*cover/);
assert.match(fixes, /--panel-opacity/);
assert.match(fixes, /--font-ui/);
assert.match(fixes, /\.member-states/);
assert.match(fixes, /\.state-icon/);

const rosterCss = fs.readFileSync(path.join(source, "discord-panel-roster.css"), "utf8");
assert.match(rosterCss, /\.member-row\.speaking \.member-name/);
assert.match(rosterCss, /background:\s*transparent/);
assert.match(rosterCss, /--avatar:\s*34px/);
assert.match(rosterCss, /--avatar:\s*40px/);
assert.match(rosterCss, /--avatar:\s*44px/);
assert.match(rosterCss, /--avatar:\s*46px/);
assert.match(rosterCss, /column-gap:\s*12px/);

const appearance = fs.readFileSync(path.join(source, "discord-panel-appearance.js"), "utf8");
assert.match(appearance, /panelOpacity/);
assert.match(appearance, /fontFamily/);
assert.match(appearance, /--panel-top-alpha/);
assert.match(appearance, /--font-display/);
assert.match(appearance, /baseApplySettings/);

const stableRoster = fs.readFileSync(path.join(source, "discord-panel-stable-roster.js"), "utf8");
assert.match(stableRoster, /sortedMembers = function/);
assert.match(stableRoster, /left\._order/);
assert.match(stableRoster, /right\._order/);
assert.equal(stableRoster.includes("speakerPriority"), false, "stable roster must not sort by speaking state");

const transport = fs.readFileSync(path.join(source, "discord-panel-rpc.js"), "utf8");
assert.match(transport, /ws:\/\/127\.0\.0\.1:17483/);
assert.match(transport, /command: model\.state === "authorization" \? "authorize" : "refresh"/);
assert.match(transport, /command: field === "mute" \? "mute" : "deafen"/);
assert.match(transport, /value: Boolean\(nextValue\)/);
assert.match(transport, /Join any Discord voice channel and the panel will follow automatically/);
assert.equal(transport.includes("configure-streamkit"), false);
assert.equal(transport.includes("discord.com/api/oauth2"), false);
assert.equal(transport.includes("rpc.voice.read"), false);
assert.equal(transport.includes("rpc.voice.write"), false);
assert.equal(transport.includes("6463"), false);

const runtime = fs.readFileSync(path.join(source, "discord-panel.js"), "utf8");
assert.match(runtime, /snapshot: function \(snapshot\) \{ applyBridgeSnapshot\(snapshot \|\| null\); \}/);
assert.match(runtime, /!fixtureMode && \(!rpcSocket \|\| rpcSocket\.readyState !== WebSocket\.OPEN\)/);
assert.match(runtime, /function installIcueLifecycle\(\)/);
assert.match(runtime, /events\.onICUEInitialized = refreshIcueSettings/);
assert.match(runtime, /events\.onDataUpdated = refreshIcueSettings/);
assert.match(runtime, /__ratpackIcueSyncGlobals/);
assert.match(runtime, /VOICE_BRIDGE_HELP_STORAGE_KEY/);
assert.match(runtime, /Linkprovider\.open/);
assert.equal(runtime.includes("https://marketplace.elgato.com/product/packrat-voice-bridge-b39501ef-6626-4807-9659-4103d9cc3db6"), true, "Voice Bridge Marketplace URL missing from runtime");
assert.equal(runtime.includes("globalThis.icueEvents = function"), false);
for (const stale of ["bridgeSettings(", "validDiscordId(", "configureBridge(", "discordServerId", "discordVoiceChannelId"]) {
  assert.equal(runtime.includes(stale), false, `stale fixed-channel runtime reference remains: ${stale}`);
}

const ui = fs.readFileSync(path.join(source, "discord-panel-ui.js"), "utf8");
const translations = fs.readFileSync(path.join(repo, "widgets", "discord-panel", "translation.json"), "utf8");
const obsoletePrototypeSignatures = [
  "1540927508302536724",
  "discord.com/api/oauth2/token",
  "rpc.voice.read",
  "rpc.voice.write",
  "DISCORD_PORT_FIRST",
  "DISCORD_PORT_LAST",
  "Public Client PKCE",
  "Client ID before release",
];
for (const stale of obsoletePrototypeSignatures) {
  assert.equal(ui.includes(stale), false, `obsolete Discord prototype code remains in UI source: ${stale}`);
  assert.equal(translations.includes(stale), false, `obsolete Discord prototype copy remains in translations: ${stale}`);
}

const manifestText = fs.readFileSync(path.join(repo, "widgets", "discord-panel", "manifest.json"), "utf8");
const manifest = JSON.parse(manifestText);
const submissionText = fs.readFileSync(path.join(source, "submission.json"), "utf8");
const submission = JSON.parse(submissionText);
const artText = fs.readFileSync(path.join(source, "rat-art.json"), "utf8");
const publicCopy = [html, ui, translations, manifestText, submissionText, artText].join("\n");
assert.equal(manifest.name, "Discord Voice Panel for XENEON Edge");
assert.equal(submission.name, "Discord Voice Panel for XENEON Edge");
assert.equal(manifest.version, "1.0.1");
assert.equal(submission.version, "1.0.1");
assert.equal(submission.price_usd, 7.99);
assert.equal(submission.description.includes("https://marketplace.elgato.com/product/packrat-voice-bridge-b39501ef-6626-4807-9659-4103d9cc3db6"), true, "Voice Bridge Marketplace URL missing from submission copy");
assert.equal(submission.marketplace_auto_publish, false);
assert.match(submission.description, /independent third-party product/);
assert.match(submission.description, /not affiliated with, endorsed by, or sponsored by Discord Inc\./);
for (const forbidden of ["PackRat Discord Bridge", "PackRat PackRat"]) {
  assert.equal(publicCopy.includes(forbidden), false, `legacy marketplace product name remains: ${forbidden}`);
}

console.log("VOICE PANEL DEV QA PASS: syntax, hardened iCUE lifecycle, automatic loopback transport, dismissible Voice Bridge Marketplace install helper, contained compact avatars, stable member slots, separate name plates, opacity/font settings, mute/deafen mapping, current marketplace naming, no fixed-channel code, no delayed stale runtime calls, and no obsolete direct Discord OAuth/RPC prototype code");
