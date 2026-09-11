import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

function baseTargets(){
  return [
    {id:'hue:room:studio',provider:'hue',kind:'room',name:'Studio',on:true,brightness:72,color:{r:255,g:198,b:112},temperatureK:3600,temperatureRange:[2000,6500],reachable:true,favorite:true,capabilities:{power:true,brightness:true,color:true,temperature:true},scenes:[{id:'hue:scene:focus',name:'Focus'},{id:'hue:scene:relax',name:'Relax'}]},
    {id:'hue:light:key',provider:'hue',kind:'light',name:'Key Light',on:true,brightness:84,color:{r:255,g:224,b:185},temperatureK:4100,temperatureRange:[2200,6500],reachable:true,favorite:false,capabilities:{power:true,brightness:true,color:true,temperature:true},scenes:[{id:'hue:scene:focus',name:'Focus'},{id:'hue:scene:relax',name:'Relax'}]},
    {id:'hue:light:lamp',provider:'hue',kind:'light',name:'Desk Lamp',on:false,brightness:46,color:{r:120,g:170,b:255},temperatureK:3000,temperatureRange:[2000,6500],reachable:true,favorite:false,capabilities:{power:true,brightness:true,color:true,temperature:true},scenes:[]},
    {id:'hue:scene:focus',provider:'hue',kind:'scene',name:'Focus',reachable:true,favorite:true,parentId:'hue:room:studio',capabilities:{scene:true}},
    {id:'govee:device:bars',provider:'govee',kind:'light',name:'Desk Bars',on:true,brightness:61,color:{r:139,g:92,b:246},temperatureK:0,reachable:true,favorite:true,transport:'lan',capabilities:{power:true,brightness:true,color:true,temperature:false},scenes:[{id:'govee:scene:aurora',name:'Aurora'},{id:'govee:scene:neon',name:'Neon'}]},
    {id:'govee:device:strip',provider:'govee',kind:'light',name:'Shelf Strip',on:true,brightness:38,color:{r:56,g:189,b:248},temperatureK:4400,temperatureRange:[2000,6500],reachable:true,favorite:false,transport:'cloud+lan',capabilities:{power:true,brightness:true,color:true,temperature:true},scenes:[{id:'govee:scene:aurora',name:'Aurora'}]},
    {id:'govee:device:floor',provider:'govee',kind:'light',name:'Floor Lamp',on:false,brightness:22,color:{r:255,g:132,b:72},reachable:false,favorite:false,transport:'cloud',capabilities:{power:true,brightness:true,color:true,temperature:true},temperatureRange:[2200,6500],scenes:[]},
    {id:'govee:scene:aurora',provider:'govee',kind:'scene',name:'Aurora',reachable:true,favorite:true,parentId:'govee:device:bars',capabilities:{scene:true}}
  ];
}
const entry=path.resolve(process.argv[2]||'widgets/smart-lighting-control/index.html');
const out=path.resolve(process.argv[3]||'artifacts/smart-lighting-visual');
await fs.mkdir(out,{recursive:true});
const slots=[
  ['S_H',840,344],['S_V',696,416],['M_H',840,696],['M_V',696,840],
  ['L_H',1688,696],['L_V',696,1688],['XL_H',2536,696],['XL_V',696,2536]
];
const browser=await chromium.launch({headless:true});
const results=[];
try{
  for(const [name,width,height] of slots){
    const context=await browser.newContext({viewport:{width,height}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.addInitScript(({targets})=>{
      globalThis.uniqueId='visual-smart-lighting';globalThis.pairingToken='fixture-token';globalThis.defaultView='favorites';globalThis.showOffline=true;
      globalThis.textColor='#F7F8FA';globalThis.accentColor='#8B5CF6';globalThis.backgroundColor='#090A0F';globalThis.tr=async v=>v;globalThis.icueEvents={};
      globalThis.__PACKRAT_LIGHTING_FIXTURE__={connection:'live',providers:{hue:{connected:true},govee:{connected:true,lan:true,cloud:true}},targets,forceFilter:'favorites',selectedId:'hue:room:studio'};
    },{targets:baseTargets()});
    await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
    await page.waitForFunction(()=>Boolean(globalThis.__PACKRAT_LIGHTING_TEST__)&&document.querySelectorAll('.target-card').length>=3);
    await page.waitForTimeout(250);
    const layout=await page.evaluate(()=>({
      overflowX:document.documentElement.scrollWidth-innerWidth,
      overflowY:document.documentElement.scrollHeight-innerHeight,
      cards:[...document.querySelectorAll('.target-card')].map(e=>{const r=e.getBoundingClientRect();return[w=e.clientWidth,h=e.clientHeight]}),
      filters:[...document.querySelectorAll('.filter')].map(e=>{const r=e.getBoundingClientRect();return[r.width,r.height]}),
      controls:[...document.querySelectorAll('#powerButton,#favoriteButton')].filter(e=>!e.hidden).map(e=>{const r=e.getBoundingClientRect();return[r.width,r.height]})
    }));
    assert.ok(layout.overflowX<=1&&layout.overflowY<=1,name+' document overflow '+JSON.stringify(layout));
    for(const [,h] of layout.filters)assert.ok(h>=38,name+' filter too small');
    for(const [w,h] of layout.controls)assert.ok(w>=44&&h>=44,name+' control too small '+w+'x'+h);
    await page.locator('[data-id="hue:room:studio"]').click();
    await page.locator('#powerButton').click();
    assert.equal(await page.evaluate(()=>globalThis.__PACKRAT_LIGHTING_TEST__.selected().on),false,name+' power fixture command failed');
    await page.locator('#brightnessSlider').fill('55');await page.locator('#brightnessSlider').dispatchEvent('change');
    assert.equal(Math.round(await page.evaluate(()=>globalThis.__PACKRAT_LIGHTING_TEST__.selected().brightness)),55,name+' brightness fixture failed');
    await page.locator('[data-filter="govee"]').click();
    assert.ok(await page.locator('.target-card').count()>=1,name+' govee filter empty');
    await page.screenshot({path:path.join(out,name+'.png')});
    assert.deepEqual(errors,[],name+' runtime errors '+errors.join(' | '));
    results.push({name,width,height,layout});
    await context.close();
  }
  // Error / edge states.
  for(const state of ['offline','unconfigured','unauthorized']){
    const context=await browser.newContext({viewport:{width:840,height:696}}),page=await context.newPage();
    await page.addInitScript(({state})=>{
      globalThis.pairingToken='fixture-token';globalThis.defaultView='favorites';globalThis.showOffline=true;globalThis.textColor='#fff';globalThis.accentColor='#8B5CF6';globalThis.backgroundColor='#090A0F';globalThis.tr=async v=>v;
      globalThis.__PACKRAT_LIGHTING_FIXTURE__={connection:state,providers:{hue:{connected:false},govee:{connected:false}},targets:[]};
    },{state});
    await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await page.waitForTimeout(100);
    assert.equal(await page.locator('#blockingState').isHidden(),false,state+' blocking state missing');
    await context.close();
  }
}finally{await browser.close()}
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
console.log('SMART LIGHTING VISUAL QA PASS: 8 XENEON compositions + offline/unconfigured/unauthorized fixtures');
