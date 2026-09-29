#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
const token = process.argv[3];
const phrase = process.argv.slice(4).join(" ");

if (!target || !token) {
  console.error("Usage: node tools/security/scan-packrat-canary.mjs <file-or-directory> <token> [exact marketing phrase]");
  process.exit(2);
}

const hits = [];

function scanFile(file) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return;
  }
  const text = buf.toString("utf8");
  const found = [];
  if (text.includes(token)) found.push("token");
  if (phrase && text.includes(phrase)) found.push("marketing_phrase");
  if (found.length) hits.push({ file, found });
}

function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(p)) walk(path.join(p, name));
  } else if (st.isFile()) {
    scanFile(p);
  }
}

walk(target);

if (!hits.length) {
  console.error(`No PackRat canary found for ${token} in ${target}`);
  process.exit(1);
}

console.log(JSON.stringify({ target, token, hits }, null, 2));
