import test from "node:test";
import assert from "node:assert/strict";
import { renderKey } from "../src/render.js";

function decodeSvg(uri) {
  const prefix = "data:image/svg+xml;charset=utf-8,";
  assert.ok(uri.startsWith(prefix));
  return decodeURIComponent(uri.slice(prefix.length));
}

test("long Unicode device names render without splitting surrogate pairs", () => {
  const svg = decodeSvg(renderKey("set-output", {
    endpoint: { name: "超長いオーディオデバイス🎧🎧🎧🎧🎧🎧🎧" },
    role: "default",
  }));
  assert.match(svg, /DEFAULT OUT/);
  assert.ok(!svg.includes("\uFFFD"));
});

test("communications output key visibly identifies its Windows role", () => {
  const svg = decodeSvg(renderKey("set-output", {
    endpoint: { name: "Headset" },
    role: "communications",
  }));
  assert.match(svg, /COMM OUT/);
});

test("communications input key visibly identifies its Windows role", () => {
  const svg = decodeSvg(renderKey("set-input", {
    endpoint: { name: "Headset Mic" },
    role: "communications",
  }));
  assert.match(svg, /COMM IN/);
});

test("inactive profile status uses warning state", () => {
  const svg = decodeSvg(renderKey("status", {
    profile: { name: "Meeting", accent: "#56F2A5" },
    status: "INACTIVE",
  }));
  assert.ok(svg.includes("#FFCC66"));
});
