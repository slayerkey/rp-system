/**
 * T8 -- Core Audio. Run with: npm run test:t8
 * Lists mics, reads default mute/volume, toggles mute and restores it.
 */
import { getMute, getVolume, listCaptureDevices, toggleMute } from "./audio";

let failures = 0;
const ok = (label: string, cond: boolean) => { if (!cond) failures++; console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`); };

console.log("\n--- capture devices ---");
const devices = listCaptureDevices();
console.log(`  found ${devices.length}:`);
for (const d of devices) console.log(`    ${d.isDefault ? "*" : " "} ${d.name}`);
ok("at least one capture device", devices.length > 0);
ok("exactly one default (or zero)", devices.filter((d) => d.isDefault).length <= 1);

console.log("\n--- default mic mute + volume ---");
const startMute = getMute(null);
const vol = getVolume(null);
console.log(`  mute=${startMute}  volume=${vol == null ? "?" : Math.round(vol * 100) + "%"}`);
ok("mute is readable (true/false)", typeof startMute === "boolean");
ok("volume is 0..1", vol != null && vol >= 0 && vol <= 1);

console.log("\n--- toggle and restore ---");
const flipped = toggleMute(null);
ok("toggle returned the opposite state", flipped === !startMute);
ok("read-back matches the toggle", getMute(null) === flipped);
const restored = toggleMute(null);
ok("restored to the original state", restored === startMute && getMute(null) === startMute);

console.log(failures === 0 ? "\nT8 PASSED -- all checks green.\n" : `\nT8 FAILED -- ${failures} red.\n`);
process.exit(failures === 0 ? 0 : 1);
