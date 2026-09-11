import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'clipboard-shelf.js'),'utf8');
const sandbox={console,URL,Set,Date,Math,globalThis:null,document:undefined};sandbox.globalThis=sandbox;
vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'clipboard-shelf.js'});
const api=sandbox.__clipboardShelfTest;
function assert(v,m){if(!v)throw new Error(m);}
assert(api.classifyUrl('https://example.com/a').domain==='example.com','url recognition');
assert(api.classifyUrl('not a url')===null,'plain text classification');
const list=api.dedupeEntries([
 {id:'1',text:'alpha',createdAt:'2026-09-10T20:00:00Z'},
 {id:'2',text:'alpha',createdAt:'2026-09-10T20:01:00Z'},
 {id:'3',text:'pin',pinned:true,createdAt:'2026-09-10T19:00:00Z'},
 {id:'4',text:'beta',createdAt:'2026-09-10T20:02:00Z'}
],2);
assert(list.length===3,'pin plus two unpinned');
assert(list[0].pinned===true,'pins sort first');
assert(list.filter(x=>x.text==='alpha').length===1,'dedupe');
assert(api.slotFor(840,344)==='s-h','small horizontal');
assert(api.slotFor(696,416)==='s-v','small vertical');
assert(api.slotFor(840,696)==='m-h','medium horizontal');
assert(api.slotFor(696,840)==='m-v','medium vertical');
assert(api.slotFor(1688,696)==='l-h','large horizontal');
assert(api.slotFor(696,1688)==='l-v','large vertical');
assert(api.slotFor(2536,696)==='xl-h','xl horizontal');
assert(api.slotFor(696,2536)==='xl-v','xl vertical');
console.log('CLIPBOARD SHELF VERIFY PASS');