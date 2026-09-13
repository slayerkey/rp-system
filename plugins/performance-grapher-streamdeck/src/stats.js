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

export class FrameTimeHistogram {
  constructor({ stepMs = 0.25, maxFrameMs = 5000 } = {}) {
    this.stepMs = Math.max(0.01, Number(stepMs) || 0.25);
    this.maxFrameMs = Math.max(this.stepMs, Number(maxFrameMs) || 5000);
    this.counts = new Uint32Array(Math.ceil(this.maxFrameMs / this.stepMs) + 2);
    this.sums = new Float64Array(this.counts.length);
    this.count = 0;
    this.totalFrameMs = 0;
  }

  add(value) {
    const frameMs = Number(value);
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    const index = Math.min(this.counts.length - 1, Math.floor(frameMs / this.stepMs));
    this.counts[index] += 1;
    this.sums[index] += frameMs;
    this.count += 1;
    this.totalFrameMs += frameMs;
  }

  average() {
    return this.count && this.totalFrameMs > 0 ? this.count * 1000 / this.totalFrameMs : null;
  }

  lowest(fraction) {
    if (!this.count) return null;
    let remaining = Math.max(1, Math.ceil(this.count * clamp(fraction, 0.0001, 1)));
    let totalFrameMs = 0;
    let taken = 0;

    for (let i = this.counts.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const count = this.counts[i];
      if (!count) continue;
      const use = Math.min(count, remaining);
      const meanFrameMs = this.sums[i] / count;
      totalFrameMs += meanFrameMs * use;
      taken += use;
      remaining -= use;
    }

    return taken && totalFrameMs > 0 ? taken * 1000 / totalFrameMs : null;
  }

  toJSON() {
    const sparse = [];
    for (let i = 0; i < this.counts.length; i += 1) {
      if (this.counts[i]) sparse.push([i, this.counts[i], this.sums[i]]);
    }
    return {
      kind: "frame-time-histogram-v1",
      stepMs: this.stepMs,
      maxFrameMs: this.maxFrameMs,
      count: this.count,
      totalFrameMs: this.totalFrameMs,
      sparse,
    };
  }

  static fromJSON(value) {
    if (value?.kind !== "frame-time-histogram-v1" && (value?.step || value?.maxFps)) {
      return FrameTimeHistogram._fromLegacyFpsHistogram(value);
    }

    const hist = new FrameTimeHistogram({
      stepMs: Number(value?.stepMs) || 0.25,
      maxFrameMs: Number(value?.maxFrameMs) || 5000,
    });
    for (const row of Array.isArray(value?.sparse) ? value.sparse : []) {
      const [iRaw, cRaw, sRaw] = row || [];
      const i = Number(iRaw);
      const count = Math.max(0, Math.floor(Number(cRaw)));
      const sum = Number(sRaw);
      if (!Number.isInteger(i) || i < 0 || i >= hist.counts.length || !Number.isFinite(count) || !Number.isFinite(sum)) continue;
      hist.counts[i] = count;
      hist.sums[i] = sum;
    }
    hist.count = Number(value?.count) || hist.counts.reduce((a, b) => a + b, 0);
    hist.totalFrameMs = Number(value?.totalFrameMs) || hist.sums.reduce((a, b) => a + b, 0);
    return hist;
  }

  static _fromLegacyFpsHistogram(value) {
    const hist = new FrameTimeHistogram();
    for (const row of Array.isArray(value?.sparse) ? value.sparse : []) {
      const [, cRaw, sRaw] = row || [];
      const count = Math.max(0, Math.floor(Number(cRaw)));
      const fpsSum = Number(sRaw);
      if (!count || !Number.isFinite(fpsSum) || fpsSum <= 0) continue;
      const meanFps = fpsSum / count;
      const frameMs = 1000 / meanFps;
      const index = Math.min(hist.counts.length - 1, Math.floor(frameMs / hist.stepMs));
      hist.counts[index] += count;
      hist.sums[index] += frameMs * count;
      hist.count += count;
      hist.totalFrameMs += frameMs * count;
    }
    return hist;
  }
}

// Backward-compatible export name for pre-release tests/state readers.
export const LowFpsHistogram = FrameTimeHistogram;

export function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(Number(ms) / 1000));
  if (seconds < 60) return seconds + "s";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return hours + "h " + String(rem).padStart(2, "0") + "m";
}
