import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { buildProfile, profileAction } from "../tools/streamdeck/profile-builder.mjs";

function zipJsonDocuments(data){
  const docs=[];
  let offset=0;
  while(offset+30<=data.length && data.readUInt32LE(offset)===0x04034b50){
    const method=data.readUInt16LE(offset+8);
    const compressedSize=data.readUInt32LE(offset+18);
    const nameLength=data.readUInt16LE(offset+26);
    const extraLength=data.readUInt16LE(offset+28);
    const name=data.subarray(offset+30,offset+30+nameLength).toString("utf8");
    const dataStart=offset+30+nameLength+extraLength;
    const compressed=data.subarray(dataStart,dataStart+compressedSize);
    const raw=method===8?inflateRawSync(compressed):method===0?compressed:null;
    assert.ok(raw,"unsupported ZIP method "+method);
    if(name.endsWith("/manifest.json"))docs.push({name,json:JSON.parse(raw.toString("utf8"))});
    offset=dataStart+compressedSize;
  }
  return docs;
}

const one=buildProfile({
  file:"builder-single",
  name:"Builder Single",
  keypad:{"0,0":profileAction("single","com.packrat.test.one","One")}
});
const oneDocs=zipJsonDocuments(one);
const oneRoot=oneDocs.find((d)=>/\.sdProfile\/manifest\.json$/.test(d.name)&&!d.name.includes("/Profiles/"));
assert.equal(oneRoot.json.Pages.Pages.length,1,"legacy one-page profile should remain one page");

const multi=buildProfile({
  file:"builder-multi",
  name:"Builder Multi",
  pages:[
    {label:"HOME",keypad:{"0,0":profileAction("home","com.packrat.test.home","Home")}},
    {label:"PRESETS",keypad:{"0,0":profileAction("preset","com.packrat.test.preset","Preset")}},
    {label:"STATUS",keypad:{"0,0":profileAction("status","com.packrat.test.status","Status")}}
  ]
});
const docs=zipJsonDocuments(multi);
const root=docs.find((d)=>/\.sdProfile\/manifest\.json$/.test(d.name)&&!d.name.includes("/Profiles/"));
const pages=docs.filter((d)=>d.name.includes("/Profiles/"));
assert.equal(root.json.Pages.Pages.length,3,"multi-page profile root must list every page");
assert.equal(pages.length,3,"multi-page archive must contain every page manifest");
for(const page of pages){
  for(const controller of page.json.Controllers??[]){
    if(controller.Type!=="Keypad")continue;
    for(const action of Object.values(controller.Actions??{})){
      assert.equal(action.States?.[0]?.ShowTitle,false,"generated profile actions must keep host title overlays disabled");
      assert.equal(action.States?.[0]?.Title,"","generated profile actions must not carry hidden title text");
    }
  }
}
console.log("PASS: Stream Deck profile builder single-page and multi-page contracts");
