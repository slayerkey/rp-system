import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { normalizeMacro } from "./model.mjs";

function defaultPath() {
  const root = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
  return join(root, "PackRat", "Macro Recorder Pro", "library.json");
}

export class MacroLibrary {
  constructor(file = defaultPath()) {
    this.file = file;
    this.macros = [];
    this.warning = "";
    this.saveTail = Promise.resolve();
    this.operationTail = Promise.resolve();
  }

  async load() {
    this.warning = "";
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8"));
      if (Number(parsed?.schema) !== 1 || !Array.isArray(parsed?.macros)) {
        throw new Error("Unsupported or malformed Macro Library.");
      }
      this.macros = parsed.macros.map((macro) => normalizeMacro(macro, { pro: true }));
    } catch (error) {
      if (error?.code === "ENOENT") {
        this.macros = [];
        return this;
      }
      this.warning = "The macro library was corrupt and was reset. A backup was preserved.";
      try {
        await mkdir(dirname(this.file), { recursive: true });
        await rename(this.file, `${this.file}.corrupt-${Date.now()}`);
      } catch {}
      this.macros = [];
    }
    return this;
  }

  list() {
    return [...this.macros]
      .sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map((macro) => ({ id: macro.id, name: macro.name, durationMs: macro.durationMs, eventCount: macro.events.length, updatedAt: macro.updatedAt }));
  }

  get(id) {
    return this.macros.find((macro) => macro.id === String(id || "")) || null;
  }

  async transact(mutator) {
    const run = this.operationTail.then(async () => {
      const before = [...this.macros];
      try {
        const value = mutator();
        await this.save();
        return value;
      } catch (error) {
        this.macros = before;
        throw error;
      }
    });
    this.operationTail = run.catch(() => {});
    return await run;
  }

  async add(raw) {
    return await this.transact(() => {
      let macro = normalizeMacro({ ...raw, updatedAt: new Date().toISOString() }, { pro: true });
      if (this.get(macro.id)) macro = normalizeMacro({ ...macro, id: undefined, createdAt: undefined, updatedAt: new Date().toISOString(), name: `${macro.name} Copy` }, { pro: true });
      this.macros.push(macro);
      return macro;
    });
  }

  async update(id, raw) {
    return await this.transact(() => {
      const index = this.macros.findIndex((macro) => macro.id === String(id || ""));
      if (index < 0) throw new Error("Macro not found.");
      const current = this.macros[index];
      const next = normalizeMacro({ ...current, ...raw, id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString() }, { pro: true });
      this.macros[index] = next;
      return next;
    });
  }

  async remove(id) {
    const target = String(id || "");
    if (!this.get(target)) return false;
    return await this.transact(() => {
      this.macros = this.macros.filter((macro) => macro.id !== target);
      return true;
    });
  }

  async save() {
    const run = this.saveTail.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const temp = `${this.file}.tmp`;
      const body = JSON.stringify({ schema: 1, savedAt: new Date().toISOString(), macros: this.macros }, null, 2);
      await writeFile(temp, body, "utf8");
      await rename(temp, this.file);
    });
    this.saveTail = run.catch(() => {});
    return await run;
  }
}
