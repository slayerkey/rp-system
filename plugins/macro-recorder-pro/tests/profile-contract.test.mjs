import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);

test("Pro starter profile source contains required pages and a blank PLAY action",async()=>{
  const source=await readFile(new URL("scripts/build-profiles.mjs",root),"utf8");
  for(const label of ["MACROS","GAMING","PRODUCTIVITY","MOUSE","LOOPS"]){
    assert.ok(source.includes(`label:"${label}"`),`missing ${label}`);
  }
  assert.ok(source.includes('act("p-play","replay","PLAY")'));
  assert.ok(source.includes('const settings={seedMacro:m,...extra}'));
  assert.equal(source.includes('const settings={macro:m,...extra}'),false);
  assert.ok(source.includes('playbackMode:"while-held"'));
  assert.ok(source.includes('playbackMode:"toggle"'));
  assert.equal(/anti[- ]?afk|cheat|farm/i.test(source),false);
});
