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


test("unconfigured direct device key says SELECT DEVICE, not REBIND", () => {
  const svg = decodeSvg(renderKey("set-output", {
    endpoint: null,
    missing: false,
    role: "default",
  }));
  assert.match(svg, /SELECT DEVICE/);
  assert.doesNotMatch(svg, /REBIND/);
});

test("previously configured missing device key says REBIND", () => {
  const svg = decodeSvg(renderKey("set-output", {
    endpoint: { name: "Old Headset" },
    missing: true,
    role: "default",
  }));
  assert.match(svg, /REBIND/);
});


test("missing default mic never renders MIC LIVE", () => {
  const svg = decodeSvg(renderKey("mute-mic", {
    endpoint: null,
    missing: true,
  }));
  assert.match(svg, /NO DEFAULT MIC/);
  assert.doesNotMatch(svg, /MIC LIVE/);
});

test("offline audio actions render an explicit offline state", () => {
  const deviceSvg = decodeSvg(renderKey("set-output", {
    endpoint: { name: "Headset" },
    offline: true,
    role: "default",
  }));
  assert.match(deviceSvg, /AUDIO OFFLINE/);
  assert.ok(deviceSvg.includes("#FF6B76"));

  const micSvg = decodeSvg(renderKey("mute-mic", {
    endpoint: null,
    missing: true,
    offline: true,
  }));
  assert.match(micSvg, /AUDIO OFFLINE/);
  assert.ok(micSvg.includes("#FF6B76"));
});


test("profile keys render OFFLINE as a danger state", () => {
  const svg = decodeSvg(renderKey("apply", {
    profile: { name: "Meeting", accent: "#56F2A5" },
    status: "OFFLINE",
  }));
  assert.match(svg, /OFFLINE/);
  assert.ok(svg.includes("#FF6B76"));
});
