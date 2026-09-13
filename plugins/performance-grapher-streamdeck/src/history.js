export const SENSOR_RAW_MAX = 900;
export const SENSOR_ARCHIVE_MAX = 2160;
export const SENSOR_ARCHIVE_MS = 10_000;
export const FPS_RECENT_MAX = 3600;
export const FPS_ARCHIVE_MAX = 21600;

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export class BoundedHistory {
  constructor({
    rawMax = SENSOR_RAW_MAX,
    archiveMax = SENSOR_ARCHIVE_MAX,
    archiveMs = SENSOR_ARCHIVE_MS,
    archiveMode = "max",
  } = {}) {
    this.rawMax = Math.max(2, Number(rawMax) || SENSOR_RAW_MAX);
    this.archiveMax = Math.max(2, Number(archiveMax) || SENSOR_ARCHIVE_MAX);
    this.archiveMs = Math.max(100, Number(archiveMs) || SENSOR_ARCHIVE_MS);
    this.archiveMode = archiveMode === "min" ? "min" : archiveMode === "last" ? "last" : "max";
    this.raw = [];
    this.archive = [];
    this.pending = null;
  }

  push(at, value) {
    const t = finite(at);
    const v = finite(value);
    if (t === null || v === null) return false;
    this.raw.push([t, v]);
    if (this.raw.length > this.rawMax) this.raw.splice(0, this.raw.length - this.rawMax);

    const bucket = Math.floor(t / this.archiveMs) * this.archiveMs;
    if (!this.pending || this.pending.bucket !== bucket) {
      if (this.pending) this._commitPending();
      this.pending = { bucket, first: v, last: v, min: v, max: v, count: 1 };
    } else {
      this.pending.last = v;
      this.pending.min = Math.min(this.pending.min, v);
      this.pending.max = Math.max(this.pending.max, v);
      this.pending.count += 1;
    }
    return true;
  }

  _commitPending() {
    if (!this.pending) return;
    const p = this.pending;
    const value = this.archiveMode === "min" ? p.min : this.archiveMode === "last" ? p.last : p.max;
    this.archive.push([p.bucket, value]);
    if (this.archive.length > this.archiveMax) this.archive.splice(0, this.archive.length - this.archiveMax);
    this.pending = null;
  }

  latest() {
    return this.raw.length ? this.raw[this.raw.length - 1][1] : null;
  }

  series(windowMs, now = Date.now()) {
    const span = Number(windowMs);
    const start = Number.isFinite(span) && span > 0 ? now - span : -Infinity;
    const rawStart = this.raw.length ? finite(this.raw[0]?.[0]) : null;
    const rawCoversWindow = Number.isFinite(span) && span > 0 && rawStart !== null && rawStart <= start;
    const source = rawCoversWindow ? this.raw : [...this.archive, ...this.raw];
    const seen = new Set();
    const output = [];
    for (const point of source) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const t = finite(point[0]);
      const v = finite(point[1]);
      if (t === null || v === null || t < start) continue;
      const key = String(t);
      if (seen.has(key)) {
        const prior = output.findIndex((item) => item[0] === t);
        if (prior >= 0) output[prior] = [t, v];
        continue;
      }
      seen.add(key);
      output.push([t, v]);
    }
    output.sort((a, b) => a[0] - b[0]);
    return output;
  }

  toJSON() {
    const archive = this.archive.slice();
    if (this.pending) {
      const p = this.pending;
      const value = this.archiveMode === "min" ? p.min : this.archiveMode === "last" ? p.last : p.max;
      const last = archive[archive.length - 1];
      if (last?.[0] === p.bucket) {
        if (this.archiveMode === "min") last[1] = Math.min(last[1], value);
        else if (this.archiveMode === "max") last[1] = Math.max(last[1], value);
        else last[1] = value;
      } else {
        archive.push([p.bucket, value]);
      }
    }
    return {
      raw: this.raw.slice(-this.rawMax),
      archive: archive.slice(-this.archiveMax),
      rawMax: this.rawMax,
      archiveMax: this.archiveMax,
      archiveMs: this.archiveMs,
      archiveMode: this.archiveMode,
    };
  }

  static fromJSON(value, options = {}) {
    const history = new BoundedHistory(options);
    if (!value || typeof value !== "object") return history;
    const clean = (points, max) => (Array.isArray(points) ? points : [])
      .filter((p) => Array.isArray(p) && finite(p[0]) !== null && finite(p[1]) !== null)
      .map((p) => [Number(p[0]), Number(p[1])])
      .sort((a, b) => a[0] - b[0])
      .slice(-max);
    history.raw = clean(value.raw, history.rawMax);
    const archive = clean(value.archive, history.archiveMax);
    history.archive = [];
    for (const [at, sample] of archive) {
      const prior = history.archive[history.archive.length - 1];
      if (prior?.[0] !== at) {
        history.archive.push([at, sample]);
      } else if (history.archiveMode === "min") {
        prior[1] = Math.min(prior[1], sample);
      } else if (history.archiveMode === "max") {
        prior[1] = Math.max(prior[1], sample);
      } else {
        prior[1] = sample;
      }
    }
    return history;
  }
}

export function boundedPush(array, value, max) {
  array.push(value);
  if (array.length > max) array.splice(0, array.length - max);
  return array;
}
