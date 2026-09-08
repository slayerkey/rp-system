"use strict";
const RealWebSocket = require("ws");
const context = require("./lib-v07-context.js");

class PackRatWebSocket extends RealWebSocket {
  constructor(...args) {
    super(...args);
    context.attach(this);
  }
}

global.WebSocket = PackRatWebSocket;
require("./plugin-v06.js");
