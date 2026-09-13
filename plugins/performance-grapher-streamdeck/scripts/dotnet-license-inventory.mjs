import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const projectDir = resolve(root, "native", "PackRat.PerformanceTelemetry");
const assetsPath = resolve(projectDir, "obj", "project.assets.json");
const outputDir = resolve(root, "com.packrat.performance-grapher.sdPlugin", "licenses", "dotnet");
await mkdir(outputDir, { recursive: true });

const assets = JSON.parse(await readFile(assetsPath, "utf8"));
const packageFolders = Object.keys(assets.packageFolders || {});
if (!packageFolders.length) throw new Error("NuGet project.assets.json does not declare packageFolders.");

const libraries = Object.entries(assets.libraries || {})
  .filter(([, meta]) => meta?.type === "package")
  .map(([key, meta]) => {
    const slash = key.lastIndexOf("/");
    return {
      id: slash >= 0 ? key.slice(0, slash) : key,
      version: slash >= 0 ? key.slice(slash + 1) : "",
      key,
      meta,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version));

function xmlText(xml, tag) {
  const match = xml.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + tag + ">", "i"));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : null;
}

function xmlAttr(xml, tag, attr) {
  const match = xml.match(new RegExp("<" + tag + "\\s+[^>]*" + attr + '=["\\\']([^"\\\']+)["\\\'][^>]*>', "i"));
  return match ? match[1].trim() : null;
}

async function findPackageRoot(pkg) {
  const rel = join(pkg.id.toLowerCase(), pkg.version.toLowerCase());
  for (const folder of packageFolders) {
    const candidate = resolve(folder, rel);
    try {
      const entries = await readdir(candidate);
      if (entries.length) return candidate;
    } catch {}
  }
  return null;
}

async function findNuspec(dir) {
  if (!dir) return null;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".nuspec")) return resolve(dir, entry.name);
  }
  return null;
}

function safeName(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, "_");
}

const inventory = [];
for (const pkg of libraries) {
  const packageRoot = await findPackageRoot(pkg);
  const nuspecPath = await findNuspec(packageRoot);
  let nuspec = "";
  if (nuspecPath) nuspec = await readFile(nuspecPath, "utf8");

  const licenseType = xmlAttr(nuspec, "license", "type");
  const licenseValue = xmlText(nuspec, "license");
  const licenseUrl = xmlText(nuspec, "licenseUrl");
  const projectUrl = xmlText(nuspec, "projectUrl");
  const repositoryUrl = xmlAttr(nuspec, "repository", "url");
  const copyright = xmlText(nuspec, "copyright");
  const authors = xmlText(nuspec, "authors");

  let copiedLicense = null;
  if (licenseType?.toLowerCase() === "file" && licenseValue && packageRoot) {
    const licenseParts = licenseValue.split(/[\\\\/]+/).filter(Boolean);
    const source = resolve(packageRoot, ...licenseParts);
    const declaredName = licenseParts.at(-1) || "LICENSE";
    const destination = resolve(outputDir, safeName(pkg.id + "-" + pkg.version + "-" + declaredName));
    try {
      await cp(source, destination);
      copiedLicense = basename(destination);
    } catch (error) {
      throw new Error("Package declares a license file that could not be copied: " + pkg.key + " -> " + source + ": " + error.message);
    }
  }

  inventory.push({
    id: pkg.id,
    version: pkg.version,
    license_type: licenseType,
    license: licenseValue,
    license_url: licenseUrl,
    project_url: projectUrl,
    repository_url: repositoryUrl,
    copyright,
    authors,
    copied_license_file: copiedLicense,
  });
}

const missing = inventory.filter((x) => !x.license && !x.license_url);
if (missing.length) {
  throw new Error("NuGet packages missing a license declaration: " + missing.map((x) => x.id + "@" + x.version).join(", "));
}

const jsonPath = resolve(outputDir, "NUGET_LICENSE_INVENTORY.json");
await writeFile(jsonPath, JSON.stringify({
  generated_from: "native/PackRat.PerformanceTelemetry/obj/project.assets.json",
  packages: inventory,
}, null, 2) + "\n", "utf8");

const lines = [
  "# .NET / NuGet dependency license inventory",
  "",
  "Generated from the exact restored dependency graph used to publish PackRat.PerformanceTelemetry.",
  "",
  "| Package | Version | License | Project / repository | Packaged license file |",
  "| --- | --- | --- | --- | --- |",
];
for (const item of inventory) {
  const license = item.license || item.license_url || "";
  const project = item.repository_url || item.project_url || "";
  lines.push("| " + item.id + " | " + item.version + " | " + String(license).replaceAll("|", "\\|") + " | " + String(project).replaceAll("|", "\\|") + " | " + (item.copied_license_file || "") + " |");
}
await writeFile(resolve(outputDir, "NUGET_LICENSE_INVENTORY.md"), lines.join("\n") + "\n", "utf8");

console.log("NuGet license inventory: " + inventory.length + " packages; package-supplied license files copied when declared.");
