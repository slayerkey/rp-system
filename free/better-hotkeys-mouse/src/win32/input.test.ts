/**
 * T0 -- FFI smoke test. Run with: node --experimental-strip-types src/win32/input.test.ts
 *
 * Sends real key events to this machine, so it always releases what it presses.
 * Verifies against GetAsyncKeyState rather than a target app, which keeps the test
 * headless while still proving Windows genuinely registered the key as held.
 */
import { createRequire } from "node:module";
import { assertLayout, INPUT, keyEvent, scanFor, sendInputs } from "./input";

const require = createRequire(import.meta.url);
const koffi = require("koffi");
const user32 = koffi.load("user32.dll");
const GetAsyncKeyState = user32.func("short __stdcall GetAsyncKeyState(int vKey)");

const VK = {
	LSHIFT: 0xa0,
	RCONTROL: 0xa3,
	W: 0x57,
	RIGHT: 0x27,
	NUMPAD6: 0x66
} as const;

const isDown = (vk: number): boolean => (GetAsyncKeyState(vk) & 0x8000) !== 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
	const ok = actual === expected;
	if (!ok) failures++;
	console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, expected ${expected})`}`);
}

console.log("\n--- struct layout ---");
assertLayout();
check("sizeof(INPUT) === 40", koffi.sizeof(INPUT), 40);

console.log("\n--- scancode mapping ---");
check("W          -> sc 0x11, not extended", JSON.stringify(scanFor(VK.W)), JSON.stringify({ sc: 0x11, ext: false }));
check("LSHIFT     -> sc 0x2a, not extended", JSON.stringify(scanFor(VK.LSHIFT)), JSON.stringify({ sc: 0x2a, ext: false }));
check("RCONTROL   -> sc 0x1d, EXTENDED", JSON.stringify(scanFor(VK.RCONTROL)), JSON.stringify({ sc: 0x1d, ext: true }));
check("RIGHT      -> sc 0x4d, EXTENDED", JSON.stringify(scanFor(VK.RIGHT)), JSON.stringify({ sc: 0x4d, ext: true }));
check("NUMPAD6    -> sc 0x4d, not extended", JSON.stringify(scanFor(VK.NUMPAD6)), JSON.stringify({ sc: 0x4d, ext: false }));

async function holdTest(): Promise<void> {
	console.log("\n--- the actual product hypothesis: does a key STAY down? ---");
	sendInputs([keyEvent(VK.LSHIFT, true)]);
	await sleep(150);
	check("LSHIFT is down after key-down", isDown(VK.LSHIFT), true);
	await sleep(600);
	check("LSHIFT STILL down 750ms later (no auto-release)", isDown(VK.LSHIFT), true);
	sendInputs([keyEvent(VK.LSHIFT, false)]);
	await sleep(150);
	check("LSHIFT released after key-up", isDown(VK.LSHIFT), false);

	console.log("\n--- multiple simultaneous keys (Shift+W = auto-run) ---");
	sendInputs([keyEvent(VK.LSHIFT, true), keyEvent(VK.W, true)]);
	await sleep(150);
	check("LSHIFT down", isDown(VK.LSHIFT), true);
	check("W down at the same time", isDown(VK.W), true);
	sendInputs([keyEvent(VK.W, false), keyEvent(VK.LSHIFT, false)]);
	await sleep(150);
	check("both released", isDown(VK.LSHIFT) || isDown(VK.W), false);

	console.log("\n--- extended-key fix: RIGHT must not land as NUMPAD6 ---");
	sendInputs([keyEvent(VK.RIGHT, true)]);
	await sleep(150);
	const rightDown = isDown(VK.RIGHT);
	const numpad6Down = isDown(VK.NUMPAD6);
	sendInputs([keyEvent(VK.RIGHT, false)]);
	await sleep(150);
	check("RIGHT registered as VK_RIGHT", rightDown, true);
	check("RIGHT did NOT register as VK_NUMPAD6", numpad6Down, false);
	check("RIGHT released cleanly", isDown(VK.RIGHT), false);

	console.log("\n--- control: same key WITHOUT the extended flag (proves the bug is real) ---");
	// Hand-build a Right Arrow event with the E0 prefix deliberately omitted.
	const KEYEVENTF_SCANCODE = 0x0008;
	const KEYEVENTF_KEYUP = 0x0002;
	const bare = (down: boolean) => ({
		type: 1,
		u: { ki: { wVk: 0, wScan: 0x4d, dwFlags: KEYEVENTF_SCANCODE | (down ? 0 : KEYEVENTF_KEYUP), time: 0, dwExtraInfo: 0 } }
	});
	sendInputs([bare(true)]);
	await sleep(150);
	const bareRight = isDown(VK.RIGHT);
	const bareNumpad = isDown(VK.NUMPAD6);
	sendInputs([bare(false)]);
	await sleep(150);
	console.log(`  INFO  without E0: VK_RIGHT=${bareRight}  VK_NUMPAD6=${bareNumpad}`);
	check("without E0 it lands as NUMPAD6, not RIGHT (bug confirmed)", bareNumpad && !bareRight, true);

	console.log(failures === 0 ? "\nT0 PASSED -- all checks green.\n" : `\nT0 FAILED -- ${failures} check(s) red.\n`);
	process.exit(failures === 0 ? 0 : 1);
}

holdTest().catch((e) => {
	console.error("T0 threw:", e);
	process.exit(1);
});
