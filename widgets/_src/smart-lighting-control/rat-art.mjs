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
export const variants=[
  {name:'hue_only',slot:'M_H',mode:'hue'},
  {name:'govee_only',slot:'M_H',mode:'govee'},
  {name:'offline',slot:'S_H',mode:'offline'}
];
function fixtureFor(context){
  let targets=baseTargets();
  let providers={hue:{connected:true,detail:'Hue Bridge local'},govee:{connected:true,lan:true,cloud:true,detail:'LAN + Developer API'}};
  let forceFilter='favorites',selectedId='hue:room:studio',connection='live';
  const mode=context.variant?.mode;
  if(mode==='hue'){targets=targets.filter(t=>t.provider==='hue');providers.govee={connected:false};forceFilter='hue';}
  if(mode==='govee'){targets=targets.filter(t=>t.provider==='govee');providers.hue={connected:false};forceFilter='govee';selectedId='govee:device:bars';}
  if(mode==='offline'){connection='offline';targets=[];providers={hue:{connected:false},govee:{connected:false}};selectedId=null;}
  return{connection,providers,targets,forceFilter,selectedId};
}
export async function prepare(page,context){
  await page.addInitScript(({fixture})=>{
    globalThis.uniqueId='rat-art-smart-lighting';
    globalThis.pairingToken='rat-art-local-token';
    globalThis.defaultView='favorites';
    globalThis.showOffline=true;
    globalThis.textColor='#F7F8FA';
    globalThis.accentColor='#8B5CF6';
    globalThis.backgroundColor='#090A0F';
    globalThis.tr=async value=>value;
    globalThis.icueEvents={};
    globalThis.__PACKRAT_LIGHTING_FIXTURE__=fixture;
  },{fixture:fixtureFor(context)});
}
export async function ready(page,context){
  if(context.variant?.mode==='offline'){
    await page.waitForFunction(()=>document.body.getAttribute('data-state')==='offline'&&!document.getElementById('blockingState')?.hidden);
  }else{
    await page.waitForFunction(()=>Boolean(globalThis.__PACKRAT_LIGHTING_TEST__)&&document.body.getAttribute('data-state')==='live'&&document.querySelectorAll('.target-card').length>0);
  }
  await page.waitForTimeout(250);
}
export async function assert(page,context){
  const geometry=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight,state:document.body.getAttribute('data-state')}));
  if(geometry.w>geometry.iw+1||geometry.h>geometry.ih+1)throw new Error('lighting fixture overflow '+JSON.stringify(geometry));
  if(context.variant?.mode!=='offline'){
    const cards=await page.locator('.target-card').count();
    if(cards<1)throw new Error('lighting fixture has no visible target cards');
  }
}
