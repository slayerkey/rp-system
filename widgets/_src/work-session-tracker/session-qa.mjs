import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

export async function runSessionQa(edition, entryArg, outDirArg) {
  const entry = path.resolve(entryArg);
  const outDir = path.resolve(outDirArg || `artifacts/session-qa-${edition}`);
  if (!fs.existsSync(entry)) throw new Error(`missing packaged entry: ${entry}`);
  fs.mkdirSync(outDir, { recursive: true });
  const isPro = edition === 'pro';
  const fixedNow = Date.UTC(2026, 7, 20, 18, 30, 0);
  const minute = 60_000;
  const hour = 3_600_000;
  const slots = { 's-h':[840,344], 's-v':[696,416], 'm-h':[840,696], 'm-v':[696,840], 'l-h':[1688,696], 'l-v':[696,1688], 'xl-h':[2536,696], 'xl-v':[696,2536] };
  const report = { schema_version:1, edition, slots:{}, transitions:{}, restart:{}, midnight:{}, history:{}, dst:{}, pro:{}, runtimeErrors:[] };
  const browser = await chromium.launch({ headless:true });

  function fixture() {
    return {
      sequence:10,
      lastProjectName:'Website Redesign',
      projects:isPro ? [{id:'web',name:'Website Redesign',color:'#2BE86A'},{id:'write',name:'Writing',color:'#62A8FF'}] : [],
      sessions:[
        {id:'one',name:'Writing',color:'#62A8FF',kind:'focus',startedAtMs:fixedNow-9*hour,endedAtMs:fixedNow-8*hour,segments:[{startMs:fixedNow-9*hour,endMs:fixedNow-8*hour}],manualAdjustmentMs:0},
        {id:'two',name:'Email',color:'#FFB454',kind:'focus',startedAtMs:fixedNow-7.5*hour,endedAtMs:fixedNow-7*hour,segments:[{startMs:fixedNow-7.5*hour,endMs:fixedNow-7*hour}],manualAdjustmentMs:0}
      ],
      active:{id:'active',name:'Website Redesign',projectId:isPro?'web':null,color:'#2BE86A',kind:'focus',startedAtMs:fixedNow-2*hour,status:'running',segments:[{startMs:fixedNow-2*hour,endMs:null}]}
    };
  }

  async function configure(context, withFixture=false, unique='qa') {
    await context.addInitScript(({ now, fx, id, goal }) => {
      globalThis.__qaNow = now;
      Date.now = () => globalThis.__qaNow;
      globalThis.uniqueId = id;
      globalThis.dailyGoalMinutes = goal;
      globalThis.textColor='#F4F6F8'; globalThis.accentColor='#2BE86A'; globalThis.backgroundColor='#07090D';
      globalThis.tr = async v => v;
      globalThis.pluginLinkprovider_initialized = true;
      globalThis.plugins = { Linkprovider:{ open(link){ globalThis.__openedLink=link; } } };
      if (fx) globalThis.__workSessionFixture = fx;
    }, { now:fixedNow, fx:withFixture?fixture():null, id:`${unique}-${edition}`, goal:240 });
  }

  async function open(context) {
    const page = await context.newPage();
    page.on('pageerror', e => report.runtimeErrors.push(`pageerror:${String(e)}`));
    page.on('console', msg => { if (msg.type()==='error') report.runtimeErrors.push(`console:${msg.text()}`); });
    await page.goto(pathToFileURL(entry).href, { waitUntil:'load', timeout:20_000 });
    await page.waitForFunction(() => globalThis.__workSessionReady === true, { timeout:5000 });
    return page;
  }

  try {
    for (const [slot, [w,h]] of Object.entries(slots)) {
      const context = await browser.newContext({ viewport:{width:w,height:h} });
      await configure(context, true, `slot-${slot}`);
      const page = await open(context);
      await page.waitForTimeout(40);
      const data = await page.evaluate(() => {
        const buttons=[...document.querySelectorAll('button')].filter(b=>{const s=getComputedStyle(b),r=b.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;}).map(b=>{const r=b.getBoundingClientRect();return {id:b.id||b.textContent.trim(),w:r.width,h:r.height};});
        return { slot:document.body.dataset.slot, sw:document.documentElement.scrollWidth, sh:document.documentElement.scrollHeight, iw:innerWidth, ih:innerHeight, state:document.body.dataset.sessionState, total:document.getElementById('todayTotal')?.textContent, timeline:document.querySelectorAll('.timeline-block').length, buttons };
      });
      if (data.slot!==slot) throw new Error(`slot mismatch ${slot}: ${JSON.stringify(data)}`);
      if (data.sw>data.iw+0.5 || data.sh>data.ih+0.5) throw new Error(`overflow ${slot}: ${JSON.stringify(data)}`);
      if (data.state!=='running' || !data.timeline || data.total==='0m') throw new Error(`fixture state failed ${slot}: ${JSON.stringify(data)}`);
      for (const b of data.buttons) if (b.w<44 || b.h<44) throw new Error(`touch target under 44px in ${slot}: ${JSON.stringify(b)}`);
      report.slots[slot]={ overflow:false, visibleButtons:data.buttons.length, touch44:true };
      await context.close();
    }

    const context = await browser.newContext({ viewport:{width:1688,height:696} });
    await configure(context, false, 'behavior');
    const page = await open(context);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil:'load' });
    await page.waitForFunction(() => globalThis.__workSessionReady === true);
    await page.evaluate(now => globalThis.__workSessionTest.setNow(now), fixedNow);
    await page.locator('#projectInput').fill('Deep Work');
    await page.locator('#startButton').click();
    await page.waitForFunction(() => document.body.dataset.sessionState==='running');
    const firstId = await page.evaluate(() => globalThis.__workSessionTest.getState().active.id);
    await page.evaluate(now => globalThis.__workSessionTest.setNow(now), fixedNow + 3*hour + 15*minute + 12_000);
    const longElapsed = (await page.locator('#elapsed').textContent()).trim();
    if (longElapsed!=='03:15:12') throw new Error(`long session derivation failed: ${longElapsed}`);
    await page.evaluate(() => globalThis.__workSessionTest.pause());
    const paused = (await page.locator('#elapsed').textContent()).trim();
    await page.evaluate(now => globalThis.__workSessionTest.setNow(now), fixedNow + 5*hour + 15*minute + 12_000);
    const pausedLater=(await page.locator('#elapsed').textContent()).trim();
    if (paused!==pausedLater) throw new Error(`paused time advanced: ${paused} -> ${pausedLater}`);
    await page.evaluate(() => globalThis.__workSessionTest.resume());
    await page.evaluate(now => globalThis.__workSessionTest.setNow(now), fixedNow + 6*hour + 15*minute + 12_000);
    const resumed=(await page.locator('#elapsed').textContent()).trim();
    if (resumed!=='04:15:12') throw new Error(`resume derivation failed: ${resumed}`);
    const crossScreen=await page.evaluate(()=>{
      const edition=document.body.dataset.edition;
      const restored=globalThis.__workSessionTest.loadForInstance('second-iCUE-screen-'+edition);
      return {id:restored.active?.id,name:restored.active?.name,status:restored.active?.status};
    });
    if(crossScreen.id!==firstId||crossScreen.name!=='Deep Work'||crossScreen.status!=='running')
      throw new Error('cross-screen active session was lost: '+JSON.stringify(crossScreen));
    report.transitions.crossScreenRecovery=crossScreen;
    await page.evaluate(() => globalThis.__workSessionTest.finish());
    const transitionState=await page.evaluate(()=>globalThis.__workSessionTest.getState());
    if(transitionState.active!==null||transitionState.sessions.length!==1||transitionState.sessions[0].id===firstId) throw new Error(`finish state failed: ${JSON.stringify(transitionState)}`);
    const secondFinish=await page.evaluate(()=>globalThis.__workSessionTest.finish());
    if(secondFinish!==false||transitionState.sessions.length!==1) throw new Error('double finish was not idempotent');
    report.transitions={ longElapsed, paused, pausedLater, resumed, completed:1, doubleTapSafe:true };

    if (!isPro) {
      await page.evaluate(now=>globalThis.__workSessionTest.setNow(now),fixedNow+7*hour);
      await page.locator('#upgradeButton').click();
      const opened=await page.evaluate(()=>globalThis.__openedLink||null);
      if(opened!=='https://marketplace.elgato.com/product/work-session-tracker-pro-f8e12d94-4354-41ca-b6da-beb2297fb9e2') throw new Error(`LinkProvider upgrade route failed: ${opened}`);
      report.transitions.upgradeRoute=opened;
    }

    await page.evaluate(() => localStorage.clear());
    await page.reload({waitUntil:'load'}); await page.waitForFunction(()=>globalThis.__workSessionReady===true);
    await page.evaluate(() => globalThis.__workSessionTest.start('Clock Guard','focus'));
    await page.evaluate(delta => { globalThis.__qaNow += delta; globalThis.__workSessionTest.render(); }, hour);
    const clockGuard=(await page.locator('#elapsed').textContent()).trim();
    if(clockGuard!=='00:00:00') throw new Error(`active clock jump guard failed: ${clockGuard}`);
    report.transitions.clockJumpGuard=clockGuard;

    const storageKey=`behavior-${edition}:work-session:${edition}:state`;
    await page.evaluate(({key,now})=>{
      localStorage.removeItem('packrat:work-session:'+EDITION+':shared-state-v2');
      localStorage.setItem(key,JSON.stringify({version:2,sequence:1,lastProjectName:'Recovered',projects:[],sessions:[],active:{id:'recover',name:'Recovered',color:'#2BE86A',kind:'focus',startedAtMs:now-2*3600000,status:'running',segments:[{startMs:now-2*3600000,endMs:null}]}}));
    },{key:storageKey,now:fixedNow});
    await page.reload({waitUntil:'load'}); await page.waitForFunction(()=>globalThis.__workSessionReady===true);
    const recovered=(await page.locator('#elapsed').textContent()).trim();
    if(recovered!=='02:00:00') throw new Error(`restart recovery failed: ${recovered}`);
    await page.evaluate(({key,now})=>{
      localStorage.removeItem('packrat:work-session:'+EDITION+':shared-state-v2');
      localStorage.setItem(key,JSON.stringify({version:2,sequence:1,lastProjectName:'Paused',projects:[],sessions:[],active:{id:'pause-recover',name:'Paused',color:'#2BE86A',kind:'focus',startedAtMs:now-3*3600000,status:'paused',segments:[{startMs:now-3*3600000,endMs:now-2*3600000}]}}));
    },{key:storageKey,now:fixedNow});
    await page.reload({waitUntil:'load'}); await page.waitForFunction(()=>globalThis.__workSessionReady===true);
    const pauseRecovered=(await page.locator('#elapsed').textContent()).trim();
    if(pauseRecovered!=='01:00:00') throw new Error(`pause recovery failed: ${pauseRecovered}`);
    report.restart={ running:recovered, paused:pauseRecovered };

    await page.evaluate(key=>{localStorage.removeItem(key); localStorage.removeItem('packrat:work-session:'+EDITION+':shared-state-v2');},storageKey); await page.reload({waitUntil:'load'}); await page.waitForFunction(()=>globalThis.__workSessionReady===true);
    const midnight=await page.evaluate(() => {
      const api=globalThis.__workSessionTest;
      const t0=new Date(2026,0,15,23,50,0,0).getTime();
      api.setNow(t0); api.start('Midnight Build','focus'); api.setNow(t0+40*60000); api.finish();
      return { before:api.focusForDay(t0), after:api.focusForDay(t0+40*60000) };
    });
    if(Math.abs(midnight.before-10*minute)>1000||Math.abs(midnight.after-30*minute)>1000) throw new Error(`midnight split failed: ${JSON.stringify(midnight)}`);
    report.midnight=midnight;

    const cap=isPro?1500:150, keepDays=isPro?120:8;
    await page.evaluate(({key,now,count,keepDays})=>{
      const sessions=[];
      for(let i=0;i<count;i++){
        const end=now-(i%Math.max(1,keepDays-1))*86400000-60000;
        sessions.push({id:'h'+i,name:'History',color:'#2BE86A',kind:'focus',startedAtMs:end-60000,endedAtMs:end,segments:[{startMs:end-60000,endMs:end}],manualAdjustmentMs:0});
      }
      const old=now-(keepDays+5)*86400000;
      sessions.push({id:'old',name:'Old',color:'#2BE86A',kind:'focus',startedAtMs:old-60000,endedAtMs:old,segments:[{startMs:old-60000,endMs:old}],manualAdjustmentMs:0});
      localStorage.removeItem('packrat:work-session:'+EDITION+':shared-state-v2');
      localStorage.setItem(key,JSON.stringify({version:2,sequence:9999,lastProjectName:'',projects:[],active:null,sessions}));
    },{key:storageKey,now:fixedNow,count:cap+80,keepDays});
    await page.reload({waitUntil:'load'}); await page.waitForFunction(()=>globalThis.__workSessionReady===true);
    const history=await page.evaluate(()=>{globalThis.__workSessionTest.prune();const s=globalThis.__workSessionTest.getState().sessions;return {count:s.length,old:s.some(x=>x.id==='old')};});
    if(history.count>cap||history.old) throw new Error(`history pruning failed: ${JSON.stringify(history)}`);
    report.history={...history,cap,keepDays};

    if(isPro){
      await page.evaluate(()=>localStorage.clear()); await page.reload({waitUntil:'load'}); await page.waitForFunction(()=>globalThis.__workSessionReady===true);
      await page.locator('#projectInput').fill('Client Site'); await page.locator('#saveProject').click();
      await page.waitForFunction(()=>document.querySelectorAll('.project-chip').length===1);
      await page.waitForTimeout(350);
      await page.locator('.project-chip').click(); await page.evaluate(now=>globalThis.__workSessionTest.setNow(now),fixedNow+hour); await page.evaluate(()=>globalThis.__workSessionTest.finish());
      const beforeBreak=await page.evaluate(()=>globalThis.__workSessionTest.focusForDay(Date.now()));
      await page.waitForTimeout(350);
      await page.locator('#breakButton').click(); await page.evaluate(now=>globalThis.__workSessionTest.setNow(now),fixedNow+hour+30*minute); await page.evaluate(()=>globalThis.__workSessionTest.finish());
      const afterBreak=await page.evaluate(()=>globalThis.__workSessionTest.focusForDay(Date.now()));
      if(Math.abs(afterBreak-beforeBreak)>1000) throw new Error(`break counted as focus: ${beforeBreak} -> ${afterBreak}`);
      const beforeAdjust=await page.evaluate(()=>{const s=globalThis.__workSessionTest.getState().sessions.filter(x=>x.kind==='focus').slice(-1)[0];return globalThis.__workSessionTest.durationSegments(s.segments,s.endedAtMs)+s.manualAdjustmentMs;});
      await page.evaluate(()=>globalThis.__workSessionTest.adjustLast(5));
      const afterAdjust=await page.evaluate(()=>{const s=globalThis.__workSessionTest.getState().sessions.filter(x=>x.kind==='focus').slice(-1)[0];return globalThis.__workSessionTest.durationSegments(s.segments,s.endedAtMs)+s.manualAdjustmentMs;});
      if(afterAdjust-beforeAdjust!==5*minute) throw new Error(`manual correction failed ${beforeAdjust} -> ${afterAdjust}`);
      report.pro={ savedProjects:1, breakExcluded:true, adjustmentMs:afterAdjust-beforeAdjust };
    }
    await context.close();

    const dstContext=await browser.newContext({viewport:{width:840,height:696},timezoneId:'America/New_York'});
    await configure(dstContext,false,'dst'); const dstPage=await open(dstContext);
    const dst=await dstPage.evaluate(()=>{const api=globalThis.__workSessionTest;const spring=new Date(2026,2,8,12).getTime(),fall=new Date(2026,10,1,12).getTime();const s=api.dayBounds(spring),f=api.dayBounds(fall);return {springHours:(s.end-s.start)/3600000,fallHours:(f.end-f.start)/3600000};});
    if(dst.springHours!==23||dst.fallHours!==25) throw new Error(`DST day bounds failed: ${JSON.stringify(dst)}`);
    report.dst=dst; await dstContext.close();

    if(report.runtimeErrors.length) throw new Error(`runtime errors: ${JSON.stringify(report.runtimeErrors)}`);
    fs.writeFileSync(path.join(outDir,'session-qa-result.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`WORK SESSION ${edition.toUpperCase()} QA PASS`);
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
}
