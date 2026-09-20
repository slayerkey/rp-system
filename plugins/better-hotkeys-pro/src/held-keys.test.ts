/**
 * T5 -- stuck-key journal. Run with: npm run test:t5
 *
 * Proves the thing the whole journal design exists for: Windows does NOT release a
 * synthetic key when the injecting process dies. A child holds Shift, gets SIGKILLed,
 * and Shift is verified to still be down afterwards -- then recover() clears it.
 *
 * Always force-releases Shift on the way out, however it exits.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isHeld, pressKeys, recover, release } from "./held-keys";
import { keyEvent, sendInputs } from "./win32/input";

const require = createRequire(import.meta.url);
const koffi = require("koffi");
const user32 = koffi.load("user32.dll");
const GetAsyncKeyState = user32.func("short __stdcall GetAsyncKeyState(int vKey)");

const VK_LSHIFT = 0xa0;
const JOURNAL = path.join(os.tmpdir(), "com.packrat.betterhotkeyspro", "held.json");
const HERE = path.dirname(fileURLToPath(import.meta.url));

const isDown = (vk: number) => (GetAsyncKeyState(vk) & 0x8000) !== 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
	const ok = actual === expected;
	if (!ok) failures++;
	console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, expected ${expected})`}`);
}

/** Runs in a child process: hold Shift, journal it, then sit still to be killed. */
const CHILD_SOURCE = `
import { pressKeys } from ${JSON.stringify(pathToFileURL(path.join(HERE, "held-keys.ts")).href)};
pressKeys("victim", [0xa0], "scancode");
console.log("held");
setInterval(() => {}, 1000);
`;

async function main(): Promise<void> {
	fs.rmSync(JOURNAL, { force: true });

	console.log("\n--- normal press/release keeps the journal honest ---");
	pressKeys("t5", [VK_LSHIFT], "scancode");
	await sleep(100);
	check("shift is down", isDown(VK_LSHIFT), true);
	check("journal exists while held", fs.existsSync(JOURNAL), true);
	check("isHeld reports true", isHeld("t5"), true);

	release("t5");
	await sleep(100);
	check("shift released", isDown(VK_LSHIFT), false);
	check("journal removed once nothing is held", fs.existsSync(JOURNAL), false);

	console.log("\n--- hard kill: does Windows release the key for us? (it must not) ---");
	const childFile = path.join(os.tmpdir(), `bhk-child-${process.pid}.mts`);
	fs.writeFileSync(childFile, CHILD_SOURCE);

	// SIGKILL on timeout is the point: it gives the child no chance to clean up,
	// exactly like Task Manager ending the plugin process.
	const child = spawnSync(process.execPath, ["--import", "tsx", "--no-warnings", childFile], {
		timeout: 4000,
		killSignal: "SIGKILL",
		encoding: "utf8"
	});
	fs.rmSync(childFile, { force: true });

	if (!child.stdout?.includes("held")) {
		console.log(`  SETUP FAIL  child never reported holding. stderr:\n${child.stderr}`);
		failures++;
		return;
	}

	await sleep(200);
	// This is the assertion the entire journal exists to justify.
	check("shift STILL down after child was SIGKILLed", isDown(VK_LSHIFT), true);
	check("journal survived the kill", fs.existsSync(JOURNAL), true);

	console.log("\n--- recover() repairs what no handler could ---");
	const released = recover();
	await sleep(150);
	check("recover() reported 1 stale key", released, 1);
	check("shift is up again", isDown(VK_LSHIFT), false);
	check("journal cleaned up", fs.existsSync(JOURNAL), false);

	console.log("\n--- recover() on a clean start is a no-op ---");
	check("recover() with no journal returns 0", recover(), 0);
}

main()
	.catch((e) => {
		console.error("T5 threw:", e);
		failures++;
	})
	.finally(async () => {
		// Never leave the machine with Shift stuck, whatever happened above.
		try {
			sendInputs([keyEvent(VK_LSHIFT, false)]);
		} catch {
			/* ignore */
		}
		fs.rmSync(JOURNAL, { force: true });
		await sleep(50);
		if (isDown(VK_LSHIFT)) console.log("\n  WARNING: shift still down after cleanup!");
		console.log(failures === 0 ? "\nT5 PASSED -- all checks green.\n" : `\nT5 FAILED -- ${failures} check(s) red.\n`);
		process.exit(failures === 0 ? 0 : 1);
	});
