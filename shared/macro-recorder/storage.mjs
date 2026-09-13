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
  }

  async load() {
    this.warning = "";
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8"));
      const source = Array.isArray(parsed?.macros) ? parsed.macros : [];
      this.macros = source.map((macro) => normalizeMacro(macro, { pro: true }));
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

  async add(raw) {
    let macro = normalizeMacro({ ...raw, updatedAt: new Date().toISOString() }, { pro: true });
    if (this.get(macro.id)) macro = normalizeMacro({ ...macro, id: undefined, name: `${macro.name} Copy` }, { pro: true });
    this.macros.push(macro);
    await this.save();
    return macro;
  }

  async update(id, raw) {
    const index = this.macros.findIndex((macro) => macro.id === String(id || ""));
    if (index < 0) throw new Error("Macro not found.");
    const current = this.macros[index];
    const next = normalizeMacro({ ...current, ...raw, id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString() }, { pro: true });
    this.macros[index] = next;
    await this.save();
    return next;
  }

  async remove(id) {
    const before = this.macros.length;
    this.macros = this.macros.filter((macro) => macro.id !== String(id || ""));
    if (this.macros.length !== before) await this.save();
  }

  async save() {
    await mkdir(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    const body = JSON.stringify({ schema: 1, savedAt: new Date().toISOString(), macros: this.macros }, null, 2);
    await writeFile(temp, body, "utf8");
    await rename(temp, this.file);
  }
}
