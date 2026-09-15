#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const entry = process.argv[2];
const outDir = process.argv[3] || 'artifacts/perf-grapher-regression';
if (!entry || !fs.existsSync(entry)) {
  console.error('usage: node perf-grapher-regression-smoke.mjs <exact-package-index.html> [out-dir]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const slots = [
  ['s-h', 840, 344],
  ['s-v', 696, 416],
  ['m-h', 840, 696],
  ['m-v', 696, 840],
  ['l-h', 1688, 696],
  ['l-v', 696, 1688],
  ['xl-h', 2536, 696],
  ['xl-v', 696, 2536]
];

const source = fs.readFileSync(entry, 'utf8');
const harness = `<script id="ratpack-perf-harness">
let iCUE_initialized = true;
let uniqueId = 'ratpack-perf-regression';
let sensors = [
  { sensorId: 'cpu.temp', color: '#2BE86A' },
  { sensorId: 'cpu.load', color: '#2B6CFF' }
];
let sampleSeconds = 1;
let decimals = '1';
let showWarn = true;
let warnAt = 95;
let showFill = true;
let showGrid = true;
let smoothing = 0;
let showFps = false;
let showPing = true;
let widgetTitle = 'CPU TELEMETRY';
let headerTitleSize = 100;
let sensorTitleSize = 100;
let sensorValueSize = 100;
let fontChoice = 'system';
let textColor = '#F2F5F7';
let sensorNameColor = '#F2F5F7';
let accentColor = '#2BE86A';
let backgroundColor = '#0B0E11';
let transparency = 35;
let __pingMode = 'ok';

globalThis.__setPerfProp = function(name, value) {
  switch (name) {
    case 'sensors': sensors = value; break;
    case 'sampleSeconds': sampleSeconds = value; break;
    case 'decimals': decimals = value; break;
    case 'showWarn': showWarn = value; break;
    case 'warnAt': warnAt = value; break;
    case 'showFill': showFill = value; break;
    case 'showGrid': showGrid = value; break;
    case 'smoothing': smoothing = value; break;
    case 'showFps': showFps = value; break;
    case 'showPing': showPing = value; break;
    case 'widgetTitle': widgetTitle = value; break;
    case 'headerTitleSize': headerTitleSize = value; break;
    case 'sensorTitleSize': sensorTitleSize = value; break;
    case 'sensorValueSize': sensorValueSize = value; break;
    case 'fontChoice': fontChoice = value; break;
    case 'textColor': textColor = value; break;
    case 'sensorNameColor': sensorNameColor = value; break;
    case 'accentColor': accentColor = value; break;
    case 'backgroundColor': backgroundColor = value; break;
    case 'transparency': transparency = value; break;
    default: throw new Error('unknown property ' + name);
  }
};
globalThis.__setPingMode = function(mode) { __pingMode = mode; };

globalThis.fetch = async function(url) {
  if (!String(url).includes('speed.cloudflare.com')) throw new Error('unexpected network request: ' + url);
  await new Promise(function(resolve) { setTimeout(resolve, 45); });
  if (__pingMode === 'fail') throw new Error('deterministic ping failure');
  return { type: 'opaque', status: 0, body: null };
};

(function () {
  var cb = null;
  var plugin = {
    asyncResponse: { connect: function(fn) { cb = fn; } },
    getSensorValue: function(requestId, id) {
      var value = id === 'cpu.temp' ? 88.8 : 71.2;
      setTimeout(function() { cb(requestId, value); }, 2);
    },
    getSensorName: function(requestId, id) {
      var value = id === 'cpu.temp' ? 'CPU Temperature' : 'CPU Load';
      setTimeout(function() { cb(requestId, value); }, 2);
    },
    getSensorUnits: function(requestId, id) {
      var value = id === 'cpu.temp' ? '°C' : '%';
      setTimeout(function() { cb(requestId, value); }, 2);
    }
  };
  globalThis.plugins = { Sensorsdataprovider: plugin };
})();
</script>`;
const instrumented = source.replace(/<head(\s[^>]*)?>/i, (m) => m + '\n' + harness);
const temp = path.join(path.dirname(path.resolve(entry)), '__ratpack-perf-regression.html');
fs.writeFileSync(temp, instrumented, 'utf8');

function assert(cond, message) { if (!cond) throw new Error(message); }
function near(actual, expected, tolerance = 0.035) { return Math.abs(actual - expected) <= tolerance; }

const report = { schema_version: 1, evidence_type: 'exact packaged Performance Grapher lexical settings and deterministic providers', slots: [], passed: false };
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const [slot, width, height] of slots) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await page.goto(pathToFileURL(temp).href, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForFunction(() => document.querySelectorAll('.cell').length >= 2, null, { timeout: 10_000 });
    await page.waitForFunction(() => document.getElementById('pingStatus')?.textContent?.match(/^PING \d+ MS$/), null, { timeout: 10_000 });

    const initial = await page.evaluate(() => {
      function alpha(text) {
        const rgba = String(text).match(/rgba?\([^)]*?(?:,\s*([0-9.]+))?\)$/i);
        if (rgba && rgba[1] !== undefined) return Number(rgba[1]);
        const slash = String(text).match(/\/\s*([0-9.]+)\s*\)?$/);
        return slash ? Number(slash[1]) : 1;
      }
      const cell = document.querySelector('.cell[data-sensor-id="cpu.temp"]');
      const value = cell.querySelector('.cell-value');
      const unit = value.querySelector('.value-unit');
      const cr = cell.getBoundingClientRect();
      const ur = unit.getBoundingClientRect();
      const body = getComputedStyle(document.body);
      const panel = getComputedStyle(document.getElementById('sensorPanel'));
      return {
        bridge: globalThis.__ratpackIcueBindingBridge,
        title: document.getElementById('titleText').textContent,
        showFps: document.body.getAttribute('data-show-fps'),
        ping: document.getElementById('pingStatus').textContent,
        unit: unit.textContent,
        unitInside: ur.left >= cr.left - 0.5 && ur.right <= cr.right + 0.5,
        bodyBackground: body.backgroundColor,
        bodyAlpha: alpha(body.backgroundColor),
        panelBackground: panel.backgroundColor,
        panelAlpha: alpha(panel.backgroundColor),
        contentOpacity: Number(getComputedStyle(cell).opacity),
        paintKey: document.body.getAttribute('data-background-paint'),
        headerPx: parseFloat(getComputedStyle(document.getElementById('titleText')).fontSize),
        valuePx: parseFloat(getComputedStyle(value).fontSize)
      };
    });
    assert(initial.bridge?.version === 2 && initial.bridge?.mode === 'direct-binding', `${slot}: hardened direct binding bridge missing`);
    assert(initial.title === 'CPU TELEMETRY', `${slot}: custom header not applied`);
    assert(initial.showFps === 'false', `${slot}: FPS off state not applied`);
    assert(initial.unit === '°C' && initial.unitInside, `${slot}: Celsius marker escaped sensor card`);
    assert(near(initial.bodyAlpha, 0.65), `${slot}: transparency 35 should yield body alpha 0.65, got ${initial.bodyBackground}`);
    assert(initial.panelAlpha >= 0.999, `${slot}: content panel became transparent: ${initial.panelBackground}`);
    assert(initial.contentOpacity === 1, `${slot}: sensor content opacity changed`);

    const sizeSamples = [];
    for (const value of [75, 100, 180]) {
      await page.evaluate((v) => { __setPerfProp('sensorValueSize', v); icueEvents.onDataUpdated(); }, value);
      await page.waitForTimeout(500);
      sizeSamples.push(await page.evaluate(() => {
        const cell = document.querySelector('.cell[data-sensor-id="cpu.temp"]');
        const value = cell.querySelector('.cell-value');
        const unit = value.querySelector('.value-unit');
        const cr = cell.getBoundingClientRect();
        const ur = unit.getBoundingClientRect();
        return { px: parseFloat(getComputedStyle(value).fontSize), unitInside: ur.right <= cr.right + 0.5 && ur.left >= cr.left - 0.5 };
      }));
    }
    assert(sizeSamples[0].px <= sizeSamples[1].px && sizeSamples[1].px <= sizeSamples[2].px, `${slot}: readout size slider is not monotonic`);
    assert(sizeSamples.every(x => x.unitInside), `${slot}: Celsius marker clips at a readout slider boundary`);

    const headerSamples = [];
    for (const value of [75, 100, 180]) {
      await page.evaluate((v) => { __setPerfProp('headerTitleSize', v); icueEvents.onDataUpdated(); }, value);
      await page.waitForTimeout(500);
      headerSamples.push(await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('titleText')).fontSize)));
    }
    assert(headerSamples[0] <= headerSamples[1] && headerSamples[1] <= headerSamples[2], `${slot}: header size slider is not monotonic`);

    for (const mode of ['graph', 'bar', 'radial']) {
      await page.evaluate((m) => { setSensorPref('cpu.temp', { mode:m, min:null, max:null }); renderSensors(); }, mode);
      const modeResult = await page.evaluate(() => {
        const cell = document.querySelector('.cell[data-sensor-id="cpu.temp"]');
        const unit = cell.querySelector('.cell-value .value-unit');
        const cr = cell.getBoundingClientRect();
        const ur = unit.getBoundingClientRect();
        return { mode:cell.getAttribute('data-mode'), unit:unit.textContent, inside:ur.right <= cr.right + 0.5 && ur.left >= cr.left - 0.5 };
      });
      assert(modeResult.mode === mode && modeResult.unit === '°C' && modeResult.inside, `${slot}: ${mode} Celsius/readout regression`);
    }

    await page.evaluate(() => { pingState.latency = 0; pingState.failed = false; renderPing(); });
    assert(await page.locator('#pingStatus').textContent() === 'PING 0 MS', `${slot}: zero ping treated as unavailable`);
    await page.evaluate(() => { __setPingMode('fail'); pingState.inFlight = false; samplePing(); });
    await page.waitForFunction(() => document.getElementById('pingStatus')?.textContent === 'PING OFFLINE', null, { timeout: 5_000 });
    await page.evaluate(() => { __setPingMode('ok'); pingState.inFlight = false; samplePing(); });
    await page.waitForFunction(() => document.getElementById('pingStatus')?.textContent?.match(/^PING \d+ MS$/), null, { timeout: 5_000 });

    await page.evaluate(() => { __setPerfProp('transparency', 70); icueEvents.onDataUpdated(); });
    await page.waitForTimeout(600);
    const cycles = [];
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        try {
          let hidden = true;
          Object.defineProperty(document, 'hidden', { configurable:true, get:function(){ return hidden; } });
          document.dispatchEvent(new Event('visibilitychange'));
          hidden = false;
          document.dispatchEvent(new Event('visibilitychange'));
        } catch (e) {
          document.dispatchEvent(new Event('visibilitychange'));
        }
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted:true }));
      });
      await page.waitForTimeout(500);
      cycles.push(await page.evaluate(() => {
        function alpha(text) {
          const rgba = String(text).match(/rgba?\([^)]*?(?:,\s*([0-9.]+))?\)$/i);
          if (rgba && rgba[1] !== undefined) return Number(rgba[1]);
          const slash = String(text).match(/\/\s*([0-9.]+)\s*\)?$/);
          return slash ? Number(slash[1]) : 1;
        }
        const cell = document.querySelector('.cell[data-sensor-id="cpu.temp"]');
        return {
          body: getComputedStyle(document.body).backgroundColor,
          bodyAlpha: alpha(getComputedStyle(document.body).backgroundColor),
          panel: getComputedStyle(document.getElementById('sensorPanel')).backgroundColor,
          panelAlpha: alpha(getComputedStyle(document.getElementById('sensorPanel')).backgroundColor),
          cellOpacity: Number(getComputedStyle(cell).opacity),
          paintKey: document.body.getAttribute('data-background-paint')
        };
      }));
    }
    assert(cycles.every(x => near(x.bodyAlpha, 0.30) && x.panelAlpha >= 0.999 && x.cellOpacity === 1 && x.paintKey === '#0B0E11:70'), `${slot}: transparency changed or compounded after page restore: ${JSON.stringify(cycles)}`);

    if (slot === 's-h') await page.screenshot({ path: path.join(outDir, 'small-horizontal.png') });
    if (slot === 'xl-h') await page.screenshot({ path: path.join(outDir, 'xl-horizontal.png') });
    report.slots.push({ slot, width, height, initial, sizeSamples, headerSamples, cycles, pageErrors, consoleErrors });
    assert(pageErrors.length === 0, `${slot}: page errors ${JSON.stringify(pageErrors)}`);
    assert(consoleErrors.length === 0, `${slot}: console errors ${JSON.stringify(consoleErrors)}`);
    await context.close();
  }
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
} finally {
  if (browser) await browser.close();
  try { fs.unlinkSync(temp); } catch {}
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
