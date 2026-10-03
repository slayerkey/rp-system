import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {resolve} from 'node:path';
import {render,neoFeedback,brightnessPct,brightnessSupport} from '../src/render.js';
import {HAClient} from '../src/ha-client.js';
const root=resolve(import.meta.dirname||new URL('.',import.meta.url).pathname,'..');
const plugin=resolve(root,'com.packrat.home-assistant-streamdeck.sdPlugin');
const client=new HAClient();
test('setup/error/unknown key states do not show fake numbers or units',()=>{
 for(const state of ['SETUP','OFFLINE','AUTH_ERROR','ERROR']){client.state=state;const s=render(client,'graph',{entityId:'sensor.temperature'});assert(!s.includes('0°C'));assert.match(s,/svg/)}
});
test('live overview renders three independently weighted values and escapes HA labels',()=>{
 client.state='LIVE';client.entities=new Map([
  ['sensor.one',{entity_id:'sensor.one',state:'0',attributes:{friendly_name:'A & B',unit_of_measurement:'°C'}}],
  ['sensor.two',{entity_id:'sensor.two',state:'22',attributes:{friendly_name:'Humidity',unit_of_measurement:'%'}}],
  ['sensor.three',{entity_id:'sensor.three',state:'unavailable',attributes:{friendly_name:'Air Quality'}}],
 ]);
 const s=render(client,'overview',{entityIds:[...client.entities.keys()]});assert.match(s,/A &amp; B/);assert.match(s,/N\/A/);assert.equal((s.match(/text-anchor="middle"/g)||[]).length,7);
});
test('brightness capability is checked per selected light',()=>{
 const capable={entity_id:'light.room',state:'on',attributes:{brightness:128,supported_color_modes:['brightness']}};
 assert.equal(brightnessSupport(capable),true);assert.equal(brightnessPct(capable),50);
 assert.equal(brightnessSupport({entity_id:'switch.fan',attributes:{brightness:200}}),false);
 assert.equal(brightnessSupport({entity_id:'light.onoff',attributes:{supported_color_modes:['onoff']}}),false);
});
test('Neo feedback is display-only and 3-column actual-state aware',()=>{
 const feedback=neoFeedback(client,['sensor.one','sensor.two','missing.entity']);assert.equal(feedback.firstValue,'0°C');assert.equal(feedback.secondValue,'22%');assert.equal(feedback.thirdValue,'--');
});
test('all manifest keypad actions own their faces and have matching paths',async()=>{
 const manifest=JSON.parse(await readFile(resolve(plugin,'manifest.json')));
 assert.equal(manifest.UUID,'com.packrat.home-assistant-streamdeck');assert.equal(manifest.Actions.length,7);
 for(const act of manifest.Actions){assert(act.States.every(s=>s.ShowTitle===false));assert(!act.Icon.includes('undefined'));}
 assert.deepEqual(manifest.Profiles.map(p=>p.DeviceType),[0,2,7,9]);
});
test('unconfigured bundled profiles never include pretend customer entities',async()=>{
 const files=await readdir(resolve(plugin,'profiles'));assert.equal(files.length,4);
 for(const name of files){const archive=await readFile(resolve(plugin,'profiles',name));assert(!archive.includes(Buffer.from('sensor.fake')));assert(archive.length>200)}
});
test('property inspector has a real PI websocket context and dirty race guard',async()=>{
 const source=await readFile(resolve(plugin,'ui/inspector.js'),'utf8');assert.match(source,/context=uiUuid/);assert.match(source,/if\(dirty\|\|waiting\)return/);assert.match(source,/actionContext/);assert(!source.includes('eval('));
});

test('unsupported services render an explicit non-actionable key rather than a fake control',()=>{
 const c={state:'LIVE',entity:id=>({entity_id:id,state:'on',attributes:{friendly_name:'Office'}}),serviceAvailable:()=>false};
 assert.match(render(c,'control',{entityId:'light.office'}),/NO SERVICE/);
 assert.match(render(c,'trigger',{entityId:'scene.sleep'}),/NO SERVICE/);
});
