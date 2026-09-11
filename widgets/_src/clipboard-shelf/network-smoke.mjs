import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const entry=path.resolve(process.argv[2]||'widgets/clipboard-shelf/index.html');
const out=path.resolve(process.argv[3]||'artifacts/clipboard-shelf-network-smoke');
await fs.mkdir(out,{recursive:true});
const protocol='packrat-clipboard-shelf-v1-a91f6c';
const pairingCode='A1B2C3D4E5F60718293A4B5C6D7E8F90';
let connections=0;
const commands=[];

const entries=[
 {id:'short',text:'deterministic short text',createdAt:'2026-09-10T20:00:00.000Z',pinned:false,favorite:false,url:'',domain:''},
 {id:'long',text:'L'.repeat(12000),createdAt:'2026-09-10T19:59:00.000Z',pinned:false,favorite:true,url:'',domain:''},
 {id:'url',text:'https://example.com/path',createdAt:'2026-09-10T19:58:00.000Z',pinned:true,favorite:false,url:'https://example.com/path',domain:'example.com'}
];
const wss=new WebSocketServer({host:'127.0.0.1',port:17485,handleProtocols:(set)=>set.has(protocol)?protocol:false});
wss.on('connection',ws=>{
 connections++;
 let authed=false;
 ws.on('message',buf=>{
  try{
   const command=JSON.parse(String(buf));commands.push(command);
   if(!authed){
    if(command.command!=='auth'||command.token!==pairingCode){ws.close(1008,'pairing');return;}
    authed=true;
    ws.send(JSON.stringify({type:'snapshot',version:1,privateMode:false,maxHistory:40,currentId:'short',revision:connections,entries}));
   }
  }catch{}
 });
});

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:840,height:696}});
await page.addInitScript((code)=>{
 globalThis.pairingCode=code;
 globalThis.maxHistory=40;
 globalThis.textColor='#F5F7FA';
 globalThis.accentColor='#63E6BE';
 globalThis.backgroundColor='#080B10';
 globalThis.tr=async v=>v;
},pairingCode);
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
 await page.waitForFunction(()=>document.getElementById('bridgeStatus')?.classList.contains('online'),{timeout:5000});
 if(!commands.some(x=>x.command==='auth'&&x.token===pairingCode))throw new Error('pairing auth command not sent');
 await page.locator('.clip-card[data-id="short"] .card-main').click();
 await page.waitForFunction(()=>document.querySelector('.clip-card.current')?.dataset.id==='short',{timeout:2000});
 for(let i=0;i<30&&!commands.some(x=>x.command==='copy'&&x.id==='short');i++)await page.waitForTimeout(50);
 if(!commands.some(x=>x.command==='copy'&&x.id==='short'))throw new Error('copy command not sent');

 const pin=page.locator('.clip-card[data-id="url"] [data-action="pin"]');
 await pin.click();
 for(let i=0;i<20&&!commands.some(x=>x.command==='pin'&&x.id==='url');i++)await page.waitForTimeout(25);
 if(!commands.some(x=>x.command==='pin'&&x.id==='url'))throw new Error('pin command not sent');

 const del=page.locator('.clip-card[data-id="url"] [data-action="delete"]');
 const deletesBefore=commands.filter(x=>x.command==='delete').length;
 await del.click();await page.waitForTimeout(100);
 if(commands.filter(x=>x.command==='delete').length!==deletesBefore)throw new Error('delete fired without confirmation');
 await del.click();
 for(let i=0;i<20&&commands.filter(x=>x.command==='delete').length===deletesBefore;i++)await page.waitForTimeout(25);
 if(commands.filter(x=>x.command==='delete').length!==deletesBefore+1)throw new Error('confirmed delete command not sent');

 const clear=page.locator('#clearButton');
 const clearsBefore=commands.filter(x=>x.command==='clear').length;
 await clear.click();await page.waitForTimeout(100);
 if(commands.filter(x=>x.command==='clear').length!==clearsBefore)throw new Error('clear fired without confirmation');
 await clear.click();
 for(let i=0;i<20&&commands.filter(x=>x.command==='clear').length===clearsBefore;i++)await page.waitForTimeout(25);
 if(commands.filter(x=>x.command==='clear').length!==clearsBefore+1)throw new Error('confirmed clear command not sent');

 for(const client of wss.clients)client.close();
 await page.waitForFunction(()=>!document.getElementById('bridgeStatus')?.classList.contains('online'),{timeout:3000});
 await page.waitForFunction(()=>document.getElementById('bridgeStatus')?.classList.contains('online'),{timeout:5000});
 if(connections<2)throw new Error('automatic reconnect did not occur');

 for(const client of wss.clients){
  try{client.send(JSON.stringify({type:'snapshot',version:2,privateMode:false,maxHistory:40,currentId:'',revision:99,entries:[]}));}catch{}
 }
 await page.waitForFunction(()=>document.getElementById('incompatibleState')?.hidden===false,{timeout:2000});
 if(!(await page.locator('#privateButton').isDisabled())||!(await page.locator('#clearButton').isDisabled()))throw new Error('incompatible bridge controls were not disabled');

 for(const client of wss.clients){
  try{client.send(JSON.stringify({type:'snapshot',version:1,privateMode:false,maxHistory:40,currentId:'short',revision:100,entries}));}catch{}
 }
 await page.waitForFunction(()=>document.getElementById('incompatibleState')?.hidden===true&&document.querySelector('.clip-card[data-id="short"]'),{timeout:2000});

 await page.screenshot({path:path.join(out,'network-smoke.png')});
 const beforePagehide=connections;
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 await page.waitForTimeout(1600);
 if(connections!==beforePagehide)throw new Error('pagehide unexpectedly reconnected the bridge');
 await page.evaluate(()=>dispatchEvent(new Event('pageshow')));
 await page.waitForFunction(()=>document.getElementById('bridgeStatus')?.classList.contains('online'),{timeout:5000});
 if(connections!==beforePagehide+1)throw new Error('pageshow did not create exactly one clean reconnect');
 if(errors.length)throw new Error('runtime errors: '+errors.join(' | '));
 console.log('CLIPBOARD SHELF PACKAGED NETWORK SMOKE PASS');
}finally{
 await browser.close();
 await new Promise(resolve=>wss.close(resolve));
}
