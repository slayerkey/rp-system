"use strict";
const base = require("./lib-v06-system.js");

async function runWorkspace(def = {}, log = () => {}) {
  const apps = Array.isArray(def.apps) ? def.apps.filter(Boolean) : [];
  if (apps.length) return base.runWorkspace({ ...def, apps }, log);

  // Empty is a deliberate valid configuration in v0.6: a routine may only
  // change audio, or only open a meeting link, without launching a dummy app.
  let failures = 0;
  if (def.url) {
    try { await base.runPS(`Start-Process ${base.psQuote(def.url)}`); }
    catch (e) { failures++; log(`workspace url: ${e.message}`); }
  }
  return { failures, total: 0, ready: 0 };
}

module.exports = { ...base, runWorkspace };
