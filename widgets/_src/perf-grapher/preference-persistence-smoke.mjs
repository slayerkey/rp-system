import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storageSource = fs.readFileSync(new URL('./perf-storage.js', import.meta.url), 'utf8');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
}

const localStorage = new MemoryStorage();
const sensorIds = ['cpu-temp', 'gpu-load'];
const context = vm.createContext({
  console,
  localStorage,
  uniqueId: 'corsair-widget-uuid',
  DURABLE_ROOT_KEY: 'packratPerfGrapher',
  LEGACY_PREFS_INDEX_KEY: 'packrat:perf-grapher:prefs-v3',
  SENSOR_MODES: ['graph', 'bar', 'radial', 'readout'],
  FPS_WINDOWS: [
    { label: '60 SEC', ms: 60000 },
    { label: '5 MIN', ms: 300000 },
    { label: 'SESSION', ms: null }
  ],
  sensorPrefs: {},
  fpsState: { windowIndex: 0, heroUnit: 'fps' },
  store: null,
  prefsStore: null,
  series: {},
  names: {},
  units: {},
  HISTORY_POINTS: 120,
  HISTORY_MAX_AGE_MS: 600000,
  renderSensors() {},
  sensorList() { return sensorIds.map(sensorId => ({ sensorId })); },
  clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
});

vm.runInContext(storageSource, context, { filename: 'perf-storage.js' });

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function uuidRoot() {
  return JSON.parse(localStorage.getItem(context.uniqueId));
}

const signature = sensorIds.slice().sort().join('|');
context.prefsStore = context.durableStore('preferences');

// Save non-default display modes and custom scales.
context.sensorPrefs = {
  'cpu-temp': { mode: 'bar', min: 25, max: 95 },
  'gpu-load': { mode: 'readout', min: 10, max: 100 }
};
context.fpsState.windowIndex = 1;
context.fpsState.heroUnit = 'ms';
context.persistPreferences();

let root = uuidRoot();
let index = root.packratPerfGrapher.preferenceIndex;
assert.ok(index[signature], 'sensor-signature backup must be inside localStorage[uniqueId]');
assert.deepEqual(plain(index[signature].sensorPrefs), plain(context.sensorPrefs));
assert.equal(index[signature].sensorPrefs['cpu-temp'].mode, 'bar');
assert.equal(index[signature].sensorPrefs['cpu-temp'].min, 25);
assert.equal(index[signature].sensorPrefs['cpu-temp'].max, 95);
assert.equal(index[signature].sensorPrefs['gpu-load'].mode, 'readout');
assert.equal(localStorage.getItem(context.LEGACY_PREFS_INDEX_KEY), null,
  'new saves must not depend on a standalone non-UUID storage key');

// Simulate a normal iCUE page/webview recreation. The UUID stays the same by
// CORSAIR contract and exact preferences restore without reverting to defaults.
context.sensorPrefs = {};
context.fpsState.windowIndex = 0;
context.fpsState.heroUnit = 'fps';
context.prefsStore = context.durableStore('preferences');
assert.equal(context.restorePreferences(null), true);
assert.equal(context.sensorPrefs['cpu-temp'].mode, 'bar');
assert.equal(context.sensorPrefs['cpu-temp'].min, 25);
assert.equal(context.sensorPrefs['cpu-temp'].max, 95);
assert.equal(context.sensorPrefs['gpu-load'].mode, 'readout');
assert.equal(context.fpsState.windowIndex, 1);
assert.equal(context.fpsState.heroUnit, 'ms');

// Reproduce the 1.4.1 failure shape: an empty/malformed active preference record
// must NOT be treated as a successful restore. The UUID-scoped signature backup wins.
context.sensorPrefs = {};
context.prefsStore.write({});
assert.equal(context.restorePreferences(null), true);
assert.equal(context.sensorPrefs['cpu-temp'].mode, 'bar');
assert.equal(context.sensorPrefs['cpu-temp'].min, 25);
assert.equal(context.sensorPrefs['cpu-temp'].max, 95);
assert.equal(context.sensorPrefs['gpu-load'].mode, 'readout');

// Existing valid 1.4.1 v3 UUID-scoped preferences should seed the v4 backup on
// first load so a later malformed active record can recover without Graph + Auto.
root = uuidRoot();
delete root.packratPerfGrapher.preferenceIndex;
localStorage.setItem(context.uniqueId, JSON.stringify(root));
context.sensorPrefs = {};
context.prefsStore = context.durableStore('preferences');
context.prefsStore.write({
  version: 3,
  at: Date.now() - 1000,
  signature,
  sensorPrefs: {
    'cpu-temp': { mode: 'radial', min: 30, max: 90 },
    'gpu-load': { mode: 'bar', min: 5, max: 100 }
  },
  view: { fpsWindow: 2, heroUnit: 'fps' }
});
assert.equal(context.restorePreferences(null), true);
root = uuidRoot();
index = root.packratPerfGrapher.preferenceIndex;
assert.ok(index[signature], '1.4.1 exact preferences must seed UUID-scoped backup');
assert.equal(index[signature].version, 4);
assert.equal(index[signature].sensorPrefs['cpu-temp'].mode, 'radial');
assert.equal(index[signature].sensorPrefs['cpu-temp'].min, 30);
assert.equal(index[signature].sensorPrefs['cpu-temp'].max, 90);

context.sensorPrefs = {};
context.prefsStore.write({});
assert.equal(context.restorePreferences(null), true);
assert.equal(context.sensorPrefs['cpu-temp'].mode, 'radial');
assert.equal(context.sensorPrefs['cpu-temp'].min, 30);
assert.equal(context.sensorPrefs['cpu-temp'].max, 90);
assert.equal(context.sensorPrefs['gpu-load'].mode, 'bar');
assert.equal(context.sensorPrefs['gpu-load'].min, 5);
assert.equal(context.sensorPrefs['gpu-load'].max, 100);

console.log('PASS Performance Grapher UUID preference persistence regression');
