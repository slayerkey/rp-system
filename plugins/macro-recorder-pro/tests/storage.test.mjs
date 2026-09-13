import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MacroLibrary } from "../../../shared/macro-recorder/storage.mjs";

test("corrupt Macro Library is reset and preserved as a backup", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    await writeFile(file,"{not-json","utf8");
    const library=await new MacroLibrary(file).load();
    assert.equal(library.list().length,0);
    assert.match(library.warning,/corrupt/i);
    const names=await readdir(dir);
    assert.ok(names.some(name=>name.startsWith("library.json.corrupt-")));
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library persists add, update, duplicate source data and delete operations", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    const library=await new MacroLibrary(file).load();
    const added=await library.add({name:"One",events:[
      {type:"keyDown",vk:65,delayMs:1},
      {type:"keyUp",vk:65,delayMs:1}
    ]});
    assert.equal(library.list().length,1);
    await library.update(added.id,{name:"Renamed",events:added.events});
    assert.equal(library.get(added.id).name,"Renamed");

    const reloaded=await new MacroLibrary(file).load();
    assert.equal(reloaded.get(added.id).name,"Renamed");
    await reloaded.remove(added.id);
    assert.equal(reloaded.list().length,0);

    const final=await new MacroLibrary(file).load();
    assert.equal(final.list().length,0);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library preserves saved modified timestamps across reload", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    const library=await new MacroLibrary(file).load();
    const added=await library.add({name:"Timestamped",events:[
      {type:"keyDown",vk:65,delayMs:1},
      {type:"keyUp",vk:65,delayMs:1}
    ]});
    const saved=library.get(added.id).updatedAt;
    await new Promise(resolve=>setTimeout(resolve,5));
    const reloaded=await new MacroLibrary(file).load();
    assert.equal(reloaded.get(added.id).updatedAt,saved);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library serializes rapid saves without losing the final edit", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    const library=await new MacroLibrary(file).load();
    const added=await library.add({name:"Original",events:[
      {type:"keyDown",vk:65,delayMs:1},
      {type:"keyUp",vk:65,delayMs:1}
    ]});
    const first=library.update(added.id,{name:"First"});
    const second=library.update(added.id,{name:"Second"});
    await Promise.all([first,second]);
    const reloaded=await new MacroLibrary(file).load();
    assert.equal(reloaded.get(added.id).name,"Second");
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library quarantines structurally invalid schema files", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    await writeFile(file,JSON.stringify({schema:99,macros:[]}),"utf8");
    const library=await new MacroLibrary(file).load();
    assert.equal(library.list().length,0);
    assert.match(library.warning,/corrupt/i);
    const names=await readdir(dir);
    assert.ok(names.some(name=>name.startsWith("library.json.corrupt-")));
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library quarantines a malformed individual macro entry", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    await writeFile(file,JSON.stringify({schema:1,macros:[{id:"bad",name:"Bad",events:[{type:"not-real"}]}]}),"utf8");
    const library=await new MacroLibrary(file).load();
    assert.equal(library.list().length,0);
    assert.match(library.warning,/corrupt/i);
    const names=await readdir(dir);
    assert.ok(names.some(name=>name.startsWith("library.json.corrupt-")));
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library quarantines duplicate macro IDs", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  const macro={id:"same",name:"One",events:[
    {type:"keyDown",vk:65,delayMs:1},
    {type:"keyUp",vk:65,delayMs:1}
  ]};
  try {
    await writeFile(file,JSON.stringify({schema:1,macros:[macro,{...macro,name:"Two"}]}),"utf8");
    const library=await new MacroLibrary(file).load();
    assert.equal(library.list().length,0);
    assert.match(library.warning,/corrupt/i);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library rolls back memory when a save fails", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  try {
    const library=await new MacroLibrary(dir).load();
    await assert.rejects(()=>library.add({name:"Unsaved",events:[
      {type:"keyDown",vk:65,delayMs:1},
      {type:"keyUp",vk:65,delayMs:1}
    ]}));
    assert.equal(library.list().length,0);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
