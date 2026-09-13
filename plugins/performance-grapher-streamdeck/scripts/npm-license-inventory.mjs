import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const outputDir = resolve(root, "com.packrat.performance-grapher.sdPlugin", "licenses", "npm");
await mkdir(outputDir, { recursive: true });

function safeName(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, "_");
}

function dependencyNames(pkg) {
  return [
    ...Object.keys(pkg?.dependencies || {}),
    ...Object.keys(pkg?.optionalDependencies || {}),
  ];
}

async function packageFrom(name, fromDir) {
  const req = createRequire(resolve(fromDir, "__packrat_license_resolver.cjs"));
  let entry;
  try {
    entry = req.resolve(name);
  } catch (error) {
    throw new Error("Unable to resolve runtime npm dependency " + name + " from " + fromDir + ": " + error.message);
  }

  let dir = dirname(entry);
  for (let depth = 0; depth < 20; depth += 1) {
    const manifestPath = resolve(dir, "package.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      if (manifest?.name === name) return { dir, manifest };
    } catch {}
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Resolved npm dependency but could not find matching package.json: " + name + " -> " + entry);
}

async function licenseFiles(dir) {
  const matches = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (/^(?:licen[cs]e|copying|notice|copyright)(?:[._-].*)?$/i.test(entry.name)) {
      matches.push(entry.name);
    }
  }
  return matches.sort((a, b) => a.localeCompare(b));
}

const queue = dependencyNames(packageJson).map((name) => ({ name, fromDir: root, parent: "ROOT" }));
const seen = new Set();
const inventory = [];

while (queue.length) {
  const item = queue.shift();
  const resolved = await packageFrom(item.name, item.fromDir);
  const pkg = resolved.manifest;
  const key = String(pkg.name) + "@" + String(pkg.version || "");
  if (seen.has(key)) continue;
  seen.add(key);

  const files = await licenseFiles(resolved.dir);
  const declared = typeof pkg.license === "string"
    ? pkg.license.trim()
    : pkg.license && typeof pkg.license.type === "string"
      ? pkg.license.type.trim()
      : "";

  if (!declared && !files.length) {
    throw new Error("Runtime npm package lacks license declaration/evidence: " + key);
  }

  const packageOut = resolve(outputDir, safeName(key));
  await mkdir(packageOut, { recursive: true });
  const copied = [];
  for (const name of files) {
    const destination = resolve(packageOut, name);
    await cp(resolve(resolved.dir, name), destination);
    copied.push(name);
  }

  inventory.push({
    name: pkg.name,
    version: pkg.version || "",
    license: declared || null,
    parent: item.parent,
    package_directory: resolved.dir,
    copied_license_files: copied,
  });

  for (const child of dependencyNames(pkg)) {
    queue.push({ name: child, fromDir: resolved.dir, parent: key });
  }
}

inventory.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const missingFiles = inventory.filter((item) => !item.copied_license_files.length);
if (missingFiles.length) {
  throw new Error(
    "Runtime npm packages declare a license but ship no license/notice file: " +
    missingFiles.map((item) => item.name + "@" + item.version + " (" + item.license + ")").join(", ")
  );
}

await writeFile(
  resolve(outputDir, "NPM_LICENSE_INVENTORY.json"),
  JSON.stringify({
    generated_from: "package.json production dependency graph",
    packages: inventory,
  }, null, 2) + "\n",
  "utf8"
);

const lines = [
  "# Runtime npm dependency license inventory",
  "",
  "Generated from the exact production dependency graph installed for the Stream Deck plugin build.",
  "",
  "| Package | Version | License | Parent | Packaged license files |",
  "| --- | --- | --- | --- | --- |",
];
for (const item of inventory) {
  lines.push(
    "| " + item.name + " | " + item.version + " | " + (item.license || "") + " | " +
    item.parent + " | " + item.copied_license_files.map((name) => basename(name)).join(", ") + " |"
  );
}
await writeFile(resolve(outputDir, "NPM_LICENSE_INVENTORY.md"), lines.join("\n") + "\n", "utf8");

console.log("Runtime npm license inventory: " + inventory.length + " packages with packaged license evidence.");
