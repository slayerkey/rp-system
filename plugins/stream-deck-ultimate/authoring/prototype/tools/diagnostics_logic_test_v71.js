"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const pluginDir = path.resolve(process.argv[2]);
const d = require(path.join(pluginDir, "bin", "lib-v071-diagnostics.js"));

const redacted = d.redactText("C:\\Users\\SecretPerson\\Desktop\\thing.txt https://private.example/a?token=abc person@example.com");
assert(!redacted.includes("SecretPerson"));
assert(!redacted.includes("private.example"));
assert(!redacted.includes("person@example.com"));
assert(redacted.includes("<url>"));
assert(redacted.includes("<email>"));

assert.equal(d.safeApp("@Discord"), "@discord");
assert.equal(d.safeApp("C:\\Users\\SecretPerson\\Apps\\MyTool.exe"), "MyTool.exe");

const reportConfig = d.sanitizeConfigForReport({
  setupComplete: true,
  outputDevice: "Headphones",
  inputDevice: "Microphone",
  workspaces: {
    work: { apps: ["@browser", "C:\\Users\\SecretPerson\\Apps\\MyTool.exe"], layout: "columns", url: "https://private.example/project?secret=1" }
  },
  presets: { work: { volume: 41, micMode: "keep", output: "Headphones", input: "Microphone" } },
  clipboard: { enabled: true, maxItems: 9 }
});
assert.equal(reportConfig.setupComplete, true);
assert.deepEqual(reportConfig.workspaces.work.apps, ["@browser", "MyTool.exe"]);
assert.equal(reportConfig.workspaces.work.urlConfigured, true);
assert.equal(reportConfig.workspaces.work.url, undefined);
assert.equal(reportConfig.presets.work.volume, 41);
assert.equal(reportConfig.clipboard.maxItems, 9);
assert(!JSON.stringify(reportConfig).includes("SecretPerson"));
assert(!JSON.stringify(reportConfig).includes("private.example"));

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "packrat-diag-logic-"));
const log = path.join(temp, "ultimate-bundle.log");
fs.writeFileSync(log, "2026-08-30T10:00:00.000Z connected\n2026-08-30T10:00:01.000Z action failure SUPER_SECRET_LOG_DETAIL C:\\Users\\SecretPerson\\x\n", "utf8");
const summary = d.logSummary(log);
assert.equal(summary.exists, true);
assert.equal(summary.lineCount, 2);
assert.equal(summary.issueLineCount, 1);
assert(!JSON.stringify(summary).includes("SUPER_SECRET_LOG_DETAIL"));
assert(!JSON.stringify(summary).includes("SecretPerson"));

const name = d.reportName(new Date("2026-08-30T19:00:00.000Z"));
assert.equal(name, "PackRat-Ultimate-Diagnostics-20260830T190000Z.json");

console.log("v0.7.1 diagnostics logic passed: path/url/email redaction, config minimization, secret-free log summary, deterministic filename");
