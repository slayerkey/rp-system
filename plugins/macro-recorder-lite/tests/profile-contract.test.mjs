import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);

test("Lite starter profiles stay focused on six useful keyboard actions",async()=>{
  const source=await readFile(new URL("scripts/build-profiles.mjs",root),"utf8");
  for(const token of ['"RECORD"','"PLAY"','"STOP"','"FIND"','"SAVE"','"NEXT x3"']){
    assert.ok(source.includes(token),`missing ${token}`);
  }
  for(const removed of ['"HOME"','"PAGE DOWN"','"MENU OK"','"CLICK DEMO"','"SCROLL"']){
    assert.equal(source.includes(removed),false,`unexpected old starter action ${removed}`);
  }
  assert.match(source,/Object\.keys\(built\.actions\)\.length!==6/);
  assert.match(source,/Expected 30 unique bundled profile ActionIDs/);
  assert.match(source,/actionId:item\.ActionID/);
  assert.match(source,/ShowTitle:false/);
  assert.match(source,/action:\$\{fileSeed\}:\$\{pageIndex\}:\$\{position\}/);
  for(const deviceType of ["deviceType:0","deviceType:1","deviceType:2","deviceType:7","deviceType:9"]){
    assert.ok(source.includes(deviceType),`missing ${deviceType}`);
  }
  assert.equal(/anti[- ]?afk|cheat|farm/i.test(source),false);
});
