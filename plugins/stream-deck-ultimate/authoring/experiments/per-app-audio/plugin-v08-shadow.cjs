"use strict";
const RealWebSocket = require("ws");
const context = require("./lib-v07-context.js");
const diagnostics = require("./lib-v071-diagnostics.js");
const appAudio = require("./lib-v08-app-audio.js");

class PackRatWebSocket extends RealWebSocket {
  constructor(...args) {
    super(...args);
    this.__packratInstallingAux = true;
    context.attach(this);
    diagnostics.attach(this);
    appAudio.attach(this);
    this.__packratInstallingAux = false;
  }

  addEventListener(type, listener, options) {
    if (type === "message" && !this.__packratInstallingAux) {
      const filtered = function(ev) {
        try {
          const message = JSON.parse(String(ev.data));
          if (String(message.action || "") === appAudio.ACTION_UUID) return;
        } catch {}
        return listener.call(this, ev);
      };
      return super.addEventListener(type, filtered, options);
    }
    return super.addEventListener(type, listener, options);
  }
}

global.WebSocket = PackRatWebSocket;
require("./plugin-v06.js");
