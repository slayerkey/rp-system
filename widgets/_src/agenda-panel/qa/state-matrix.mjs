import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const entry = path.join(root, 'widgets', 'agenda-panel', 'index.html');
const html = fs.readFileSync(entry, 'utf8');
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
const valid = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test\r\nDTSTART:${ymd}T120000\r\nDTEND:${ymd}T130000\r\nSUMMARY:State test\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const empty = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n`;
const malformed = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nTHIS IS BAD\r\nEND:VCALENDAR\r\n`;
const secretUrl = 'https://calendar.example/private-secret-token/basic.ics';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function pageWith(url = '', fixtures = []) {
  const page = await browser.newPage({ viewport: { width: 840, height: 696 } });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('about:blank');
  await page.evaluate(({ html, url, fixtures }) => {
    const store = new Map();
    Object.defineProperty(globalThis, 'localStorage', { value: {
      getItem(key) { return store.has(String(key)) ? store.get(String(key)) : null; },
      setItem(key, value) { store.set(String(key), String(value)); },
      removeItem(key) { store.delete(String(key)); },
      clear() { store.clear(); },
      key(index) { return Array.from(store.keys())[index] || null; },
      get length() { return store.size; },
      _entries() { return Array.from(store.entries()); }
    }, configurable: true });
    globalThis.uniqueId = 'state-audit';
    globalThis.calendarUrl1 = url;
    globalThis.calendarUrl2 = '';
    globalThis.calendarUrl3 = '';
    globalThis.refreshMinutes = 15;
    globalThis.use24Hour = false;
    globalThis.textColor = '#F4F6F8';
    globalThis.accentColor = '#2BE86A';
    globalThis.backgroundColor = '#07090D';
    globalThis.tr = async (value) => value;
    globalThis.__ratpackAgendaFixtures = fixtures;
    document.open();
    document.write(html);
    document.close();
  }, { html, url, fixtures });
  await page.waitForTimeout(180);
  return page;
}

const out = {};
let page = await pageWith('', []);
out.unconfigured = await page.evaluate(() => ({ state: document.body.dataset.state, hero: heroTitle.textContent }));
await page.close();

page = await pageWith(secretUrl, [empty]);
out.empty = await page.evaluate((secretUrl) => ({
  state: document.body.dataset.state,
  events: STATE.events.length,
  emptyVisible: getComputedStyle(emptyState).display !== 'none',
  secretPersisted: localStorage._entries().some(([key, value]) => String(key).includes(secretUrl) || String(value).includes(secretUrl)),
}), secretUrl);
await page.close();

page = await pageWith(secretUrl, [valid]);
out.stale = await page.evaluate(async () => {
  const cached = { events: STATE.events.slice(), updatedAt: STATE.updatedAt };
  loadCalendarText = async () => null;
  cacheRead = () => cached;
  await refreshCalendars(true);
  return { state: document.body.dataset.state, events: STATE.events.length, message: STATE.message };
});
out.transportFailure = await page.evaluate(async () => {
  cacheRead = () => null;
  STATE.events = [];
  STATE.updatedAt = 0;
  await refreshCalendars(true);
  let opened = null;
  globalThis.plugins = { Linkprovider: { open(url) { opened = url; } } };
  globalThis.pluginLinkprovider_initialized = true;
  document.getElementById('heroCard').click();
  return {
    state: document.body.dataset.state,
    events: STATE.events.length,
    hero: heroTitle.textContent,
    cta: heroCountdown.textContent,
    opened,
    mode: document.body.dataset.mode
  };
});
await page.close();

page = await pageWith(secretUrl, [malformed]);
out.malformed = await page.evaluate(() => ({ state: document.body.dataset.state, events: STATE.events.length, hero: heroTitle.textContent }));
await page.close();

page = await pageWith(secretUrl, [valid]);
out.partial = await page.evaluate(async () => {
  calendarUrl1 = 'https://one.invalid/a.ics';
  calendarUrl2 = 'https://two.invalid/b.ics';
  const today = new Date();
  const two = (n) => String(n).padStart(2, '0');
  const stamp = `${today.getFullYear()}${two(today.getMonth() + 1)}${two(today.getDate())}`;
  const good = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:partial\r\nDTSTART:${stamp}T120000\r\nDTEND:${stamp}T130000\r\nSUMMARY:Partial good\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  loadCalendarText = async (url, index) => index === 0 ? { text: good, via: 'fixture' } : null;
  await refreshCalendars(true);
  return { state: document.body.dataset.state, failed: STATE.failedCount, sources: STATE.sourceCount, events: STATE.events.length };
});
out.parallel = await page.evaluate(async () => {
  calendarUrl1 = 'https://one.invalid/a.ics';
  calendarUrl2 = 'https://two.invalid/b.ics';
  calendarUrl3 = 'https://three.invalid/c.ics';
  loadCalendarText = async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return { text: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n', via: 'fixture' };
  };
  const started = performance.now();
  await refreshCalendars(true);
  return { elapsed: performance.now() - started, state: document.body.dataset.state };
});
await page.close();

if (out.unconfigured.state !== 'unconfigured') throw new Error('unconfigured state failed');
if (out.empty.state !== 'fresh' || out.empty.events !== 0 || !out.empty.emptyVisible) throw new Error('empty state failed');
if (out.empty.secretPersisted) throw new Error('secret calendar URL persisted to localStorage');
if (out.stale.state !== 'stale' || out.stale.events < 1) throw new Error('stale cache fallback failed');
if (out.transportFailure.state !== 'bridge' || out.transportFailure.events !== 0) throw new Error('transport failure state failed');
if (out.transportFailure.cta !== 'GET CALENDAR SYNC PRO →') throw new Error('companion upsell CTA missing');
if (out.transportFailure.opened !== 'https://marketplace.elgato.com/product/calendar-sync-pro-d957868e-d1a0-4c3b-8fe4-8291951a5170') throw new Error('companion upsell did not open exact Calendar Sync Pro listing');
if (out.transportFailure.mode !== 'today') throw new Error('companion upsell should not toggle calendar range');
if (out.malformed.state !== 'error' || out.malformed.events !== 0) throw new Error('malformed feed should be feed error');
if (out.partial.state !== 'stale' || out.partial.failed !== 1 || out.partial.events !== 1) throw new Error('partial failure state failed');
if (out.parallel.state !== 'fresh' || out.parallel.elapsed > 500) throw new Error(`calendar refresh not parallel: ${out.parallel.elapsed}`);
if (errors.length) throw new Error(`console errors: ${errors.join('\n')}`);

console.log(JSON.stringify(out, null, 2));
console.log('AGENDA PANEL STATE MATRIX PASS');
await browser.close();
