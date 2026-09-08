"use strict";
const path = require("path");
const pluginDir = path.resolve(process.argv[2]);
const cfg = require(path.join(pluginDir, "bin", "lib-v06-config.js"));
const sys = require(path.join(pluginDir, "bin", "lib-v06-workspace.js"));

(async () => {
  const clean = cfg.sanitizeConfig({
    workspaces: { meeting: { apps: [], layout: "none", url: "" } },
    presets: { work: { micMode: "keep" }, focus: { micMode: "mute" } }
  });
  if (clean.workspaces.meeting.apps.length !== 0) throw new Error("Explicit empty routine apps must be preserved");
  const result = await sys.runWorkspace(clean.workspaces.meeting);
  if (result.failures !== 0 || result.total !== 0) throw new Error("Audio-only empty workspace should be a clean no-op");

  for (const [layout, count] of [["work", 6], ["columns", 6], ["grid", 6]]) {
    const rects = sys.planLayout(layout, count);
    if (rects.length !== count) throw new Error(`${layout} did not return ${count} rectangles`);
    for (const r of rects) {
      if (r.length !== 4 || r.some(Number.isNaN) || r[0] < 0 || r[1] < 0 || r[2] <= 0 || r[3] <= 0 || r[0] + r[2] > 1.001 || r[1] + r[3] > 1.001) throw new Error(`${layout} returned invalid rectangle ${JSON.stringify(r)}`);
    }
  }
  console.log("v0.6 product logic passed: empty routines, safe config, work/columns/grid geometry");
})().catch(e => { console.error(e.stack || e); process.exit(1); });
