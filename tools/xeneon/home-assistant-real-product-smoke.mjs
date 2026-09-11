#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const entry = process.argv[2];
const base = (process.argv[3] || 'http://127.0.0.1:8123').replace(/\/+$/, '');
const outDir = process.argv[4] || 'artifacts/home-assistant-product';
if (!entry || !fs.existsSync(entry)) {
  console.error('usage: node home-assistant-real-product-smoke.mjs <exact-package-index.html> [ha-url] [out-dir]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive:true });

const clientId = `${base}/`;
const sensorId = 'sensor.ratpack_temperature';
const lightId = 'light.ratpack_desk';
const password = 'RatPack-QA-Only-2026!';

async function jsonFetch(url, options={}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}
async function waitForHomeAssistant() {
  let last = '';
  for (let i=0;i<90;i++) {
    try {
      const r = await fetch(`${base}/api/onboarding`, { cache:'no-store' });
      last = `${r.status} ${await r.text()}`;
      if (r.status === 200) return;
    } catch (error) { last = String(error); }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Home Assistant did not become ready: ${last}`);
}
async function onboard() {
  await waitForHomeAssistant();
  const status = await jsonFetch(`${base}/api/onboarding`);
  const userDone = Array.isArray(status.data) && status.data.find(step => step.step === 'user')?.done;
  if (userDone) throw new Error('test Home Assistant instance is not clean');
  const user = await jsonFetch(`${base}/api/onboarding/users`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({client_id:clientId,name:'RatPack QA',username:'ratpack_qa',password,language:'en'})
  });
  if (!user.response.ok || !user.data?.auth_code) throw new Error(`user onboarding failed: ${user.response.status} ${JSON.stringify(user.data)}`);
  const form = new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code:user.data.auth_code});
  const token = await jsonFetch(`${base}/auth/token`, {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
  if (!token.response.ok || !token.data?.access_token) throw new Error(`token exchange failed: ${token.response.status}`);
  return token.data.access_token;
}
async function seed(token, id, state, attributes={}) {
  const result = await jsonFetch(`${base}/api/states/${id}`, {
    method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({state,attributes})
  });
  if (!result.response.ok || result.data?.entity_id !== id) throw new Error(`seed failed for ${id}: ${result.response.status} ${JSON.stringify(result.data)}`);
}

const report = {schema_version:1,evidence_type:'exact packaged Home Assistant Panel against real Home Assistant Core 2026.8 from file origin',passed:false,initial:null,updated:null,pageErrors:[]};
let browser, temp;
let exitCode = 0;
try {
  const token = await onboard();
  await seed(token, sensorId, '72', {friendly_name:'RatPack Temperature',unit_of_measurement:'°F'});
  await seed(token, lightId, 'off', {friendly_name:'RatPack Desk Light'});
  const original = fs.readFileSync(entry,'utf8');
  const harness = `<script id="ratpack-real-ha-product-harness">
let baseUrl = ${JSON.stringify(base)};
let token = ${JSON.stringify(token)};
let entities = ${JSON.stringify(sensorId + '\n' + lightId)};
let refreshMinutes = 1;
let showUnavailable = false;
let textColor = '#F2F5F7';
let accentColor = '#2BE86A';
let backgroundColor = '#0B0E11';
let uniqueId = 'ratpack-real-ha-product';
</script>`;
  const instrumented = original.replace(/<head(\s[^>]*)?>/i, m => m + '\n' + harness);
  temp = path.join(path.dirname(path.resolve(entry)), '__ratpack-real-ha-product.html');
  fs.writeFileSync(temp,instrumented,'utf8');
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1688,height:696}});
  const page = await context.newPage();
  page.on('pageerror', e => report.pageErrors.push(String(e)));
  await page.goto(pathToFileURL(temp).href,{waitUntil:'load',timeout:30000});
  await page.waitForFunction(() => document.body.getAttribute('data-connection') === 'live' && document.getElementById('tiles')?.textContent?.includes('72°F') && document.getElementById('tiles')?.textContent?.includes('OFF'), null, {timeout:20000});
  report.initial = await page.evaluate(() => ({origin:location.origin,connection:document.body.getAttribute('data-connection'),status:document.getElementById('status')?.textContent,tiles:document.getElementById('tiles')?.innerText,bridge:globalThis.__ratpackIcueBindingBridge || null}));
  await seed(token, sensorId, '73.5', {friendly_name:'RatPack Temperature',unit_of_measurement:'°F'});
  await seed(token, lightId, 'on', {friendly_name:'RatPack Desk Light'});
  await page.waitForFunction(() => document.getElementById('tiles')?.textContent?.includes('73.5°F') && document.getElementById('tiles')?.textContent?.includes('ON'), null, {timeout:10000});
  report.updated = await page.evaluate(() => ({connection:document.body.getAttribute('data-connection'),tiles:document.getElementById('tiles')?.innerText}));
  if (report.initial.connection !== 'live' || !report.initial.tiles.includes('72°F') || !report.initial.tiles.includes('OFF')) throw new Error(`initial real HA state failed: ${JSON.stringify(report.initial)}`);
  if (!report.updated.tiles.includes('73.5°F') || !report.updated.tiles.includes('ON')) throw new Error(`state_changed subscription failed: ${JSON.stringify(report.updated)}`);
  if (report.pageErrors.length) throw new Error(`page errors: ${JSON.stringify(report.pageErrors)}`);
  await page.screenshot({path:path.join(outDir,'home-assistant-real-product-pass.png'),fullPage:true});
  await context.close();
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir,'home-assistant-real-product-result.json'),JSON.stringify(report,null,2)+'\n');
  if (temp) try { fs.unlinkSync(temp); } catch {}
  if (browser) await browser.close();
}
console.log(JSON.stringify(report,null,2));
process.exit(exitCode);
