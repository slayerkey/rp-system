import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const entry=path.resolve(process.argv[2]||'artifacts/unpacked/index.html');
const out=path.resolve(process.argv[3]||'artifacts/network-smoke');
const companion=path.resolve(process.argv[4]||'artifacts/companion/PackRat-Lighting-Companion.exe');
await fs.mkdir(out,{recursive:true});
await fs.access(entry);await fs.access(companion);

const proc=spawn(companion,['--fixture','--no-browser','--port','17486'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let stdout='',stderr='';proc.stdout.on('data',d=>stdout+=d);proc.stderr.on('data',d=>stderr+=d);
async function waitHealth(){
  for(let i=0;i<50;i++){try{const r=await fetch('http://127.0.0.1:17486/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,150));}
  throw new Error('fixture companion did not become healthy\n'+stdout+'\n'+stderr);
}
const browser=await chromium.launch({headless:true});
try{
  await waitHealth();
  const context=await browser.newContext({viewport:{width:840,height:696}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.addInitScript(()=>{
    globalThis.uniqueId='network-smart-lighting';
    globalThis.pairingToken='fixture-token';
    globalThis.defaultView='all';
    globalThis.showOffline=true;
    globalThis.textColor='#F7F8FA';
    globalThis.accentColor='#8B5CF6';
    globalThis.backgroundColor='#090A0F';
    globalThis.tr=async v=>v;
  });
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await page.waitForFunction(()=>document.body.getAttribute('data-state')==='live'&&document.querySelectorAll('.target-card').length>=3,null,{timeout:8000});
  let state=await page.evaluate(()=>globalThis.__PACKRAT_LIGHTING_TEST__.state);
  assert.equal(state.providers.hue.connected,true,'Hue fixture provider missing');
  assert.equal(state.providers.govee.connected,true,'Govee fixture provider missing');

  await page.locator('[data-id="hue:room:studio"]').click();
  await page.locator('#powerButton').click();
  await page.waitForFunction(()=>globalThis.__PACKRAT_LIGHTING_TEST__.selected()?.on===false);
  await page.locator('#brightnessSlider').fill('48');
  await page.locator('#brightnessSlider').dispatchEvent('change');
  await page.waitForFunction(()=>Math.round(globalThis.__PACKRAT_LIGHTING_TEST__.selected()?.brightness||0)===48);

  await page.locator('[data-filter="govee"]').click();
  await page.locator('[data-id="govee:device:bars"]').click();
  await page.locator('#favoriteButton').click();
  await page.waitForFunction(()=>globalThis.__PACKRAT_LIGHTING_TEST__.selected()?.favorite===false);
  await page.screenshot({path:path.join(out,'live-loopback.png')});
  assert.deepEqual(errors,[],'packaged live companion runtime errors: '+errors.join(' | '));
  await context.close();

  const badContext=await browser.newContext({viewport:{width:840,height:696}});
  const bad=await badContext.newPage();
  await bad.addInitScript(()=>{globalThis.pairingToken='wrong-token';globalThis.defaultView='all';globalThis.showOffline=true;globalThis.textColor='#fff';globalThis.accentColor='#8B5CF6';globalThis.backgroundColor='#090A0F';globalThis.tr=async v=>v;});
  await bad.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await bad.waitForFunction(()=>document.body.getAttribute('data-state')==='unauthorized',null,{timeout:5000});
  assert.equal(await bad.locator('#blockingState').isHidden(),false,'wrong token did not show blocking state');
  await badContext.close();

  await fs.writeFile(path.join(out,'results.json'),JSON.stringify({ok:true,transport:'file:// -> authenticated ws://127.0.0.1:17486/widget',commands:['power','brightness','favorite'],wrongTokenRejected:true},null,2));
  console.log('SMART LIGHTING NETWORK QA PASS: exact packaged file-origin widget authenticated to real fixture companion and round-tripped controls');
}finally{
  await browser.close();
  if(!proc.killed)proc.kill();
  await fs.writeFile(path.join(out,'companion.stdout.log'),stdout);
  await fs.writeFile(path.join(out,'companion.stderr.log'),stderr);
}
