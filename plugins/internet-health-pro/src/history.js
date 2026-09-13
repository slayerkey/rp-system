import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function dataDirectory() {
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(), "PackRat", "Internet Health Pro");
  }
  return path.join(os.homedir(), "Library", "Application Support", "PackRat", "Internet Health Pro");
}

export class HistoryStore {
  constructor({ filePath = path.join(dataDirectory(), "history.json"), maxHours = 24 } = {}) {
    this.filePath = filePath;
    this.maxHours = Math.min(24, Math.max(2, Number(maxHours) || 24));
    this.state = {
      version: 1,
      samples: [],
      outages: [],
      speedTests: [],
      onlineSince: null,
      updatedAt: 0
    };
    this.dirty = false;
    this.lastWriteAt = 0;
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (raw && typeof raw === "object") {
        this.state = {
          version: 1,
          samples: Array.isArray(raw.samples) ? raw.samples : [],
          outages: Array.isArray(raw.outages) ? raw.outages : [],
          speedTests: Array.isArray(raw.speedTests) ? raw.speedTests : [],
          onlineSince: Number(raw.onlineSince) || null,
          updatedAt: Number(raw.updatedAt) || 0
        };
      }
    } catch {}
    this.prune();
    return this.state;
  }

  setMaxHours(hours) {
    this.maxHours = Math.min(24, Math.max(2, Number(hours) || 24));
    this.prune();
  }

  prune(now = Date.now()) {
    const cutoff = Number(now) - this.maxHours * 60 * 60 * 1000;
    this.state.samples = this.state.samples.filter((sample) => sample && Number(sample.t) >= cutoff).slice(-10_000);
    this.state.outages = this.state.outages.filter((item) => item && (Number(item.end || now) >= Number(now) - 90 * 24 * 60 * 60 * 1000)).slice(-100);
    this.state.speedTests = this.state.speedTests.filter(Boolean).slice(-20);
    this.state.updatedAt = Number(now);
  }

  addSample(sample) {
    this.state.samples.push(sample);
    this.dirty = true;
    this.prune(sample?.t || Date.now());
  }

  startOutage(reason, now = Date.now()) {
    const current = this.state.outages[this.state.outages.length - 1];
    if (current && !current.end) return current;
    const outage = { start: Number(now), end: null, durationMs: null, reason: String(reason || "offline") };
    this.state.outages.push(outage);
    this.state.onlineSince = null;
    this.dirty = true;
    this.prune(now);
    return outage;
  }

  endOutage(now = Date.now()) {
    const current = this.state.outages[this.state.outages.length - 1];
    if (current && !current.end) {
      current.end = Number(now);
      current.durationMs = Math.max(0, Number(now) - Number(current.start));
    }
    this.state.onlineSince = Number(now);
    this.dirty = true;
    this.prune(now);
  }

  markOnline(now = Date.now()) {
    if (!this.state.onlineSince) {
      this.state.onlineSince = Number(now);
      this.dirty = true;
    }
  }

  addSpeedTest(result) {
    this.state.speedTests.push(result);
    this.state.speedTests = this.state.speedTests.slice(-20);
    this.dirty = true;
  }

  flush(force = false, now = Date.now()) {
    if (!this.dirty) return false;
    if (!force && Number(now) - this.lastWriteAt < 60_000) return false;
    this.prune(now);
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const temp = this.filePath + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.state), "utf8");
    fs.renameSync(temp, this.filePath);
    this.lastWriteAt = Number(now);
    this.dirty = false;
    return true;
  }
}
