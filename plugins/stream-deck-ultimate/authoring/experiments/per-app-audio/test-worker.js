"use strict";
const model = require("./session-model.js");

class TestAppAudioWorker {
  constructor(options = {}) {
    this.rows = (options.rows || [
      { pid: 101, process: "Discord", displayName: "Voice", sessionIdentifier: "discord-1", volume: 42, muted: false, state: "Active" },
      { pid: 101, process: "Discord", displayName: "Notifications", sessionIdentifier: "discord-2", volume: 42, muted: false, state: "Active" },
      { pid: 202, process: "Spotify", displayName: "Music", sessionIdentifier: "spotify-1", volume: 35, muted: false, state: "Active" }
    ]).map(x => ({ ...x }));
    this.foregroundState = { ...(options.foreground || { pid: 202, process: "Spotify" }) };
    this.listCalls = 0;
    this.writes = [];
    this.closed = false;
    this.failList = false;
  }

  async ping() { return { ready: true, mock: true, backend: "test" }; }
  async foreground() { return { ...this.foregroundState }; }
  async list() {
    this.listCalls++;
    if (this.failList) throw new Error("test audio endpoint unavailable");
    return this.rows.map(x => ({ ...x }));
  }

  _matches(match) {
    const raw = String(match || "");
    const pid = Number(raw);
    const isPid = Number.isInteger(pid) && String(pid) === raw;
    const key = model.normalizeProcessName(raw);
    return this.rows.filter(x => isPid ? Number(x.pid) === pid : model.normalizeProcessName(x.process) === key);
  }

  async _write(action, match, value) {
    const targets = this._matches(match);
    this.writes.push({ action, match: String(match), value });
    for (const row of targets) {
      if (action === "SetVolume") row.volume = Math.max(0, Math.min(100, Number(value)));
      else if (action === "AdjustVolume") row.volume = Math.max(0, Math.min(100, Number(row.volume) + Number(value)));
      else if (action === "Mute") row.muted = true;
      else if (action === "Unmute") row.muted = false;
      else if (action === "ToggleMute") row.muted = !row.muted;
    }
    return { changed: targets.length, missing: targets.length === 0, match: String(match) };
  }

  setVolume(match, value) { return this._write("SetVolume", match, value); }
  adjustVolume(match, value) { return this._write("AdjustVolume", match, value); }
  mute(match) { return this._write("Mute", match); }
  unmute(match) { return this._write("Unmute", match); }
  toggleMute(match) { return this._write("ToggleMute", match); }
  async close() { this.closed = true; }
}

module.exports = { TestAppAudioWorker };
