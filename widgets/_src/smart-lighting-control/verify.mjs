import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('widgets/_src/smart-lighting-control');
const shipping=path.resolve('widgets/smart-lighting-control');
for(const p of ['index.html','lighting.css','lighting.js','submission.json','rat-art.json','rat-art.mjs','visual-smoke.mjs','network-smoke.mjs'])assert.ok(fs.existsSync(path.join(root,p)),p+' missing');
for(const p of ['manifest.json','translation.json','resources/icon.svg'])assert.ok(fs.existsSync(path.join(shipping,p)),p+' missing');
const manifest=JSON.parse(fs.readFileSync(path.join(shipping,'manifest.json'),'utf8'));
assert.equal(manifest.author,'PackRat 🐀');
assert.equal(manifest.id,'com.packrat.smartlightingcontrol');
assert.equal(manifest.interactive,true);
assert.deepEqual(manifest.supported_devices,[{type:'dashboard_lcd'}]);
const sub=JSON.parse(fs.readFileSync(path.join(root,'submission.json'),'utf8'));
assert.equal(sub.name,'Smart Lighting Control for Hue + Govee');
assert.equal(sub.price_usd,9.99);
assert.equal(sub.version,'1.0.0');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const prop of ['pairingToken','defaultView','showOffline','textColor','accentColor','backgroundColor'])assert.match(html,new RegExp('content="'+prop+'"'));
assert.ok(html.indexOf('content="textColor"')<html.indexOf('content="accentColor"')&&html.indexOf('content="accentColor"')<html.indexOf('content="backgroundColor"'),'custom style triplet order');
const js=fs.readFileSync(path.join(root,'lighting.js'),'utf8');
assert.match(js,/127\.0\.0\.1/);
assert.doesNotMatch(js,/Govee-API-Key|hue-application-key|apiKey\s*[:=]\s*['"][A-Za-z0-9_-]{12,}/i);
for(const file of fs.readdirSync(root)){
  const full=path.join(root,file);
  if(!fs.statSync(full).isFile())continue;
  const text=fs.readFileSync(full,'utf8');
  assert.doesNotMatch(text,/AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}/,'secret-looking value in '+file);
}
console.log('SMART LIGHTING VERIFY PASS: metadata, iCUE settings, loopback transport, and secret fixture checks');
