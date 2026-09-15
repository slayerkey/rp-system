#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const entry = process.argv[2];
const outDir = process.argv[3] || 'artifacts/perf-title-width';
if (!entry || !fs.existsSync(entry)) {
  console.error('usage: node perf-grapher-title-width-smoke.mjs <exact-package-index.html> [out-dir]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const source = fs.readFileSync(entry, 'utf8');
const harness = `<script id="ratpack-perf-title-harness">
let iCUE_initialized = true;
let uniqueId = 'ratpack-perf-title-width';
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
let showPing = false;
let widgetTitle = 'CPU TELEMETRY';
let headerTitleSize = 100;
let sensorTitleSize = 100;
let sensorValueSize = 100;
let fontChoice = 'system';
let textColor = '#F2F5F7';
let sensorNameColor = '#F2F5F7';
let accentColor = '#2BE86A';
let backgroundColor = '#0B0E11';
let transparency = 0;
(function () {
  var cb = null;
  var plugin = {
    asyncResponse: { connect: function(fn) { cb = fn; } },
    getSensorValue: function(requestId, id) {
      var value = id === 'cpu.temp' ? 51.8 : 11.1;
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
const temp = path.join(path.dirname(path.resolve(entry)), '__ratpack-perf-title-width.html');
fs.writeFileSync(temp, instrumented, 'utf8');

const viewports = [
  ['small-horizontal', 840, 344],
  ['large-horizontal', 1688, 696],
  ['xl-horizontal', 2536, 696]
];

const report = { schema_version: 1, passed: false, viewports: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    await page.goto(pathToFileURL(temp).href, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForFunction(() => document.querySelector('.cell[data-sensor-id="cpu.temp"] .cell-name')?.textContent === 'CPU Temperature', null, { timeout: 10_000 });
    const result = await page.evaluate(() => {
      const cell = document.querySelector('.cell[data-sensor-id="cpu.temp"]');
      const head = cell.querySelector('.cell-head');
      const label = cell.querySelector('.cell-name');
      const value = cell.querySelector('.cell-value');
      const labelRect = label.getBoundingClientRect();
      const valueRect = value.getBoundingClientRect();
      const headStyle = getComputedStyle(head);
      return {
        text: label.textContent,
        value: value.textContent,
        labelClientWidth: label.clientWidth,
        labelScrollWidth: label.scrollWidth,
        valueWidth: valueRect.width,
        headWidth: head.getBoundingClientRect().width,
        gapPx: parseFloat(headStyle.columnGap || headStyle.gap || '0'),
        availableGap: valueRect.left - labelRect.right,
        fullyVisible: label.scrollWidth <= label.clientWidth + 1,
        labelUsesRemainingWidth: valueRect.left - labelRect.right <= Math.max(3, parseFloat(headStyle.columnGap || headStyle.gap || '0') + 1),
        valueInside: valueRect.right <= cell.getBoundingClientRect().right + 0.5
      };
    });
    if (!result.fullyVisible) throw new Error(`${name}: CPU Temperature is still ellipsized: ${JSON.stringify(result)}`);
    if (!result.labelUsesRemainingWidth) throw new Error(`${name}: sensor title is not using the space up to the readout: ${JSON.stringify(result)}`);
    if (!result.valueInside) throw new Error(`${name}: readout escaped the sensor card: ${JSON.stringify(result)}`);
    if (pageErrors.length) throw new Error(`${name}: page errors ${JSON.stringify(pageErrors)}`);
    report.viewports.push({ name, width, height, ...result, pageErrors });
    if (name === 'small-horizontal') await page.screenshot({ path: path.join(outDir, 'small-horizontal-title-width.png') });
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
