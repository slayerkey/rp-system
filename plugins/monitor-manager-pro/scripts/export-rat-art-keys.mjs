#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { keyImage } from "../src/key-visuals.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const renderer = resolve(repo, "tools/ship/render_svg_icon.mjs");

const outArg = process.argv[2];
if (!outArg) throw new Error("usage: node export-rat-art-keys.mjs <output-dir>");
const out = resolve(outArg);
const scratch = resolve(out, ".rat-art-runtime-svg");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
mkdirSync(out, { recursive: true });

const specs = [
  ["brightness", ["65%"]],
  ["contrast", ["50%"]],
  ["volume", ["50%"]],
  ["power", ["ON"]],
  ["input", ["DP"]],
  ["refresh-rate", ["165HZ"]],
  ["resolution", ["1440P"]],
  ["hdr", ["HDR", "ON"]],
  ["topology", ["EXTEND"]],
  ["primary", ["PRIMARY"]],
  ["orientation", ["LAND"]],
  ["save-profile", ["SAVE", "GAMING"]],
  ["apply-profile", ["APPLY", "GAMING"]],
  ["status", ["165HZ", "1440P"]],
  null,
];

for (let i = 0; i < specs.length; i++) {
  let svg;
  if (specs[i] === null) {
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="24" fill="#05070A"/></svg>';
  } else {
    const [kind, lines] = specs[i];
    const dataUri = keyImage(kind, lines);
    const prefix = "data:image/svg+xml;base64,";
    if (!dataUri.startsWith(prefix)) throw new Error("Monitor Manager keyImage did not return an SVG data URI");
    svg = Buffer.from(dataUri.slice(prefix.length), "base64").toString("utf8");
  }

  const src = resolve(scratch, String(i).padStart(2, "0") + ".svg");
  const dst = resolve(out, String(i).padStart(2, "0") + ".png");
  writeFileSync(src, svg, "utf8");
  const result = spawnSync(process.execPath, [renderer, src, dst], {
    cwd: repo,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("Failed to rasterize exact Monitor Manager runtime key " + i);
  }
}

rmSync(scratch, { recursive: true, force: true });
console.log("MONITOR MANAGER EXACT RUNTIME KEY EXPORT PASS: " + out);
