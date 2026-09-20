/**
 * Round-trips the real Windows clipboard. Run with: npm run test:clipboard
 *
 * This is the one part of the plugin that talks to koffi-bound Win32 by hand, so it is worth
 * proving against the actual OS rather than a mock: a wrong struct or a missing GlobalLock
 * shows up here as garbage text, not as a crash.
 *
 * Puts the user's original clipboard back on the way out, however it exits.
 */
import { execFileSync } from "node:child_process";

import { read, sequenceNumber, write } from "./win32";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
	const ok = actual === expected;
	if (!ok) failures++;
	console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`}`);
}

const original = await read();

try {
	console.log("Windows clipboard round trip");

	await write("hello from packrat");
	check("plain ascii survives", await read(), "hello from packrat");

	const unicode = "naïve café 日本語 🐀 emoji";
	await write(unicode);
	check("utf-16 and astral characters survive", await read(), unicode);

	const multiline = "line one\r\nline two\ttabbed";
	await write(multiline);
	check("newlines and tabs survive", await read(), multiline);

	const long = "x".repeat(200_000);
	await write(long);
	check("200k characters survive", (await read())?.length, long.length);

	await write("sequence probe a");
	const first = sequenceNumber();
	await write("sequence probe b");
	check("sequence number moves on a change", sequenceNumber() !== first, true);
	check("sequence number holds still without one", sequenceNumber(), sequenceNumber());

	// A copied screenshot or file must read as "nothing to record" rather than as garbage
	// text, because that is what keeps a picture out of the four text slots.
	execFileSync("powershell.exe", [
		"-NoProfile",
		"-STA",
		"-Command",
		"Add-Type -AssemblyName System.Windows.Forms,System.Drawing; " +
			"$b = New-Object Drawing.Bitmap 32,32; [Windows.Forms.Clipboard]::SetImage($b)"
	]);
	check("a copied image reads as no text", await read(), null);

	execFileSync("powershell.exe", [
		"-NoProfile",
		"-STA",
		"-Command",
		"Add-Type -AssemblyName System.Windows.Forms; " +
			"$c = New-Object Collections.Specialized.StringCollection; $c.Add($env:WINDIR); " +
			"[Windows.Forms.Clipboard]::SetFileDropList($c)"
	]);
	check("a copied file reads as no text", await read(), null);
} finally {
	if (original !== null) await write(original);
}

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
