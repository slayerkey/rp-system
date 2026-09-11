import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('widgets/_src/smart-lighting-control');
const shipping=path.resolve('widgets/smart-lighting-control');
const companion=path.resolve('companions/smart-lighting-control');

for(const p of ['index.html','lighting.css','lighting.js','submission.json','rat-art.json','rat-art.mjs','visual-smoke.mjs','network-smoke.mjs'])assert.ok(fs.existsSync(path.join(root,p)),p+' missing');
for(const p of ['manifest.json','translation.json','resources/icon.svg'])assert.ok(fs.existsSync(path.join(shipping,p)),p+' missing');
for(const p of ['PackRat.SmartLighting.Companion.csproj','Program.cs','Controller.cs','HueClient.cs','GoveeClient.cs','LocalState.cs','Models.cs','CompanionInstall.cs','CUSTOMER-SETUP.txt','README.md'])assert.ok(fs.existsSync(path.join(companion,p)),'companion/'+p+' missing');

const manifest=JSON.parse(fs.readFileSync(path.join(shipping,'manifest.json'),'utf8'));
assert.equal(manifest.author,'PackRat 🐀');
assert.equal(manifest.id,'com.packrat.smartlightingcontrol');
assert.equal(manifest.interactive,true);
assert.deepEqual(manifest.supported_devices,[{type:'dashboard_lcd'}]);

const sub=JSON.parse(fs.readFileSync(path.join(root,'submission.json'),'utf8'));
assert.equal(sub.name,'Smart Lighting Control for Hue + Govee');
assert.equal(sub.price_usd,9.99);
assert.equal(sub.version,'1.0.0');
assert.match(sub.description,/without setting up Home Assistant/i);
assert.match(sub.description,/no PackRat cloud/i);
assert.match(sub.description,/main\.packrat-site\.pages\.dev\/downloads\/smart-lighting/i);

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const prop of ['pairingToken','defaultView','showOffline','textColor','accentColor','backgroundColor'])assert.match(html,new RegExp('content="'+prop+'"'));
assert.ok(html.indexOf('content="textColor"')<html.indexOf('content="accentColor"')&&html.indexOf('content="accentColor"')<html.indexOf('content="backgroundColor"'),'custom style triplet order');

const js=fs.readFileSync(path.join(root,'lighting.js'),'utf8');
assert.match(js,/ws:\/\/127\.0\.0\.1:17486\/widget/);
assert.match(js,/main\.packrat-site\.pages\.dev\/downloads\/smart-lighting/);
assert.match(js,/onICUEInitialized/);
assert.match(js,/onDataUpdated/);
assert.match(js,/pagehide/);
assert.doesNotMatch(js,/Govee-API-Key|hue-application-key|apiKey\s*[:=]\s*['"][A-Za-z0-9_-]{12,}/i);

const program=fs.readFileSync(path.join(companion,'Program.cs'),'utf8');
assert.match(program,/UseUrls\(\$"http:\/\/127\.0\.0\.1:\{port\}"\)/,'companion must bind loopback only');
assert.doesNotMatch(program,/0\.0\.0\.0|ListenAnyIP|UseUrls\([^\n]*\*:/i,'companion exposes a non-loopback listener');
assert.match(program,/WidgetOriginAllowed/);
assert.match(program,/TokenEqual/);

const localState=fs.readFileSync(path.join(companion,'LocalState.cs'),'utf8');
assert.match(localState,/CredWriteW/);
assert.match(localState,/PackRat\.SmartLighting\.HueAppKey/);
assert.match(localState,/PackRat\.SmartLighting\.GoveeApiKey/);
assert.match(localState,/CurrentSchemaVersion/);

const setup=fs.readFileSync(path.join(companion,'CUSTOMER-SETUP.txt'),'utf8');
assert.match(setup,/127\.0\.0\.1:17486/);
assert.match(setup,/Install locally \+ start with Windows/);
assert.match(setup,/No PackRat account is required/);
assert.match(setup,/main\.packrat-site\.pages\.dev\/downloads\/smart-lighting/);

const secretPattern=/AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|(?:api[_-]?key|token|secret)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i;
for(const dir of [root,companion]){
  for(const file of fs.readdirSync(dir)){
    const full=path.join(dir,file);
    if(!fs.statSync(full).isFile())continue;
    const text=fs.readFileSync(full,'utf8');
    assert.doesNotMatch(text,secretPattern,'secret-looking value in '+path.relative(process.cwd(),full));
  }
}

console.log('SMART LIGHTING VERIFY PASS: metadata, lifecycle, loopback security, Credential Manager storage, customer setup, and secret fixture checks');
