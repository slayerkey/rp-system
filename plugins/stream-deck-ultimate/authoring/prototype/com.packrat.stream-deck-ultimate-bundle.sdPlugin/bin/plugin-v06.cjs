"use strict";
global.WebSocket = require("ws");
// Replace the base system export before the runtime imports it so deliberate
// empty workspaces can behave as audio-only or link-only routines.
const systemPath = require.resolve("./lib-v06-system.js");
require(systemPath);
require.cache[systemPath].exports = require("./lib-v06-workspace.js");
require("./plugin-v06.js");
