"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

(() => {
  const file = path.join(__dirname, "property-inspector.html");
  const html = fs.readFileSync(file, "utf8");
  for (const id of ["mode", "process", "appOptions", "step", "pressAction", "status"]) {
    assert(new RegExp(`id=["']${id}["']`).test(html), `Missing PI control ${id}`);
  }
  for (const value of ["current", "process", "1", "2", "5", "toggle-mute", "none"]) {
    assert(html.includes(`value="${value}"`), `Missing PI value ${value}`);
  }
  assert(html.includes("connectElgatoStreamDeckSocket"));
  assert(html.includes("event:'setSettings'"));
  assert(html.includes("event:'sendToPlugin'"));
  assert(html.includes("command:'list-apps'"));
  assert(html.includes("sendToPropertyInspector"));
  assert(html.includes("Local only"));
  assert(!/<script\s+[^>]*src=/i.test(html), "PI must not load external scripts");
  assert(!/<link\s+[^>]*href=/i.test(html), "PI must not load external stylesheets");
  assert(!/https?:\/\//i.test(html), "PI must not make external web references");
  assert(!/fetch\s*\(/i.test(html), "PI must not make network fetches");
  console.log("App Volume property inspector passed: narrow settings UI, active-app request, local-only dependencies, no external network surface");
})();
