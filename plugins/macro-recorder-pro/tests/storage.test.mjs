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

test("Macro Library refuses deleting the final playable event", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    const library=await new MacroLibrary(file).load();
    const added=await library.add({name:"Keep Me",events:[
      {type:"keyDown",vk:65,delayMs:1}
    ]});
    await assert.rejects(
      ()=>library.update(added.id,{events:[]}),
      /at least one playable event/i
    );
    assert.equal(library.get(added.id).events.length,1);
    const reloaded=await new MacroLibrary(file).load();
    assert.equal(reloaded.get(added.id).events.length,1);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library refuses adding an empty macro", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    const library=await new MacroLibrary(file).load();
    await assert.rejects(
      ()=>library.add({name:"Empty",events:[]}),
      /at least one playable event/i
    );
    assert.equal(library.list().length,0);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library recovers a valid interrupted first-save temp file", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  const temp=file+".tmp";
  try {
    await writeFile(temp,JSON.stringify({schema:1,macros:[{
      id:"recovered",
      name:"Recovered",
      events:[
        {type:"keyDown",vk:65,delayMs:1},
        {type:"keyUp",vk:65,delayMs:1}
      ]
    }]}),"utf8");
    const library=await new MacroLibrary(file).load();
    assert.equal(library.get("recovered").name,"Recovered");
    assert.match(library.warning,/interrupted save/i);
    const reloaded=await new MacroLibrary(file).load();
    assert.equal(reloaded.get("recovered").name,"Recovered");
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library does not load malformed interrupted temp data", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    await writeFile(file+".tmp","{bad-json","utf8");
    const library=await new MacroLibrary(file).load();
    assert.equal(library.list().length,0);
    assert.match(library.warning,/malformed/i);
    const names=await readdir(dir);
    assert.ok(names.some(name=>name.startsWith("library.json.tmp.corrupt-")));
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library does not mislabel filesystem read errors as corruption", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  try {
    const library=await new MacroLibrary(dir).load();
    assert.equal(library.list().length,0);
    assert.doesNotMatch(library.warning,/corrupt/i);
    assert.match(library.warning,/left untouched|could not read/i);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library atomically reuses the same deterministic starter macro", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    const library=await new MacroLibrary(file).load();
    const seed={id:"starter-shared",name:"Shared Starter",events:[
      {type:"keyDown",vk:65,delayMs:1},
      {type:"keyUp",vk:65,delayMs:1}
    ]};
    const [a,b]=await Promise.all([library.ensure(seed),library.ensure(seed)]);
    assert.equal(a.id,"starter-shared");
    assert.equal(b.id,"starter-shared");
    assert.equal(library.list().length,1);
    const reloaded=await new MacroLibrary(file).load();
    assert.equal(reloaded.list().length,1);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("Macro Library deep diagnostic is non-destructive and verifies disk consistency", async () => {
  const dir=await mkdtemp(join(tmpdir(),"packrat-macro-"));
  const file=join(dir,"library.json");
  try {
    const library=await new MacroLibrary(file).load();
    const added=await library.add({name:"Diagnostic",events:[
      {type:"keyDown",vk:65,delayMs:1},
      {type:"keyUp",vk:65,delayMs:1}
    ]});
    const before=JSON.stringify(library.get(added.id));
    const report=await library.diagnose();
    assert.equal(report.inMemoryCount,1);
    assert.equal(report.disk.exists,true);
    assert.equal(report.disk.readable,true);
    assert.equal(report.disk.parseable,true);
    assert.equal(report.disk.macroCount,1);
    assert.equal(report.disk.matchesMemory,true);
    assert.equal(report.writeProbe.ok,true);
    assert.equal(JSON.stringify(library.get(added.id)),before);
    const names=await readdir(dir);
    assert.equal(names.some(name=>name.includes(".diagnostic-")),false);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
