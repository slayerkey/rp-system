"use strict";
const { ACTION_UUID } = require("./action-spec.js");
const { activeAppOptions } = require("./settings-model.js");

function compactKeyTitle(visual = {}) {
  const status = String(visual.status || "");
  const value = String(visual.value || "");
  if (status === "unavailable") return "AUDIO\nOFF";
  if (status === "unconfigured") return "SET\nAPP";
  const rawTitle = String(visual.title || "APP").toUpperCase().replace(/\s+/g, " ").trim();
  const title = rawTitle.length > 9 ? `${rawTitle.slice(0, 8)}…` : rawTitle;
  const shortValue = value === "WAITING" ? "WAITING" : value.length > 9 ? `${value.slice(0, 8)}…` : value;
  return `${title}\n${shortValue}`;
}

function createProtocolRenderer(send) {
  if (typeof send !== "function") throw new Error("Protocol renderer requires send");
  return async (context, view = {}) => {
    if (view.controller === "Encoder" && view.feedback) {
      send({ event: "setFeedback", context, payload: view.feedback });
      return;
    }
    send({
      event: "setTitle",
      context,
      payload: { title: compactKeyTitle(view.visual), target: 0 }
    });
  };
}

class AppAudioActionBridge {
  constructor(options = {}) {
    if (!options.runtime) throw new Error("AppAudioActionBridge requires runtime");
    this.runtime = options.runtime;
    this.actionUUID = options.actionUUID || ACTION_UUID;
    this.send = options.send || (() => {});
  }

  accepts(message = {}) {
    return String(message.action || "") === this.actionUUID;
  }

  async _handlePropertyInspector(message) {
    const payload = message.payload || {};
    const command = String(payload.command || payload.type || "");
    if (command !== "list-apps") return { handled: true, result: { ignored: true } };
    await this.runtime.service.refresh(true);
    const apps = this.runtime.service.lastError ? [] : activeAppOptions(this.runtime.service.sessions);
    const response = {
      event: "sendToPropertyInspector",
      action: this.actionUUID,
      context: String(message.context || ""),
      payload: {
        type: "app-options",
        apps,
        unavailable: !!this.runtime.service.lastError
      }
    };
    this.send(response);
    return { handled: true, result: response.payload };
  }

  async handle(message = {}) {
    if (!this.accepts(message)) return { handled: false, result: null };
    if (String(message.event || "") === "sendToPlugin") return this._handlePropertyInspector(message);
    return { handled: true, result: await this.runtime.handle(message) };
  }
}

module.exports = { compactKeyTitle, createProtocolRenderer, AppAudioActionBridge };
