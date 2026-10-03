#!/usr/bin/env node
import fs from "node:fs";

const submissionPath = process.argv[2];
const canaryPath = process.argv[3];
const outputPath = process.argv[4];

if (!submissionPath || !canaryPath || !outputPath) {
  console.error("Usage: node tools/security/apply-marketing-canary.mjs <submission.json> <MARKETING-CANARY.json> <output.json>");
  process.exit(2);
}

const submission = JSON.parse(fs.readFileSync(submissionPath, "utf8"));
const canary = JSON.parse(fs.readFileSync(canaryPath, "utf8"));
const phrase = canary.exact_listing_canary_sentence;

if (typeof submission.description !== "string" || !submission.description.trim()) {
  throw new Error("submission.description must be a non-empty string");
}
if (typeof phrase !== "string" || !phrase.trim()) {
  throw new Error("MARKETING-CANARY.json is missing exact_listing_canary_sentence");
}

let description = submission.description.trimEnd();
if (!description.includes(phrase)) {
  const ecosystem = "\n\nPart of the PackRat ecosystem.";
  if (description.endsWith(ecosystem.trimStart())) {
    description = description.slice(0, -ecosystem.trimStart().length).trimEnd()
      + "\n\n" + phrase
      + ecosystem;
  } else {
    description += "\n\n" + phrase;
  }
}

const output = {
  ...submission,
  description,
  packrat_build_marker: canary.packrat_build_marker,
  packrat_listing_canary: phrase
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({
  output: outputPath,
  marker: canary.packrat_build_marker,
  phrase,
  description_occurrences: output.description.split(phrase).length - 1
}));
