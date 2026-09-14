import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  LITE_LIMIT, PRO_LIMIT, LITE_SEEDS, PRO_SEEDS, DEFAULT_PRO_VARIABLES, validateVariableName
} from "./core.mjs";

const CURRENT_SCHEMA_VERSION = 2;
const LEGACY_LITE_DEFAULTS = [
  { id:"lite-email", name:"EMAIL", folder:"STARTER", content:"Hi there,\n\nThanks for your message.\n\nBest,\nREPLACE ME" },
  { id:"lite-date", name:"DATE", folder:"STARTER", content:"{date}" },
  { id:"lite-time", name:"TIME", folder:"STARTER", content:"{time}" },
  { id:"lite-clipboard", name:"CLIPBOARD", folder:"STARTER", content:"{clipboard}" },
  { id:"lite-address", name:"ADDRESS", folder:"STARTER", content:"REPLACE WITH YOUR ADDRESS" },
  { id:"lite-link", name:"LINK", folder:"STARTER", content:"REPLACE WITH YOUR LINK" }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function sameSnippet(a,b) {
  return a?.id===b?.id && a?.name===b?.name && a?.folder===b?.folder && a?.content===b?.content;
}
function migrateLibrary(raw, edition) {
  if (!raw || typeof raw !== "object") return raw;
  if (Number(raw.schemaVersion || 1) >= CURRENT_SCHEMA_VERSION) return raw;

  const next = clone(raw);
  next.schemaVersion = CURRENT_SCHEMA_VERSION;
  if (!Array.isArray(next.snippets)) return next;

  if (edition === "lite") {
    const pristineLegacy = next.snippets.length === LEGACY_LITE_DEFAULTS.length
      && LEGACY_LITE_DEFAULTS.every((expected,index) => sameSnippet(next.snippets[index], expected));
    if (pristineLegacy) next.snippets = clone(LITE_SEEDS);
  } else {
    const existing = new Set(next.snippets.map(item => String(item?.id || "")));
    const available = Math.max(0, PRO_LIMIT - next.snippets.length);
    const quick = PRO_SEEDS.filter(item => item.folder === "QUICK" && !existing.has(item.id)).slice(0, available);
    next.snippets = [...clone(quick), ...next.snippets];
  }
  return next;
}
function safeId(value) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(String(value || ""));
}
function cleanSnippet(raw, edition) {
  const item = {
    id: String(raw?.id || "").trim(),
    name: String(raw?.name || "").trim().slice(0, 120),
    folder: String(raw?.folder || "").trim().slice(0, 80),
    content: String(raw?.content ?? "")
  };
  if (!safeId(item.id)) throw new Error("Invalid snippet id.");
  if (!item.name) throw new Error("Snippet name is required.");
  if (edition === "lite") item.folder = "STARTER";
  return item;
}
function validateLibrary(raw, edition) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.snippets)) throw new Error("Invalid library.");
  const limit = edition === "lite" ? LITE_LIMIT : PRO_LIMIT;
  if (raw.snippets.length > limit) throw new Error(`Snippet limit is ${limit}.`);
  const snippets = raw.snippets.map(item => cleanSnippet(item, edition));
  const ids = new Set();
  for (const item of snippets) {
    if (ids.has(item.id)) throw new Error("Duplicate snippet id.");
    ids.add(item.id);
  }
  const variables = {};
  if (edition === "pro" && raw.variables && typeof raw.variables === "object") {
    for (const [name, value] of Object.entries(raw.variables)) {
      if (!validateVariableName(name)) throw new Error(`Invalid reusable variable: ${name}`);
      variables[name] = String(value ?? "");
    }
  }
  return { schemaVersion:CURRENT_SCHEMA_VERSION, snippets, variables };
}
async function atomicJson(file, value) {
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive:true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  try {
    await fs.copyFile(file, file + ".bak");
  } catch {}
  await fs.rename(temp, file);
}
async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export class TextExpanderLibrary {
  constructor({ edition, rootDir } = {}) {
    if (!["lite","pro"].includes(edition)) throw new Error("Edition must be lite or pro.");
    this.edition = edition;
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    this.rootDir = rootDir || path.join(appData, "PackRat", edition === "pro" ? "TextExpanderPro" : "TextExpanderLite");
    this.libraryPath = path.join(this.rootDir, "library.json");
    this.statePath = path.join(this.rootDir, "state.json");
    this.queue = Promise.resolve();
  }
  defaults() {
    return {
      schemaVersion:CURRENT_SCHEMA_VERSION,
      snippets:clone(this.edition === "pro" ? PRO_SEEDS : LITE_SEEDS),
      variables:clone(this.edition === "pro" ? DEFAULT_PRO_VARIABLES : {})
    };
  }
  async load() {
    await fs.mkdir(this.rootDir, { recursive:true });
    try {
      const raw = await readJson(this.libraryPath);
      const migrated = migrateLibrary(raw, this.edition);
      const value = validateLibrary(migrated, this.edition);
      if (Number(raw?.schemaVersion || 1) < CURRENT_SCHEMA_VERSION) {
        await atomicJson(this.libraryPath, value);
      }
      return value;
    } catch (error) {
      if (error?.code === "ENOENT") {
        const value = this.defaults();
        await atomicJson(this.libraryPath, value);
        return value;
      }
      const corruptName = path.join(this.rootDir, `library.corrupt-${Date.now()}.json`);
      try { await fs.rename(this.libraryPath, corruptName); } catch {}
      try {
        const backupRaw = await readJson(this.libraryPath + ".bak");
        const backup = validateLibrary(migrateLibrary(backupRaw, this.edition), this.edition);
        await atomicJson(this.libraryPath, backup);
        return backup;
      } catch {}
      const value = this.defaults();
      await atomicJson(this.libraryPath, value);
      return value;
    }
  }
  async replace(raw) {
    const value = validateLibrary(raw, this.edition);
    await atomicJson(this.libraryPath, value);
    return value;
  }
  async getSnippet(id) {
    const library = await this.load();
    return library.snippets.find(item => item.id === id) || null;
  }
  async counters() {
    try {
      const raw = await readJson(this.statePath);
      return raw && typeof raw.counters === "object" ? raw.counters : {};
    } catch {
      return {};
    }
  }
  async withNextCounters(names, callback) {
    const unique = [...new Set(names.map(String))];
    const work = async () => {
      if (!unique.length) return callback({});
      const current = await this.counters();
      const next = { ...current };
      const values = {};
      for (const name of unique) {
        const value = Math.max(0, Number.parseInt(current[name] ?? 0, 10) || 0) + 1;
        next[name] = value;
        values[name] = value;
      }
      const result = await callback(values);
      await atomicJson(this.statePath, { schemaVersion:1, counters:next });
      return result;
    };
    const scheduled = this.queue.then(work, work);
    this.queue = scheduled.catch(() => {});
    return scheduled;
  }
}
