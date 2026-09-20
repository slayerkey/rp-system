/**
 * T6 -- mouse layer. Run with: npm run test:t6
 *
 * Moves the real cursor, so it puts it back where it found it on the way out.
 * Verifies positions against GetCursorPos rather than trusting the 0..65535 maths.
 *
 * This test shares one cursor with whoever is sitting at the machine. Touching the
 * mouse while it runs will move the pointer out from under an assertion, so each
 * position check retries a few times before calling it a failure. Physically dragging
 * the mouse for the whole run will still fail it, correctly.
 */
import {
	cursorPos,
	mouseButtonEvent,
	mouseMoveBy,
	mouseMoveTo,
	monitors,
	pctToPixels,
	sendInputs,
	toAbsolute,
	virtualScreen
} from "./input";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
	const ok = actual === expected;
	if (!ok) failures++;
	console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, expected ${expected})`}`);
}

/** Absolute positioning is quantised to 1/65536 of the screen, so allow a pixel. */
function near(label: string, actual: number, expected: number, tol = 1): void {
	const ok = Math.abs(actual - expected) <= tol;
	if (!ok) failures++;
	console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, expected ~${expected})`}`);
}

const origin = cursorPos();

/**
 * Moves the cursor and reads back where it landed, retrying if it didn't stick --
 * a human nudging the mouse mid-run shouldn't read as a broken coordinate transform.
 */
async function moveAndRead(want: { x: number; y: number }, attempts = 4): Promise<{ x: number; y: number }> {
	let got = { x: NaN, y: NaN };
	for (let i = 0; i < attempts; i++) {
		sendInputs([mouseMoveTo(want.x, want.y)]);
		await sleep(80);
		got = cursorPos();
		if (Math.abs(got.x - want.x) <= 1 && Math.abs(got.y - want.y) <= 1) return got;
	}
	return got;
}

async function main(): Promise<void> {
	console.log("\n--- display geometry ---");
	const vs = virtualScreen();
	console.log(`  INFO  virtual screen: ${vs.width}x${vs.height} at (${vs.x}, ${vs.y})`);
	const mons = monitors();
	console.log(`  INFO  ${mons.length} monitor(s):`);
	for (const m of mons) {
		console.log(`          ${m.width}x${m.height} at (${m.x}, ${m.y})${m.primary ? "  [primary]" : ""}`);
	}
	check("EnumDisplayMonitors returned at least one monitor", mons.length > 0, true);
	check("exactly one monitor is primary", mons.filter((m) => m.primary).length, 1);

	console.log("\n--- coordinate maths (no cursor movement) ---");
	const fake = { x: 0, y: 0, width: 1920, height: 1080 };
	check("(0,0) -> 0,0", JSON.stringify(toAbsolute(0, 0, fake)), JSON.stringify({ dx: 0, dy: 0 }));
	check("bottom-right clamps to 65535", toAbsolute(1919, 1079, fake).dx, 65502);
	// 50% of 0..1919 is 959.5; rounding up to 960 is correct.
	check("50% of 1920 -> pixel 960", pctToPixels(50, 50, fake).x, 960);
	check("100% of 1920 -> pixel 1919 (not 1920)", pctToPixels(100, 100, fake).x, 1919);
	// Negative origins are the multi-monitor case that breaks naive maths.
	const left = { x: -1920, y: 0, width: 3840, height: 1080 };
	check("negative-origin screen: x=-1920 -> dx 0", toAbsolute(-1920, 0, left).dx, 0);
	check("negative-origin screen: x=0 -> dx ~32768", toAbsolute(0, 0, left).dx, 32768);

	console.log("\n--- real cursor moves (verified against GetCursorPos) ---");
	const primary = mons.find((m) => m.primary)!;

	for (const [xPct, yPct] of [
		[50, 50],
		[10, 90],
		[0, 0],
		[100, 100]
	] as const) {
		const want = pctToPixels(xPct, yPct, primary);
		const got = await moveAndRead(want);
		near(`${String(xPct).padStart(3)}%,${String(yPct).padStart(3)}%  -> (${want.x}, ${want.y})`, got.x, want.x);
		near(`                    y`, got.y, want.y);
	}

	console.log("\n--- relative move ---");
	// Anchor first, so a bumped mouse can't make "before" and "after" disagree.
	await moveAndRead(pctToPixels(50, 50, primary));
	const before = cursorPos();
	sendInputs([mouseMoveBy(-40, -30)]);
	await sleep(80);
	const after = cursorPos();
	near("moved -40 in x", after.x, before.x - 40);
	near("moved -30 in y", after.y, before.y - 30);

	console.log("\n--- buttons build without throwing ---");
	// Not actually clicked: a synthetic click lands on whatever window is under the
	// cursor, and this test has no business pressing buttons in someone's editor.
	for (const b of ["left", "right", "middle"] as const) {
		const down = mouseButtonEvent(b, true) as { u: { mi: { dwFlags: number } } };
		const up = mouseButtonEvent(b, false) as { u: { mi: { dwFlags: number } } };
		check(`${b} down/up flags differ`, down.u.mi.dwFlags !== up.u.mi.dwFlags, true);
	}
}

main()
	.catch((e) => {
		console.error("T6 threw:", e);
		failures++;
	})
	.finally(async () => {
		sendInputs([mouseMoveTo(origin.x, origin.y)]);
		await sleep(60);
		console.log(`\n  INFO  cursor restored to (${origin.x}, ${origin.y})`);
		console.log(failures === 0 ? "\nT6 PASSED -- all checks green.\n" : `\nT6 FAILED -- ${failures} check(s) red.\n`);
		process.exit(failures === 0 ? 0 : 1);
	});
