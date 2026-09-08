"use strict";
const RealWebSocket = require("ws");
const context = require("./lib-v07-context.js");
const diagnostics = require("./lib-v071-diagnostics.js");

class PackRatWebSocket extends RealWebSocket {
  constructor(...args) {
    super(...args);
    context.attach(this);
    diagnostics.attach(this);
  }
}

global.WebSocket = PackRatWebSocket;
require("./plugin-v06.js");
