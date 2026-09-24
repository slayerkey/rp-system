import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shared = resolve(root, "..", "performance-grapher-streamdeck");
const from = resolve(shared, "com.packrat.performance-grapher.sdPlugin");
const to = resolve(root, "com.packrat.performance-grapher-neo.sdPlugin");
async function copy(source, target) {
  await stat(source); // Missing upstream build output is a hard failure.
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
}
for (const folder of ["bin", "imgs", "ui", "native", "licenses"]) {
  await rm(resolve(to, folder), { recursive: true, force: true });
  await mkdir(resolve(to, folder), { recursive: true });
}
await copy(resolve(from, "native", "telemetry"), resolve(to, "native", "telemetry"));
await copy(resolve(from, "licenses"), resolve(to, "licenses"));
await copy(resolve(from, "imgs", "plugin"), resolve(to, "imgs", "plugin"));
await copy(resolve(from, "imgs", "category"), resolve(to, "imgs", "category"));
await copy(resolve(from, "imgs", "actions", "neo-infobar"), resolve(to, "imgs", "actions", "infobar"));
for (const file of ["inspector.html", "inspector.css", "inspector.js"]) {
  await copy(resolve(root, "ui", file), resolve(to, "ui", file));
}
await copy(resolve(shared, "ui", "sdpi-components.js"), resolve(to, "ui", "sdpi-components.js"));
console.log("Staged standalone Neo assets and previously proven Windows sensor helper.");
