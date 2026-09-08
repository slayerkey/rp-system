"use strict";
const assert = require("assert");
const path = require("path");
const pluginDir = path.resolve(process.argv[2]);
const ctx = require(path.join(pluginDir, "bin", "lib-v07-context.js"));

assert.equal(ctx.classifyProcess("chrome"), "browser");
assert.equal(ctx.classifyProcess("msedge.exe"), "browser");
assert.equal(ctx.classifyProcess("Code"), "vscode");
assert.equal(ctx.classifyProcess("explorer"), "explorer");
assert.equal(ctx.classifyProcess("Spotify"), "spotify");
assert.equal(ctx.classifyProcess("Discord"), "discord");
assert.equal(ctx.classifyProcess("notepad"), "generic");

assert(ctx.roleMatchesProcess("browser", "chrome"));
assert(ctx.roleMatchesProcess("discord", "Discord"));
assert(ctx.roleMatchesProcess("spotify", "Spotify"));
assert(ctx.roleMatchesProcess("vscode", "Code"));
assert(ctx.roleMatchesProcess("custom", "notepad", path.join(path.sep, "tmp", "notepad.exe")));
assert(!ctx.roleMatchesProcess("discord", "chrome"));

ctx.applyForeground(null, "chrome", true);
assert.equal(ctx.commandFor({ slot: 1, context: "smart" }).label, "BACK");
assert.equal(ctx.commandFor({ slot: 2, context: "smart" }).label, "NEW TAB");
assert.equal(ctx.commandFor({ slot: 4, context: "smart" }).label, "CLOSE");
ctx.applyForeground(null, "Code", true);
assert.equal(ctx.commandFor({ slot: 1, context: "smart" }).label, "COMMAND");
assert.equal(ctx.commandFor({ slot: 2, context: "smart" }).label, "TERMINAL");
ctx.applyForeground(null, "explorer", true);
assert.equal(ctx.commandFor({ slot: 3, context: "smart" }).label, "ADDRESS");
ctx.applyForeground(null, "Spotify", true);
assert.equal(ctx.commandFor({ slot: 2, context: "smart" }).type, "media");
ctx.applyForeground(null, "Discord", true);
assert.equal(ctx.commandFor({ slot: 3, context: "smart" }).label, "MUTE");
ctx.applyForeground(null, "notepad", true);
assert.equal(ctx.commandFor({ slot: 1, context: "smart" }).label, "WEB");
assert.equal(ctx.commandFor({ slot: 4, context: "smart" }).type, "capture");

const seq = ctx.combo(["ctrl", "shift"], "P");
assert.deepEqual(seq, [[17,1],[16,1],[80,1],[80,0],[16,0],[17,0]]);
console.log("v0.7 context logic passed: classification, slots, generic fallback, shortcuts, active-role matching");
