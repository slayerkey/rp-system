# Handoff: macOS support + Encoder (dial) action

Paste-ready build spec for two additions to **Better Hotkeys & Mouse**
(`com.packrat.betterhotkeys`). Both land **inside this existing plugin** — not a
second plugin. A single Stream Deck plugin can hold both `Keypad` and `Encoder`
actions (controller type is per-action), so the new dial action is just one more
entry in `com.packrat.betterhotkeys.sdPlugin/manifest.json`, sharing the same
native input layer. Result for buyers: one install, one update.

These two items are the gating dependency for two profile tiers in the
`ratpack-projects` profile builder:
- **macOS support** unblocks the Palworld + Valorant macOS profiles (they use
  `togglekey`/`holdkey`/`togglemouse`/`clickmouse`).
- **Encoder Hotkey** unblocks the DaVinci + Streamer Starter Pack **Stream Deck +**
  (dial) profiles.

---

## Current architecture (context)

- TypeScript, bundled with rollup (`npm run build` → `bin/plugin.js`), `@elgato/streamdeck` v2, SDK v3.
- Native input is done with **koffi** (cross-platform FFI). All Windows-specific
  code lives in `src/win32/` (`input.ts`, `mouse.ts`, `audio.ts`, `held-keys.ts`).
  `src/win32/input.ts` loads `user32.dll` and sends **scancodes** via `SendInput`
  (so injection reaches DirectInput/RawInput games, not just message-loop apps).
- Actions in `src/actions/*.ts` call into that layer. 14 actions today, all
  `"Controllers": ["Keypad"]`. Manifest `OS` currently lists **windows only**.

koffi runs on macOS too, so the same FFI approach binds CoreGraphics on Mac.

---

## Deliverable A — macOS support (keyboard + mouse MVP)

### A1. Manifest
In `com.packrat.betterhotkeys.sdPlugin/manifest.json`, add a mac entry to `OS`:
```json
"OS": [
  { "Platform": "windows", "MinimumVersion": "10" },
  { "Platform": "mac", "MinimumVersion": "11" }
]
```

### A2. Platform-dispatched input layer
Introduce a neutral entry point the actions import instead of `../win32/input`,
e.g. `src/input/index.ts`:
```ts
export * from process.platform === "darwin" ? "../darwin/input" : "../win32/input";
```
(or an explicit `if` re-export if the bundler prefers it). Then create
**`src/darwin/input.ts`** mirroring the exported surface of `src/win32/input.ts`
— same function names/signatures so `src/actions/*` need no per-action changes:
`keyEvent`/`sendInputs` (or an equivalent `pressKey(vk, down)` batch), plus the
mouse helpers `mouseMoveTo`, `mouseMoveBy`, `mouseButtonEvent`, `mouseWheel`,
`cursorPos`, `virtualScreen`, `monitors`.

Implement with koffi against CoreGraphics:
```
koffi.load("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
```
Bind and use:
- `CGEventCreateKeyboardEvent(source, keycode /*uint16 kVK*/, keydown /*bool*/)`
  then `CGEventPost(kCGHIDEventTap /*=0*/, event)` and `CFRelease(event)`.
  Set modifier flags with `CGEventSetFlags` (maskShift 0x20000, maskControl
  0x40000, maskAlternate 0x80000, maskCommand 0x100000) — see A4.
- Mouse: `CGEventCreateMouseEvent` (move/down/up), `CGEventCreateScrollWheelEvent`
  (wheel), `CGWarpMouseCursorPosition` / `CGEventCreateMouseEvent` for absolute
  moves. Multi-monitor geometry via `CGGetActiveDisplayList` + `CGDisplayBounds`
  (mirror `virtualScreen()`/`monitors()`).

### A3. Keycodes — the plugin receives macOS kVK codes on Mac
The profile builder emits **OS-appropriate codes**: a macOS profile's action
`Settings` already carry macOS `kVK_*` keycodes in the `vk` field. So on Mac the
plugin should treat the incoming `vk` as a **CoreGraphics keycode directly** and
pass it to `CGEventCreateKeyboardEvent`. The Windows-only concepts
(`mode: "scancode"`, scancode translation, extended-key flags) **do not apply on
macOS** — ignore `mode` on Mac.

### A4. Modifiers
The builder sends modifiers either as discrete modifier keys in the `keys` array
(for `togglekey`/`holdkey`, e.g. Shift+W = `[{vk:56},{vk:13}]`) **or**, for the
Encoder action below, as a `modifiers` bitmask (`Shift=1 Ctrl=2 Alt=4 Cmd=8`).
For the bitmask form, translate to CGEventFlags on the emitted key event.

### A5. Audio actions (follow-up, not MVP)
`mutemic` and `micvolume` use Windows Core Audio (`src/win32/audio.ts`). No
macOS profile in scope uses them for the first release, so the mac audio layer
(CoreAudio `AudioObjectSetPropertyData` on the default input device) can be a
**phase-2** follow-up. Ship keyboard + mouse first.

### A6. Permissions
First keyboard/mouse injection on macOS requires the user to grant **Accessibility**
permission (System Settings → Privacy & Security → Accessibility) to the Stream
Deck app. Detect failure and surface a clear `showAlert` + one-time message.

---

## Deliverable B — Encoder Hotkey action (reusable dial primitive)

One general-purpose dial action, **not** a per-game one. It maps dial rotate / push
/ touch to arbitrary hotkeys, so every current and future profile gets dial support
with zero new plugin code.

### B1. Manifest action entry
Add to the `Actions` array:
```json
{
  "Name": "Encoder Hotkey",
  "UUID": "com.packrat.betterhotkeys.encoderhotkey",
  "Icon": "imgs/actions/encoderhotkey/icon",
  "Tooltip": "Map a dial: turn, push, and tap each send a hotkey. Jog, zoom, scrub, nudge.",
  "PropertyInspectorPath": "ui/encoder-hotkey.html",
  "Controllers": ["Encoder"],
  "Encoder": {
    "layout": "$B1",
    "TriggerDescription": {
      "Rotate": "Send hotkey",
      "Push": "Send hotkey",
      "Touch": "Send hotkey"
    }
  },
  "States": [{ "Image": "imgs/actions/encoderhotkey/key", "TitleAlignment": "middle" }]
}
```

### B2. Settings schema (exactly what the profile builder emits)
```jsonc
{
  "rotateCW":  { "vk": <int>, "modifiers": <bitmask> },  // one tick clockwise
  "rotateCCW": { "vk": <int>, "modifiers": <bitmask> },  // one tick counter-clockwise
  "push":      { "vk": <int>, "modifiers": <bitmask> },  // dial press (optional)
  "touchTap":  { "vk": <int>, "modifiers": <bitmask> },  // touchscreen tap (optional)
  "stepSize": 1,          // keystrokes emitted per rotation tick
  "acceleration": true,   // fast spins emit extra keystrokes (fine vs. scrub)
  "mode": "scancode"      // Windows only; ignored on macOS
}
```
`vk` is a Windows VK on the Windows profile and a macOS kVK on the Mac profile —
same field, OS-appropriate value (the profile is OS-specific). Any sub-object may
be omitted/empty (e.g. a jog dial with no touch action) — treat missing as no-op.
`modifiers` bitmask: `Shift=1 Ctrl=2 Alt=4 Cmd/Win=8`.

### B3. Runtime (SDK v3 encoder events)
- `onDialRotate({ ticks })`: for `n = round(|ticks| * stepSize)` (plus an
  acceleration bump when `|ticks|` is large and `acceleration` is on), emit the
  `rotateCW` hotkey `n` times if `ticks > 0`, else `rotateCCW`. "Emit a hotkey" =
  press modifiers down, press+release `vk`, release modifiers — reusing the shared
  input layer (Deliverable A on Mac, `src/win32` on Windows).
- `onDialDown` / `onDialUp`: fire `push` (press on down / release on up, or a
  press+release on down — match how `holdkey` models press).
- `onTouchTap`: fire `touchTap`.
- Optional: reflect the action title / a value readout on the touchscreen via
  `setFeedback`.

---

## Contract with the profile builder (keep both sides in sync)

`ratpack-projects/profiles/_build/common.py` will add an encoder builder that
emits an action with:
- `UUID` = `com.packrat.betterhotkeys.encoderhotkey`
- `Settings` exactly per **B2**
- placed in the page manifest's **Encoder** controller (`"Type": "Encoder"`),
  keyed by dial coord `"0,0".."3,0"`, optionally with an `"Encoder"` touchscreen
  slot object (`{"Icon": "..."}`).

If any field name here changes, change it in `common.py` too.

---

## Acceptance criteria

**Windows (regression):** all 14 existing actions behave exactly as before; the
new action works on a Stream Deck +.

**macOS (Deliverable A):**
- Palworld "Auto-Sprint" (`togglekey` Shift+W) toggles and holds in-game.
- `holdkey` (e.g. push-to-talk) holds only while the SD key is held.
- `togglemouse` / `clickmouse` (left click at a point) work.
- First use prompts for Accessibility; after granting, injection works.

**Encoder Hotkey (Deliverable B), on a Stream Deck +:**
- In DaVinci Resolve, a dial mapped to `rotateCW=Right, rotateCCW=Left` jogs the
  playhead one frame per tick; `push=Space` plays/pauses.
- A dial mapped to zoom (`Cmd/Ctrl + =` / `-`) scales the timeline.
- `stepSize` and `acceleration` change how fast a value moves per spin.
