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
  assert.equal(/anti[- ]?afk|cheat|farm/i.test(source),false);
});
