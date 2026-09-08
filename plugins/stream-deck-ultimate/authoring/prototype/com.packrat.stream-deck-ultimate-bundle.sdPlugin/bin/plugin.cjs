"use strict";
// Stream Deck runs this exact file from manifest CodePath.
// Keep the WebSocket polyfill here, then load the current premium runtime.
global.WebSocket = require("ws");
require("./plugin-v05.js");
