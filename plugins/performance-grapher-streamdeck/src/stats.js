export function clamp(value, low, high) {
  const n = Number(value);
  if (!Number.isFinite(n)) return low;
  return Math.min(high, Math.max(low, n));
}

export function lowestAverage(values, fraction) {
  const clean = (Array.isArray(values) ? values : [])
    .map(Number)
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  if (!clean.length) return null;
  const count = Math.max(1, Math.ceil(clean.length * clamp(fraction, 0.0001, 1)));
  let total = 0;
  for (let i = 0; i < count; i += 1) total += clean[i];
  return total / count;
}

export class LowFpsHistogram {
  constructor({ step = 0.5, maxFps = 1000 } = {}) {
    this.step = step;
    this.maxFps = maxFps;
    this.counts = new Uint32Array(Math.ceil(maxFps / step) + 2);
    this.sums = new Float64Array(this.counts.length);
    this.count = 0;
    this.sum = 0;
  }

  add(value) {
    const fps = Number(value);
    if (!Number.isFinite(fps) || fps < 0) return;
    const index = Math.min(this.counts.length - 1, Math.floor(fps / this.step));
    this.counts[index] += 1;
    this.sums[index] += fps;
    this.count += 1;
    this.sum += fps;
  }

  average() {
    return this.count ? this.sum / this.count : null;
  }

  lowest(fraction) {
    if (!this.count) return null;
    let remaining = Math.max(1, Math.ceil(this.count * clamp(fraction, 0.0001, 1)));
    let total = 0;
    let taken = 0;
    for (let i = 0; i < this.counts.length && remaining > 0; i += 1) {
      const count = this.counts[i];
      if (!count) continue;
      const use = Math.min(count, remaining);
      const mean = this.sums[i] / count;
      total += mean * use;
      taken += use;
      remaining -= use;
    }
    return taken ? total / taken : null;
  }

  toJSON() {
    const sparse = [];
    for (let i = 0; i < this.counts.length; i += 1) {
      if (this.counts[i]) sparse.push([i, this.counts[i], this.sums[i]]);
    }
    return { step: this.step, maxFps: this.maxFps, count: this.count, sum: this.sum, sparse };
  }

  static fromJSON(value) {
    const hist = new LowFpsHistogram({
      step: Number(value?.step) || 0.5,
      maxFps: Number(value?.maxFps) || 1000,
    });
    for (const row of Array.isArray(value?.sparse) ? value.sparse : []) {
      const [iRaw, cRaw, sRaw] = row || [];
      const i = Number(iRaw);
      const c = Number(cRaw);
      const s = Number(sRaw);
      if (!Number.isInteger(i) || i < 0 || i >= hist.counts.length || !Number.isFinite(c) || !Number.isFinite(s)) continue;
      hist.counts[i] = Math.max(0, Math.floor(c));
      hist.sums[i] = s;
    }
    hist.count = Number(value?.count) || hist.counts.reduce((a, b) => a + b, 0);
    hist.sum = Number(value?.sum) || hist.sums.reduce((a, b) => a + b, 0);
    return hist;
  }
}

export function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(Number(ms) / 1000));
  if (seconds < 60) return seconds + "s";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return hours + "h " + String(rem).padStart(2, "0") + "m";
}
