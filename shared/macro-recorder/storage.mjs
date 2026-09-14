import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { normalizeMacro } from "./model.mjs";

function defaultPath() {
  const root = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
  return join(root, "PackRat", "Macro Recorder Pro", "library.json");
}

function parseLibrary(raw) {
  const parsed = JSON.parse(raw);
  if (Number(parsed?.schema) !== 1 || !Array.isArray(parsed?.macros)) {
    throw new Error("Unsupported or malformed Macro Library.");
  }
  const normalized = parsed.macros.map((macro) => {
    if (!macro || typeof macro !== "object" || !Array.isArray(macro.events)) {
      throw new Error("Malformed macro entry in Macro Library.");
    }
    const next = normalizeMacro(macro, { pro: true });
    if (!next.events.length) throw new Error("Macro Library entry contains no playable events.");
    return next;
  });
  const ids = new Set();
  for (const macro of normalized) {
    if (ids.has(macro.id)) throw new Error("Macro Library contains duplicate macro IDs.");
    ids.add(macro.id);
  }
  return normalized;
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
      this.macros = parseLibrary(await readFile(this.file, "utf8"));
      return this;
    } catch (error) {
      if (error?.code === "ENOENT") {
        const temp = `${this.file}.tmp`;
        try {
          const recovered = parseLibrary(await readFile(temp, "utf8"));
          await mkdir(dirname(this.file), { recursive: true });
          await rename(temp, this.file);
          this.macros = recovered;
          this.warning = "Recovered the Macro Library from an interrupted save.";
          return this;
        } catch (tempError) {
          if (tempError?.code === "ENOENT") {
            this.macros = [];
            return this;
          }
          if (tempError?.code) {
            this.macros = [];
            this.warning = `Could not read or promote the interrupted Macro Library save (${tempError.code}).`;
            return this;
          }
          let tempBackupPreserved = false;
          try {
            await rename(temp, `${temp}.corrupt-${Date.now()}`);
            tempBackupPreserved = true;
          } catch {}
          this.macros = [];
          this.warning = tempBackupPreserved
            ? "An interrupted Macro Library save was malformed and was preserved as a corrupt backup."
            : "An interrupted Macro Library save was malformed and could not be preserved as a backup.";
          return this;
        }
      }

      if (error?.code) {
        this.macros = [];
        this.warning = `Could not read the Macro Library (${error.code}). The file was left untouched.`;
        return this;
      }

      let backupPreserved = false;
      try {
        await mkdir(dirname(this.file), { recursive: true });
        await rename(this.file, `${this.file}.corrupt-${Date.now()}`);
        backupPreserved = true;
      } catch {}
      this.warning = backupPreserved
        ? "The macro library was corrupt and was reset. A backup was preserved."
        : "The macro library was corrupt and was reset. The original file could not be preserved as a backup.";
      this.macros = [];
      return this;
    }
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

  async ensure(raw) {
    const run = this.operationTail.then(async () => {
      const macro = normalizeMacro({ ...raw, updatedAt: raw?.updatedAt || new Date().toISOString() }, { pro: true });
      if (!macro.events.length) throw new Error("Macro must contain at least one playable event.");
      const existing = this.get(macro.id);
      if (existing) return existing;
      const before = [...this.macros];
      try {
        this.macros.push(macro);
        await this.save();
        return macro;
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
      if (!macro.events.length) throw new Error("Macro must contain at least one playable event.");
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
      if (!next.events.length) throw new Error("Macro must contain at least one playable event.");
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

  async diagnose() {
    const memoryIds = this.macros.map((macro) => macro.id).sort();
    const report = {
      file: this.file,
      warning: this.warning,
      inMemoryCount: this.macros.length,
      inMemoryIds: memoryIds,
      disk: {
        exists: false,
        readable: false,
        parseable: false,
        size: 0,
        modifiedAt: "",
        macroCount: 0,
        ids: [],
        matchesMemory: false,
        error: "",
      },
      writeProbe: {
        ok: false,
        error: "",
      },
    };

    try {
      const info = await stat(this.file);
      report.disk.exists = true;
      report.disk.size = Number(info.size || 0);
      report.disk.modifiedAt = info.mtime?.toISOString?.() || "";
      const raw = await readFile(this.file, "utf8");
      report.disk.readable = true;
      const parsed = parseLibrary(raw);
      report.disk.parseable = true;
      report.disk.macroCount = parsed.length;
      report.disk.ids = parsed.map((macro) => macro.id).sort();
      report.disk.matchesMemory = JSON.stringify(report.disk.ids) === JSON.stringify(memoryIds);
    } catch (error) {
      report.disk.error = String(error?.code || error?.message || error || "");
      if (error?.code === "ENOENT") report.disk.error = "ENOENT";
    }

    const probe = `${this.file}.diagnostic-${process.pid}-${Date.now()}.tmp`;
    try {
      await mkdir(dirname(this.file), { recursive: true });
      const marker = `packrat-macro-diagnostic:${Date.now()}`;
      await writeFile(probe, marker, "utf8");
      const echoed = await readFile(probe, "utf8");
      report.writeProbe.ok = echoed === marker;
      if (!report.writeProbe.ok) report.writeProbe.error = "Write/read marker mismatch.";
    } catch (error) {
      report.writeProbe.error = String(error?.code || error?.message || error || "");
    } finally {
      try { await unlink(probe); } catch {}
    }

    return report;
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
