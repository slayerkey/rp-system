#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/pc-power-import-contract";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node pc-power-pro-import-contract.mjs <exact-package-index.html> [out-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(entry, "utf8");
const tags = [...html.matchAll(/<meta\s+name=["']x-icue-property["'][^>]*>/gi)].map((m) => m[0]);
const byName = new Map();
for (const tag of tags) {
  const name = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
  if (name) byName.set(name, tag);
}

const report = {
  schema_version: 2,
  entry: path.basename(entry),
  controls: {},
  sliderCount: 0,
  numericAttributeCount: 0,
  passed: false,
};

function attr(tag, name) {
  const doubleQuoted = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  if (doubleQuoted) return doubleQuoted[1];
  const singleQuoted = tag.match(new RegExp(`\\b${name}='([^']*)'`, "i"));
  return singleQuoted ? singleQuoted[1] : null;
}
function requireControl(name, type) {
  const tag = byName.get(name);
  if (!tag) throw new Error(`missing ${name}`);
  const actual = attr(tag, "data-type");
  if (actual !== type) throw new Error(`${name}: expected ${type}, got ${actual}`);
  report.controls[name] = {
    type: actual,
    default: attr(tag, "data-default"),
    min: attr(tag, "data-min"),
    max: attr(tag, "data-max"),
    step: attr(tag, "data-step"),
  };
  return tag;
}

try {
  if (/data-type=["']sensors-factory["']/i.test(html)) {
    throw new Error("sensors-factory remains in exact package");
  }

  report.sliderCount = tags.filter((tag) => attr(tag, "data-type") === "slider").length;
  report.numericAttributeCount = tags.reduce((count, tag) => {
    return count + ["data-min", "data-max", "data-step"].filter((name) => attr(tag, name) !== null).length;
  }, 0);
  if (report.sliderCount !== 0 || report.numericAttributeCount !== 0) {
    throw new Error(`numeric importer bisection is not clean: ${report.sliderCount} sliders, ${report.numericAttributeCount} numeric range attributes`);
  }

  requireControl("primarySensor", "sensors-combobox");
  for (const name of ["comparisonSensor1", "comparisonSensor2", "comparisonSensor3"]) {
    requireControl(name, "sensors-combobox");
  }

  const rate = requireControl("electricityRate", "textfield");
  const threshold = requireControl("highPowerThreshold", "textfield");
  if (attr(rate, "data-default") !== "'0.15'") {
    throw new Error(`electricityRate default changed: ${attr(rate, "data-default")}`);
  }
  if (attr(threshold, "data-default") !== "'0'") {
    throw new Error(`highPowerThreshold default changed: ${attr(threshold, "data-default")}`);
  }

  if (!/Number\(getIcueProperty\(["']electricityRate["']/i.test(html)) {
    throw new Error("runtime no longer parses electricityRate numerically");
  }
  if (!/Number\(getIcueProperty\(["']highPowerThreshold["']/i.test(html)) {
    throw new Error("runtime no longer parses highPowerThreshold numerically");
  }

  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
}

fs.writeFileSync(path.join(outDir, "pc-power-pro-import-contract.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
