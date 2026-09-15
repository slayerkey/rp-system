import { readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const roots = [
  resolve(root, "src"),
  resolve(root, "ui"),
  resolve(root, "scripts"),
  resolve(root, "tests"),
];

async function walk(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if ([".js", ".mjs"].includes(extname(entry.name).toLowerCase())) out.push(path);
  }
  return out;
}

const files = [
  resolve(root, "rollup.config.mjs"),
  ...(await Promise.all(roots.map(walk))).flat(),
].sort();

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status === 0) continue;
  failed += 1;
  process.stderr.write("\nSYNTAX FAIL: " + file + "\n");
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

if (failed) {
  throw new Error("JavaScript syntax gate failed for " + failed + " of " + files.length + " files.");
}

console.log("JavaScript syntax gate: " + files.length + "/" + files.length + " files PASS.");
