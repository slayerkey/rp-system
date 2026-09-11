import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = path.resolve(process.argv[2] || "widgets/_src/audio-control-center/index.html");
const slots = [
  ["s-h", 840, 344, 48],
  ["s-v", 696, 416, 50],
  ["m-h", 840, 696, 56],
  ["m-v", 696, 840, 60],
  ["l-h", 1688, 696, 70],
  ["l-v", 696, 1688, 70],
  ["xl-h", 2536, 696, 70],
  ["xl-v", 696, 2536, 70]
];

const hostileName = "<b>not markup</b> 🎧 日本語 qypjgj — An Extremely Long USB Audio Interface Friendly Name That Must Stay Contained";
const base = {
  type: "snapshot",
  protocol: 1,
  bridge: { listening: true, version: "1.0.0" },
  capabilities: {
    defaultDeviceSwitching: true,
    outputVolume: true,
    inputVolume: true
  },
  defaultOutputId: "o1",
  defaultInputId: "i1",
  outputs: [
    { id: "o1", name: "Speakers (Realtek Audio)", volume: 60, muted: false, volumeAvailable: true, muteAvailable: true },
    { id: "o2", name: "Headphones (Arctis Nova Pro Wireless)", volume: 35, muted: false, volumeAvailable: true, muteAvailable: true },
    { id: "o3", name: hostileName, volume: 80, muted: false, volumeAvailable: true, muteAvailable: true }
  ],
  inputs: [
    { id: "i1", name: "Microphone (Scarlett Solo USB)", volume: 75, muted: false, volumeAvailable: true, muteAvailable: true },
    { id: "i2", name: "Microphone (USB Camera)", volume: 50, muted: false, volumeAvailable: true, muteAvailable: true }
  ],
  error: null
};

const browser = await chromium.launch({ headless: true });
try {
  for (const s of slots) {
    const ctx = await browser.newContext({ viewport: { width: s[1], height: s[2] } });
    await ctx.addInitScript(function (value) {
      globalThis.__PACKRAT_AUDIO_FIXTURE__ = value;
      globalThis.tr = async function (x) { return x; };
      globalThis.icueEvents = {};
    }, base);

    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
    await page.waitForFunction(() => (
      globalThis.__PACKRAT_AUDIO_TEST__ &&
      document.body.dataset.connection === "ready"
    ));

    const state = await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.getState());
    assert.equal(state.slot, s[0]);
    assert.equal(state.outputs.length, 3);
    assert.equal(state.inputs.length, 2);
    assert.equal(state.protocol, 1);
    assert.equal(state.bridgeVersion, "1.0.0");

    const textSafety = await page.evaluate(() => ({
      text: document.getElementById("outputDevices").innerText,
      boldCount: document.getElementById("outputDevices").querySelectorAll("b").length
    }));
    assert.match(textSafety.text, /<b>not markup<\/b>/);
    assert.match(textSafety.text, /日本語/);
    assert.equal(textSafety.boldCount, 0, s[0] + " rendered a device name as HTML");

    const geo = await page.evaluate(() => {
      const r = (id) => {
        const x = document.getElementById(id).getBoundingClientRect();
        return [Math.min(x.width, x.height), x.width, x.height];
      };
      return {
        dw: document.documentElement.scrollWidth,
        dh: document.documentElement.scrollHeight,
        bw: document.body.scrollWidth,
        bh: document.body.scrollHeight,
        om: r("outputMute"),
        im: r("inputMute"),
        od: r("outputDown"),
        id: r("inputDown")
      };
    });

    assert.ok(
      geo.dw <= s[1] + 1 && geo.bw <= s[1] + 1 &&
      geo.dh <= s[2] + 1 && geo.bh <= s[2] + 1,
      s[0] + " overflow"
    );
    for (const key of ["om", "im", "od", "id"]) {
      assert.ok(geo[key][0] >= s[3], s[0] + " touch " + key);
    }

    const stateFixtures = [
      {
        name: "incompatible",
        value: { ...base, protocol: 2, bridge: { listening: true, version: "2.0.0" } }
      },
      {
        name: "audio-error",
        value: { ...base, error: "Windows audio error 0xDEADBEEF" }
      }
    ];
    for (const fixture of stateFixtures) {
      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), fixture.value);
      assert.equal(await page.locator("body").getAttribute("data-connection"), fixture.name);
      const stateGeo = await page.evaluate(() => ({
        dw: document.documentElement.scrollWidth,
        dh: document.documentElement.scrollHeight,
        bw: document.body.scrollWidth,
        bh: document.body.scrollHeight
      }));
      assert.ok(
        stateGeo.dw <= s[1] + 1 && stateGeo.bw <= s[1] + 1 &&
        stateGeo.dh <= s[2] + 1 && stateGeo.bh <= s[2] + 1,
        s[0] + " " + fixture.name + " overflow"
      );
      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), base);
    }

    if (s[0] === "m-h") {
      await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.clearCommands());

      await page.locator('.device[title="Headphones (Arctis Nova Pro Wireless)"]').click();
      let q = await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.getState());
      assert.equal(q.defaultOutputId, "o2");
      assert.equal(q.commands.at(-1).command, "set-default-output");

      await page.locator("#outputMute").click();
      q = await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.getState());
      assert.equal(q.outputs.find((x) => x.id === "o2").muted, true);
      await page.locator("#outputMute").click();
      q = await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.getState());
      assert.equal(q.outputs.find((x) => x.id === "o2").muted, false, "rapid repeat mute should be deterministic");

      await page.locator("#outputVolume").evaluate((element) => {
        element.value = "27";
        element.dispatchEvent(new Event("change", { bubbles: true }));
      });
      q = await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.getState());
      assert.equal(q.outputs.find((x) => x.id === "o2").volume, 27);

      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), {
        ...base,
        outputs: base.outputs.slice(0, 2)
      });
      assert.equal((await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.getState())).outputs.length, 2);

      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), {
        ...base,
        outputs: [],
        inputs: [],
        defaultOutputId: "",
        defaultInputId: ""
      });
      assert.match(await page.locator("#outputDevices").innerText(), /No active Windows output/i);
      assert.match(await page.locator("#inputDevices").innerText(), /No active Windows input/i);

      await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.disconnect());
      assert.equal(await page.locator("body").getAttribute("data-connection"), "offline");
      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.reconnect(value), base);
      assert.equal(await page.locator("body").getAttribute("data-connection"), "ready");

      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), {
        ...base,
        capabilities: { ...base.capabilities, defaultDeviceSwitching: false },
        inputs: [
          { id: "i1", name: "Fixed gain microphone", volume: null, muted: false, volumeAvailable: false, muteAvailable: true }
        ],
        defaultInputId: "i1"
      });
      assert.equal(await page.locator("#inputVolume").isDisabled(), true);
      assert.equal(await page.locator("#inputVolumeValue").innerText(), "N/A");
      assert.equal(await page.locator('.device[title="Headphones (Arctis Nova Pro Wireless)"]').isDisabled(), true);

      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), {
        ...base,
        protocol: 2,
        bridge: { listening: true, version: "2.0.0" }
      });
      assert.equal(await page.locator("body").getAttribute("data-connection"), "incompatible");
      assert.match(await page.locator("#offlineTitle").innerText(), /update required/i);
      assert.match(await page.locator("#offlineBody").innerText(), /protocol 1/i);

      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), {
        ...base,
        error: "Windows audio error 0xDEADBEEF"
      });
      assert.equal(await page.locator("body").getAttribute("data-connection"), "audio-error");
      assert.match(await page.locator("#offlineBody").innerText(), /Windows audio error/i);

      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), base);
      await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.bridgeError("Default-device switching failed safely."));
      assert.match(await page.locator("#bridgeText").innerText(), /COMMAND FAILED/);
      q = await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.getState());
      assert.match(q.commandError, /failed safely/);
      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), base);

      const crowdedOutputs = Array.from({ length: 14 }, (_, index) => ({
        id: "crowded-out-" + index,
        name: "Output Device " + (index + 1) + " — USB / HDMI / Bluetooth",
        volume: (index * 7) % 101,
        muted: false,
        volumeAvailable: true,
        muteAvailable: true
      }));
      const crowdedInputs = Array.from({ length: 10 }, (_, index) => ({
        id: "crowded-in-" + index,
        name: "Input Device " + (index + 1) + " — Studio Microphone",
        volume: 50,
        muted: false,
        volumeAvailable: true,
        muteAvailable: true
      }));
      await page.evaluate((value) => globalThis.__PACKRAT_AUDIO_TEST__.snapshot(value), {
        ...base,
        outputs: crowdedOutputs,
        inputs: crowdedInputs,
        defaultOutputId: "crowded-out-0",
        defaultInputId: "crowded-in-0"
      });
      const crowded = await page.evaluate(() => {
        const list = document.getElementById("outputDevices");
        const last = list.lastElementChild;
        last.scrollIntoView({ block: "end" });
        const lr = list.getBoundingClientRect();
        const rr = last.getBoundingClientRect();
        return {
          scrollable: list.scrollHeight > list.clientHeight,
          reachable: rr.bottom <= lr.bottom + 2 && rr.top >= lr.top - 2,
          docWidth: document.documentElement.scrollWidth,
          docHeight: document.documentElement.scrollHeight
        };
      });
      assert.equal(crowded.scrollable, true, "crowded device list should scroll internally");
      assert.equal(crowded.reachable, true, "last crowded device should be reachable");
      assert.ok(crowded.docWidth <= s[1] + 1 && crowded.docHeight <= s[2] + 1, "crowded list escaped document bounds");

      await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.cleanup());
      q = await page.evaluate(() => globalThis.__PACKRAT_AUDIO_TEST__.getState());
      assert.equal(q.stopped, true);
      assert.equal(q.watchdogActive, false, "cleanup must stop watchdog interval");
      assert.equal(q.reconnectActive, false, "cleanup must clear reconnect timer");
    }

    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log("AUDIO CONTROL CENTER VISUAL QA PASS: eight layouts, hostile text, crowded lists, compatibility, errors, controls, and cleanup");
