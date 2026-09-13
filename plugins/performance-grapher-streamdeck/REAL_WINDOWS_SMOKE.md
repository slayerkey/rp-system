# Real Windows smoke

Status: **NOT YET RUN**

This is the remaining release boundary after automated QA. Use the exact validated packaged candidate, not loose source files.

## Host record

- Windows build:
- Stream Deck software:
- installed package SHA-256:
- Stream Deck devices available:
- CPU:
- GPU vendor/model:
- second GPU / iGPU if present:
- GPU driver:
- game/process:
- PresentMon provider state:
- Libre Hardware Monitor helper state:

## Package and profile import

- [ ] Install the exact packaged `.streamDeckPlugin`.
- [ ] Confirm all five actions appear under Performance Grapher.
- [ ] Confirm MK.2 / 15-key profile imports without missing-action placeholders.
- [ ] Confirm XL profile imports without missing-action placeholders.
- [ ] Confirm Stream Deck + profile imports without missing-action placeholders.
- [ ] Confirm Neo profile imports without missing-action placeholders where hardware/software access is available.
- [ ] Confirm profiles remain editable and do not auto-switch on installation.
- [ ] Confirm Stream Deck + profile uses keypad actions only; no phantom encoder action appears.
- [ ] Confirm a profile key opens the correct Property Inspector settings and can be customized.
- [ ] Change Sensor / Metric from CPU Load to RAM Used and confirm the physical key changes immediately.
- [ ] Change Sensor / Metric to GPU Temperature and confirm the picker reports the same live source the key is using, not a false "unavailable" row.
- [ ] Change Accent, close/reopen the Property Inspector, and confirm the color persists and the key redraws.
- [ ] Change a Performance Graph history window from 60 sec to 5 min, close/reopen the Property Inspector, and confirm the window persists and the key redraws.
- [ ] Confirm healthy providers do not leave permanent "Checking game telemetry" / "Checking hardware sensors" cards at the top of every action.
- [ ] Confirm provider warnings appear only when the selected action/metric actually depends on the failing provider.

## Game telemetry

- [ ] Desktop idle does not create a game session.
- [ ] Start a real game and confirm the correct foreground game becomes the session process.
- [ ] Confirm current FPS updates.
- [ ] Confirm frametime mode updates.
- [ ] Confirm 1% low and 0.1% low accumulate from per-frame timings.
- [ ] Confirm a deliberate stutter appears in worst frametime/history.
- [ ] Switch games/processes and confirm the prior session finalizes.
- [ ] Stop the game and confirm current FPS ages out instead of freezing.
- [ ] Cycle 60 sec / 5 min / 15 min / session graph windows.
- [ ] Confirm 15-minute FPS history retains an older drop beyond the raw-history window.
- [ ] Confirm 15-minute frametime history retains an older spike beyond the raw-history window.

## Permissions and provider recovery

- [ ] Exercise PresentMon without required ETW rights where practical.
- [ ] Confirm key/PI shows permission-required state rather than 0 FPS.
- [ ] Confirm PresentMon does not relaunch continuously while permission is denied.
- [ ] Add Performance Log Users rights or use sufficient admin rights.
- [ ] Use Restart game telemetry and confirm capture recovers.
- [ ] Confirm hardware-helper launch failure backs off instead of retrying every few seconds forever.

## Hardware sensors

- [ ] Windows CPU load works.
- [ ] Windows RAM load works.
- [ ] NVIDIA GPU path where available.
- [ ] AMD GPU path where available.
- [ ] Intel GPU path where available.
- [ ] Unsupported/no-GPU path remains usable through CPU/RAM.
- [ ] On a dual-GPU system, canonical GPU metrics follow the loaded adapter without idle flapping.
- [ ] Disconnect/disable a removable sensor/device where practical and confirm raw + canonical values become unavailable without a crash.
- [ ] Reconnect/reenable and confirm catalog/values recover.
- [ ] Confirm unsupported advanced sensors show honest unavailable state.

## Persistence, restart, and wake

- [ ] Run a session long enough to populate raw + archive history.
- [ ] Restart the Stream Deck plugin and confirm recent FPS/frametime history restores.
- [ ] Confirm stale interrupted sessions finalize honestly after a long restart gap.
- [ ] Corrupt the local state file and confirm it is quarantined rather than crashing startup.
- [ ] Put Windows to sleep and wake it.
- [ ] Confirm PresentMon restarts.
- [ ] Confirm hardware telemetry restarts if needed.
- [ ] Confirm the first post-wake CPU sample starts from a fresh delta baseline.

## Key readability

- [ ] 72 px / Mini-class key rendering remains readable.
- [ ] MK.2 / 15-key profile readability.
- [ ] XL profile readability.
- [ ] Stream Deck + keypad readability.
- [ ] Neo profile readability where available.
- [ ] Long process names remain bounded and do not overflow.
- [ ] Permission/unavailable states remain legible.

## Performance A/B

Record a repeatable real-game baseline and plugin-enabled comparison using the same game, scene, settings, and capture duration.

- baseline average FPS:
- baseline 1% low:
- baseline 0.1% low:
- baseline worst / representative frametime:
- plugin-enabled average FPS:
- plugin-enabled 1% low:
- plugin-enabled 0.1% low:
- plugin-enabled worst / representative frametime:
- plugin process normalized CPU average:
- sensor helper normalized CPU average:
- combined plugin + helper private working set:

Target release budget:

- sensor polling: 1 Hz
- visible FPS-like key refresh: <= 4 Hz
- visible hardware key refresh: <= 1 Hz
- one shared PresentMon process
- one shared hardware helper
- PackRat-owned average CPU target: < 1% normalized on the release PC
- plugin + helper private working set target: < 150 MB
- no meaningful repeatable 1% low or frametime regression attributable to Performance Grapher

## Final result

- package/profile import: PASS / BLOCKED
- game telemetry: PASS / BLOCKED
- permissions/recovery: PASS / BLOCKED
- hardware sensors: PASS / BLOCKED
- persistence/wake: PASS / BLOCKED
- readability: PASS / BLOCKED
- performance A/B: PASS / BLOCKED
- final result: **PASS / BLOCKED**

Do not mark `READY_TO_SHIP` until all required sections pass or an unavailable hardware-vendor check is explicitly documented as not available rather than silently assumed.
