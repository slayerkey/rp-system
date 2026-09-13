import { readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bin = resolve(here, "..", "com.packrat.performance-grapher.sdPlugin", "bin");
for (const name of await readdir(bin)) {
  if (name === "plugin.js") continue;
  await rm(resolve(bin, name), { recursive: true, force: true });
}
console.log("Cleaned Performance Grapher bundle output");
