#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output || !fs.existsSync(input)) {
  console.error("usage: node pc-power-pro-minimal-import.mjs <input-index.html> <output-index.html>");
  process.exit(2);
}

let html = fs.readFileSync(input, "utf8");
const keep = new Set(["primarySensor", "textColor", "accentColor", "backgroundColor", "graphColor"]);

html = html.replace(/<meta\s+name=["']x-icue-property["'][^>]*>\s*/gi, (tag) => {
  const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
  return content && keep.has(content) ? tag : "";
});

const groups = `<script type="application/json" id="x-icue-groups">
[
  {
    "title": "'Power Source'",
    "properties": ["primarySensor"],
    "info": "'IMPORT DIAGNOSTIC: only the primary power sensor is exposed in settings.'"
  },
  {
    "title": "'Appearance'",
    "properties": ["textColor", "accentColor", "backgroundColor", "graphColor"]
  }
]
</script>`;

html = html.replace(/<script\s+type=["']application\/json["']\s+id=["']x-icue-groups["']>[\s\S]*?<\/script>/i, groups);

const manifestMarker = `<meta name="ratpack-import-diagnostic" content="pc-power-pro-minimal-settings" />`;
html = html.replace(/<\/head>/i, `${manifestMarker}\n</head>`);

for (const forbidden of ["electricityRate", "highPowerThreshold", "comparisonSensor1", "comparisonSensor2", "comparisonSensor3"]) {
  const declaration = new RegExp(`<meta[^>]+content=["']${forbidden}["'][^>]*>`, "i");
  if (declaration.test(html)) throw new Error(`failed to remove ${forbidden} control`);
}
for (const required of keep) {
  const declaration = new RegExp(`<meta[^>]+content=["']${required}["'][^>]*>`, "i");
  if (!declaration.test(html)) throw new Error(`minimal diagnostic lost ${required} control`);
}
if (/data-type=["']slider["']/i.test(html) || /\bdata-(?:min|max|step)=/i.test(html)) {
  throw new Error("minimal diagnostic still contains numeric slider metadata");
}

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, html, "utf8");
console.log(`Wrote minimal PC Power Pro importer diagnostic to ${output}`);
