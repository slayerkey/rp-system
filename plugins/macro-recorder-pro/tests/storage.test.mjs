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
