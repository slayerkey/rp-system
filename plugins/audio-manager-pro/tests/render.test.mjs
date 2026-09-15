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
  assert.ok(!svg.includes("\uFFFD"));
});

test("direct device keys omit the crowded gray role footer", () => {
  const output = decodeSvg(renderKey("set-output", {
    endpoint: { name: "Headset" },
    role: "communications",
  }));
  const input = decodeSvg(renderKey("set-input", {
    endpoint: { name: "Headset Mic" },
    role: "default",
  }));
  assert.doesNotMatch(output, /COMM OUT|DEFAULT OUT/);
  assert.doesNotMatch(input, /COMM IN|DEFAULT IN/);
  assert.match(output, /Headset/);
  assert.match(input, /Headset Mic/);
});

test("inactive profile status uses warning state", () => {
  const svg = decodeSvg(renderKey("status", {
    profile: { name: "Meeting", accent: "#56F2A5" },
    status: "INACTIVE",
  }));
  assert.ok(svg.includes("#FFC44D"));
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
  assert.ok(deviceSvg.includes("#FF5D6C"));

  const micSvg = decodeSvg(renderKey("mute-mic", {
    endpoint: null,
    missing: true,
    offline: true,
  }));
  assert.match(micSvg, /AUDIO OFFLINE/);
  assert.ok(micSvg.includes("#FF5D6C"));
});


test("profile keys render OFFLINE as a danger state", () => {
  const svg = decodeSvg(renderKey("apply", {
    profile: { name: "Meeting", accent: "#56F2A5" },
    status: "OFFLINE",
  }));
  assert.match(svg, /OFFLINE/);
  assert.ok(svg.includes("#FF5D6C"));
});


test("direct device keys reserve readable text space below raised glyphs", () => {
  const output = decodeSvg(renderKey("set-output", {
    endpoint: { name: "Headset Earphone (USB Audio Device)" },
    role: "default",
  }));
  assert.match(output, /font-size="1[5798]"/);
  assert.match(output, /y="121"/);
  assert.doesNotMatch(output, /font-size="9"/);
  assert.doesNotMatch(output, /DEFAULT OUT/);

  const mic = decodeSvg(renderKey("mute-mic", {
    endpoint: { name: "Microphone" },
  }));
  assert.match(mic, /y="120"/);
  assert.match(mic, /MIC LIVE/);
});

test("normal direct audio actions use PackRat orange while success remains semantic green", () => {
  const output = decodeSvg(renderKey("set-output", {
    endpoint: { name: "Headset" },
    role: "default",
  }));
  assert.ok(output.includes("#FFB21E"));

  const mic = decodeSvg(renderKey("mute-mic", {
    endpoint: { name: "Microphone" },
    muted: false,
  }));
  assert.ok(mic.includes("#2BE86A"));
});


test("unconfigured profile key uses a two-line safe-area label without redundant badge", () => {
  const svg = decodeSvg(renderKey("apply", { profile: null }));
  assert.match(svg, />SELECT<\/text>/);
  assert.match(svg, />PROFILE<\/text>/);
  assert.doesNotMatch(svg, /SELECT PROFILE/);
  assert.match(svg, /y="42"/);
  assert.match(svg, /y="64"/);
});

test("selected profile text stays inside the tighter safe area", () => {
  const svg = decodeSvg(renderKey("apply", {
    profile: { name: "Very Long Headset Profile Name", accent: "#FFB21E" },
    active: true,
  }));
  assert.match(svg, /y="50"/);
  assert.match(svg, /y="76"/);
  assert.match(svg, /y="104"/);
  assert.doesNotMatch(svg, /Very Long Headset Profile Name/);
});


test("profile accent no longer changes the key frame", () => {
  const svg = decodeSvg(renderKey("apply", {
    profile: { name: "Headset", accent: "#00FF00" },
  }));
  assert.ok(svg.includes("#FFB21E"));
  assert.ok(!svg.includes("#00FF00"));
});
