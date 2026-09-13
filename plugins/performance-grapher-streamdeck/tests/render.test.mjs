import test from "node:test";
import assert from "node:assert/strict";
import { renderKey } from "../src/render.js";

function decode(data) {
  return decodeURIComponent(data.slice(data.indexOf(",") + 1));
}

for (const size of [72, 96, 144]) {
  test("renderer stays Stream Deck-native at " + size + "px", () => {
    const data = renderKey({
      label: "GPU TEMP",
      value: 73,
      unit: "°C",
      secondary: "5 MIN",
      points: [[1, 60], [2, 66], [3, 73]],
      state: "ready",
      breached: false,
    }, {}, size);
    assert.ok(data.startsWith("data:image/svg+xml"));
    const svg = decode(data);
    assert.match(svg, new RegExp('width="' + size + '"'));
    assert.match(svg, /GPU TEMP/);
    assert.match(svg, />73</);
    assert.ok(svg.length < 10_000);
  });
}

test("permission state is visible instead of showing stale FPS", () => {
  const svg = decode(renderKey({ label: "GAME FPS", value: null, unit: "FPS", secondary: "", points: [], state: "permission_required" }, {}, 144));
  assert.match(svg, /PERM/);
  assert.match(svg, /CHECK SETUP/);
});


test("Game FPS shows a clear idle state when telemetry is ready but no game is active", () => {
  const telemetry = {
    metricValue() { return null; },
    metricSeries() { return []; },
    safeStatus() { return { fps: { state: "ready" }, hardware: { state: "ready" } }; },
    session: {
      snapshot() {
        return { active: false, process: "", current: null, lastCompleted: null };
      },
    },
  };

  const view = makeView(telemetry, "fps", { fpsMode: "fps", lowMode: "one", windowMs: 60_000 });
  assert.equal(view.value, null);
  assert.equal(view.secondary, "START A GAME");

  const svg = decodeURIComponent(renderKey(view, {}, 144));
  assert.match(svg, /START A GAME/);
});


test("long process and secondary labels are bounded on key", () => {
  const image = renderKey({
    label: "ExtremelyLongGameExecutableName",
    value: 144,
    unit: "FPS",
    secondary: "An Extremely Long Session Context Label",
    points: [],
    state: "ready",
  }, {}, 72);
  const svg = decodeURIComponent(image);

  assert.ok(svg.includes("EXTREMELYLONGGAM…"));
  assert.ok(svg.includes("AN EXTREMELY LONG SES…"));
  assert.ok(!svg.includes("EXTREMELYLONGGAMEEXECUTABLENAME"));
});
