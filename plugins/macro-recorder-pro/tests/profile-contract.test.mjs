import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);

test("Pro starter profile stays focused on recorded workflows",async()=>{
  const source=await readFile(new URL("scripts/build-profiles.mjs",root),"utf8");
  assert.ok(source.includes('label:"MACROS"'));
  assert.equal(source.includes('label:"GAMING"'),false);
  assert.equal(source.includes('label:"PRODUCTIVITY"'),false);
  assert.ok(source.includes('act("p-play","replay","Play",{autoLatest:true})'));
  assert.ok(source.includes('act("p-stop","stop","Stop")'));
  assert.ok(source.includes('materializeProfilePages'));
  assert.ok(source.includes('actionId:a.ActionID'));
  assert.ok(source.includes('action:${fileSeed}:${pageIndex}:${position}:${action.UUID}'));
  assert.equal(source.includes('replay("p-rapid-click"'),false);
  assert.equal(source.includes('replay("p-double-click"'),false);
  assert.equal(source.includes('replay("p-scroll-burst"'),false);
  assert.equal(source.includes('Find in App'),false);
  assert.equal(source.includes('starter-save'),false);
  assert.ok(source.includes('LinkedTitle:false'));
  assert.ok(source.includes('ShowTitle:false'));
  assert.ok(source.includes('seedMacro:m'));
  for(const deviceType of ["deviceType:0","deviceType:1","deviceType:2","deviceType:7","deviceType:9"])assert.ok(source.includes(deviceType),`missing ${deviceType}`);
  assert.ok(source.includes("compactPages(basePages,3,2)"));
  assert.ok(source.includes("compactPages(basePages,4)"));
  assert.equal(/anti[- ]?afk|cheat|farm/i.test(source),false);

  const suffixes=["mk2","mini","xl","plus","neo"];
  const actionIds=[];
  for(const suffix of suffixes){
    const map=JSON.parse(await readFile(new URL(`../../artifacts/profile-maps/macro-recorder-pro-starter-${suffix}.profile-map.json`,root),"utf8"));
    const actions=map.pages.flatMap(page=>page.actions);
    assert.equal(actions.length,3,`${suffix} starter profile should contain only Record / Play / Stop`);
    for(const action of actions){
      assert.ok(action.actionId,`${suffix} ${action.name} is missing an auditable ActionID`);
      actionIds.push(action.actionId);
    }
  }
  assert.equal(new Set(actionIds).size,actionIds.length,"starter profile ActionIDs must be unique across every bundled device profile");
});
