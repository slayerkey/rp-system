import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);

test("Lite starter profile source includes REC STOP PLAY and safe examples",async()=>{
  const source=await readFile(new URL("scripts/build-profiles.mjs",root),"utf8");
  for(const token of ["\"REC\"","\"STOP\"","\"PLAY\"","\"FIND\"","\"SAVE\"","\"NEXT x3\"","\"HOME\"","\"PAGE DOWN\""]){
    assert.ok(source.includes(token),`missing ${token}`);
  }
  assert.ok(source.includes('act("lite-play","replay","PLAY")'));
  assert.ok(source.includes('const settings={macro:m,...extra}'));
  assert.equal(source.includes('const settings={seedMacro:m,...extra}'),false);
  for(const deviceType of ["deviceType:0","deviceType:2","deviceType:7","deviceType:9"]) {
    assert.ok(source.includes(deviceType),`missing ${deviceType}`);
  }
  assert.ok(source.includes("compactPages(basePages,4)"));
  assert.equal(/anti[- ]?afk|cheat|farm/i.test(source),false);
});
