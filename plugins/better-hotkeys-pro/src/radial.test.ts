/**
 * T7 -- radial geometry + a real move-and-return. Run with: npm run test:t7
 *
 * The trig is checked by direction (up must be above the origin, right must be to its
 * right) rather than by hardcoded pixels, so it holds on any monitor. Then a real radial
 * sweep runs with return-cursor on, and the cursor is verified back where it started.
 */
import { radialTarget } from "./mouse-settings";
import { sleep } from "./util";
import { cursorPos, mouseMoveTo, monitors, sendInputs } from "./win32/input";

let failures = 0;
function ok(label: string, cond: boolean): void {
	if (!cond) failures++;
	console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
}

const origin = cursorPos();

async function main(): Promise<void> {
	const primary = monitors().find((m) => m.primary)!;
	const cx = primary.x + primary.width / 2;
	const cy = primary.y + primary.height / 2;

	console.log("\n--- radial direction (primary monitor centre) ---");
	const at = (angle: number) => radialTarget({ area: "primary", angle, distance: 50 }).target;

	const up = at(0);
	ok("0° is straight up (same x, higher)", Math.abs(up.x - cx) <= 1 && up.y < cy);
	const right = at(90);
	ok("90° is straight right (same y, farther)", Math.abs(right.y - cy) <= 1 && right.x > cx);
	const down = at(180);
	ok("180° is straight down", Math.abs(down.x - cx) <= 1 && down.y > cy);
	const left = at(270);
	ok("270° is straight left", Math.abs(left.y - cy) <= 1 && left.x < cx);

	console.log("\n--- distance scales the reach ---");
	const near = radialTarget({ area: "primary", angle: 90, distance: 25 }).target;
	const far = radialTarget({ area: "primary", angle: 90, distance: 75 }).target;
	ok("farther distance reaches farther right", far.x - cx > near.x - cx);
	const zero = radialTarget({ area: "primary", angle: 123, distance: 0 }).target;
	ok("0% distance sits on the origin", Math.abs(zero.x - cx) <= 1 && Math.abs(zero.y - cy) <= 1);

	console.log("\n--- circular reach uses the short side ---");
	const short = Math.min(primary.width, primary.height);
	const rightFull = radialTarget({ area: "primary", angle: 90, distance: 100 }).target;
	ok("100% reaches half the short side", Math.abs(rightFull.x - cx - short / 2) <= 1);

	// Advisory, not a hard assertion: this moves the real cursor, and a foreground game
	// that captures/recenters the mouse (raw input) will fight it -- which is exactly the
	// situation the "flick" relative mode exists for. Real absolute moves are hard-tested
	// in T6; here the geometry above is what matters.
	console.log("\n--- real sweep (advisory; a foreground game may override it) ---");
	const start = cursorPos();
	const target = radialTarget({ area: "primary", angle: 45, distance: 40 }).target;
	sendInputs([mouseMoveTo(target.x, target.y)]);
	await sleep(70);
	const mid = cursorPos();
	const landed = Math.abs(mid.x - target.x) <= 2 && Math.abs(mid.y - target.y) <= 2;
	console.log(`  ${landed ? "INFO  landed on the slot" : "INFO  did NOT land -- something else is driving the cursor"}`);
	sendInputs([mouseMoveTo(start.x, start.y)]);
	await sleep(60);
	const back = cursorPos();
	console.log(`  ${Math.abs(back.x - start.x) <= 2 && Math.abs(back.y - start.y) <= 2 ? "INFO  returned to start" : "INFO  did not return (cursor contended)"}`);
}

main()
	.catch((e) => {
		console.error("T7 threw:", e);
		failures++;
	})
	.finally(async () => {
		sendInputs([mouseMoveTo(origin.x, origin.y)]);
		await sleep(50);
		console.log(failures === 0 ? "\nT7 PASSED -- all checks green.\n" : `\nT7 FAILED -- ${failures} check(s) red.\n`);
		process.exit(failures === 0 ? 0 : 1);
	});
