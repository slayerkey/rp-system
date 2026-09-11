import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright';

const entry=path.resolve(process.argv[2]||'artifacts/unpacked/index.html');
const out=path.resolve(process.argv[3]||'artifacts/network-smoke');
const companion=path.resolve(process.argv[4]||'artifacts/companion/PackRat-Lighting-Companion.exe');
await fs.mkdir(out,{recursive:true});
await fs.access(entry);await fs.access(companion);

const logs=[];
let active=null;
function startCompanion(protocol=1){
  const proc=spawn(companion,['--fixture','--no-browser','--port','17486','--fixture-protocol',String(protocol)],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  const log={protocol,stdout:'',stderr:''};logs.push(log);
  proc.stdout.on('data',d=>log.stdout+=d);proc.stderr.on('data',d=>log.stderr+=d);
  active=proc;return proc;
}
async function stopCompanion(proc){
  if(!proc||proc.exitCode!==null)return;
  proc.kill();
  await Promise.race([once(proc,'exit'),new Promise(r=>setTimeout(r,2500))]);
}
async function waitHealth(protocol){
  for(let i=0;i<60;i++){
    try{
      const r=await fetch('http://127.0.0.1:17486/health',{cache:'no-store'});
      if(r.ok){
        const body=await r.json();
        if(body.ok&&body.protocol===protocol&&body.version==='1.0.0')return body;
      }
    }catch{}
    await new Promise(r=>setTimeout(r,150));
  }
  throw new Error('fixture companion did not become healthy for protocol '+protocol+'\n'+logs.map(x=>x.stdout+'\n'+x.stderr).join('\n'));
}
async function newWidgetPage(context,token='fixture-token'){
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.addInitScript(({token})=>{
    globalThis.uniqueId='network-smart-lighting';
    globalThis.pairingToken=token;
    globalThis.defaultView='all';
    globalThis.showOffline=true;
    globalThis.textColor='#F7F8FA';
    globalThis.accentColor='#8B5CF6';
    globalThis.backgroundColor='#090A0F';
    globalThis.tr=async v=>v;
  },{token});
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  return{page,errors};
}

const browser=await chromium.launch({headless:true});
const report={ok:false,transport:'file:// -> authenticated ws://127.0.0.1:17486/widget',tests:{}};
try{
  let proc=startCompanion(1);
  report.health=await waitHealth(1);

  const context=await browser.newContext({viewport:{width:840,height:696}});
  const {page,errors}=await newWidgetPage(context);
  await page.waitForFunction(()=>document.body.getAttribute('data-state')==='live'&&document.querySelectorAll('.target-card').length>=3,null,{timeout:8000});
  let state=await page.evaluate(()=>globalThis.__PACKRAT_LIGHTING_TEST__.state);
  assert.equal(state.providers.hue.connected,true,'Hue fixture provider missing');
  assert.equal(state.providers.govee.connected,true,'Govee fixture provider missing');
  report.tests.initialConnect=true;

  // Repeated lifecycle callbacks must be idempotent: appearance/settings refresh
  // cannot create duplicate sockets or reconnect loops.
  const attemptsBefore=await page.evaluate(()=>globalThis.__PACKRAT_LIGHTING_TEST__.state.connectAttempts);
  await page.evaluate(()=>{for(let i=0;i<12;i++)globalThis.icueEvents.onDataUpdated();});
  await page.waitForTimeout(350);
  const attemptsAfter=await page.evaluate(()=>globalThis.__PACKRAT_LIGHTING_TEST__.state.connectAttempts);
  assert.equal(attemptsAfter,attemptsBefore,'repeated onDataUpdated churned companion connections');
  report.tests.idempotentLifecycle=true;

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
  report.tests.controls=true;

  // Provider-side command failures must surface visibly instead of disappearing
  // into console/log state.
  await page.evaluate(()=>globalThis.__PACKRAT_LIGHTING_TEST__.state.socket.send(JSON.stringify({command:'forceError',id:'hue:room:studio'})));
  await page.waitForFunction(()=>!document.getElementById('toast').hidden&&/rejected/i.test(document.getElementById('toast').textContent||''),null,{timeout:3000});
  report.tests.commandErrorFeedback=true;

  // Kill the actual companion process. The exact packaged file:// widget must
  // show a deliberate offline state, then recover after the companion restarts.
  await stopCompanion(proc);
  await page.waitForFunction(()=>document.body.getAttribute('data-state')==='offline',null,{timeout:6000});
  assert.equal(await page.locator('#blockingState').isHidden(),false,'companion stop did not surface offline state');
  proc=startCompanion(1);
  await waitHealth(1);
  await page.waitForFunction(()=>document.body.getAttribute('data-state')==='live',null,{timeout:9000});
  assert.ok((await page.locator('.target-card').count())>=1,'active-filter targets did not recover after companion restart');
  assert.equal(await page.evaluate(()=>globalThis.__PACKRAT_LIGHTING_TEST__.state.filter),'govee','restart unexpectedly reset the user filter');
  report.tests.restartRecovery=true;

  await page.screenshot({path:path.join(out,'live-loopback-recovered.png')});
  assert.deepEqual(errors,[],'packaged live companion runtime errors: '+errors.join(' | '));
  await context.close();
  await stopCompanion(proc);

  // A correct token with an incompatible protocol must fail closed with an
  // explicit update-required state rather than pretending the connection works.
  proc=startCompanion(2);
  await waitHealth(2);
  const mismatchContext=await browser.newContext({viewport:{width:840,height:696}});
  const mismatch=await newWidgetPage(mismatchContext);
  await mismatch.page.waitForFunction(()=>document.body.getAttribute('data-state')==='incompatible',null,{timeout:5000});
  assert.equal(await mismatch.page.locator('#blockingState').isHidden(),false,'protocol mismatch did not show blocking state');
  assert.match(await mismatch.page.locator('#blockingTitle').textContent(),/update required/i);
  assert.deepEqual(mismatch.errors,[],'protocol mismatch produced runtime errors');
  report.tests.protocolMismatch=true;
  await mismatchContext.close();

  // Authentication remains fail-closed independently of protocol version.
  const badContext=await browser.newContext({viewport:{width:840,height:696}});
  const bad=await newWidgetPage(badContext,'wrong-token');
  await bad.page.waitForFunction(()=>document.body.getAttribute('data-state')==='unauthorized',null,{timeout:5000});
  assert.equal(await bad.page.locator('#blockingState').isHidden(),false,'wrong token did not show blocking state');
  assert.deepEqual(bad.errors,[],'wrong-token path produced runtime errors');
  report.tests.wrongTokenRejected=true;
  await badContext.close();

  report.ok=true;
  console.log('SMART LIGHTING NETWORK QA PASS: idempotent lifecycle, controls, restart recovery, protocol mismatch, wrong-token rejection');
}finally{
  await browser.close();
  await stopCompanion(active);
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));
  await fs.writeFile(path.join(out,'companion-runs.json'),JSON.stringify(logs,null,2));
}
