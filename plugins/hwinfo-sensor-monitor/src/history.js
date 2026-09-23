export const RAW_MAX = 1500;
export const ARCHIVE_MAX = 1800;
export const ARCHIVE_MS = 10000;

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export class BoundedHistory {
  constructor({ rawMax = RAW_MAX, archiveMax = ARCHIVE_MAX, archiveMs = ARCHIVE_MS } = {}) {
    this.rawMax = Math.max(8, Number(rawMax) || RAW_MAX);
    this.archiveMax = Math.max(8, Number(archiveMax) || ARCHIVE_MAX);
    this.archiveMs = Math.max(1000, Number(archiveMs) || ARCHIVE_MS);
    this.raw = [];
    this.archive = [];
  }
  push(at, value) {
    const t = finite(at), v = finite(value);
    if (t === null || v === null) return false;
    this.raw.push([t, v]);
    if (this.raw.length > this.rawMax) this.raw.splice(0, this.raw.length - this.rawMax);
    const bucket = Math.floor(t / this.archiveMs) * this.archiveMs;
    const last = this.archive[this.archive.length - 1];
    if (!last || last[0] !== bucket) this.archive.push([bucket, v, v, v]);
    else { last[1] = Math.min(last[1], v); last[2] = Math.max(last[2], v); last[3] = v; }
    if (this.archive.length > this.archiveMax) this.archive.splice(0, this.archive.length - this.archiveMax);
    return true;
  }
  latest() { return this.raw.length ? this.raw[this.raw.length - 1][1] : null; }
  series(windowMs, now = Date.now(), mode = "last") {
    const span = Math.max(1000, Number(windowMs) || 60000), start = now - span;
    const recent = this.raw.filter((point) => point[0] >= start);
    if (recent.length >= 2) return recent;
    return this.archive.filter((point) => point[0] >= start).map((point) => [point[0], mode === "min" ? point[1] : mode === "max" ? point[2] : point[3]]);
  }
}
