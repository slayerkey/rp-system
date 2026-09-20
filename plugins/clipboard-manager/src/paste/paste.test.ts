/**
 * Proves the paste chord actually reaches a real application. Run with: npm run test:paste
 *
 * The unit tests cover the clipboard and the key faces, but nothing there can tell whether
 * Ctrl+V lands where the user is typing. So this puts a real Win32 text box on screen, pastes
 * into it, and reads back what arrived.
 *
 * The target is a throwaway window this test creates itself rather than a real editor:
 * injected keystrokes go to whatever has focus, and a text editor may restore the user's own
 * unsaved work into the window being typed into. Nothing here touches anything the user has
 * open, and the test refuses to send a keystroke until it can see its own window in front.
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { read, write } from "../clipboard/win32";
import { sendPasteChord } from "./input";

const require = createRequire(import.meta.url);
const koffi = require("koffi");
const user32 = koffi.load("user32.dll");
const GetForegroundWindow = user32.func("void * __stdcall GetForegroundWindow()");
const GetWindowTextA = user32.func("int __stdcall GetWindowTextA(void *hWnd, _Out_ char *out, int max)");
const FindWindowA = user32.func("void * __stdcall FindWindowA(const char *cls, const char *title)");
const SetForegroundWindow = user32.func("bool __stdcall SetForegroundWindow(void *hWnd)");
const ShowWindow = user32.func("bool __stdcall ShowWindow(void *hWnd, int nCmdShow)");

const GetWindowThreadProcessId = user32.func("uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, void *pid)");
const AttachThreadInput = user32.func("bool __stdcall AttachThreadInput(uint32_t attach, uint32_t attachTo, bool fAttach)");
const kernel32 = koffi.load("kernel32.dll");
const GetCurrentThreadId = kernel32.func("uint32_t __stdcall GetCurrentThreadId()");

const SW_RESTORE = 9;

/**
 * Windows refuses to let a process take the foreground away from whatever the user was last
 * typing in, so a plain SetForegroundWindow on a freshly spawned window is ignored. Briefly
 * sharing an input queue with the current foreground thread is what grants the right.
 */
function pullToFront(hwnd: unknown): void {
	const ours = GetCurrentThreadId();
	const theirs = GetWindowThreadProcessId(GetForegroundWindow(), null);
	AttachThreadInput(ours, theirs, true);
	try {
		ShowWindow(hwnd, SW_RESTORE);
		SetForegroundWindow(hwnd);
	} finally {
		AttachThreadInput(ours, theirs, false);
	}
}

const TITLE = "PackratPasteProbe";
const outFile = path.join(os.tmpdir(), `packrat-paste-${process.pid}.txt`);

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
	const ok = actual === expected;
	if (!ok) failures++;
	console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function foregroundTitle(): string {
	const buf = Buffer.alloc(512);
	const len = GetWindowTextA(GetForegroundWindow(), buf, buf.length);
	return len > 0 ? buf.toString("utf-8", 0, len) : "";
}

/** A bare WinForms text box: a genuine Win32 edit control, and nothing else. */
const FORM = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object Windows.Forms.Form
$f.Text = '${TITLE}'
$f.TopMost = $true
$t = New-Object Windows.Forms.TextBox
$t.Multiline = $true
$t.Dock = 'Fill'
$f.Controls.Add($t)
$timer = New-Object Windows.Forms.Timer
$timer.Interval = 8000
$timer.Add_Tick({ [IO.File]::WriteAllText('${outFile.replace(/\\/g, "\\\\")}', $t.Text); $f.Close() })
$timer.Start()
$f.Add_Shown({ $f.Activate(); $t.Focus() })
[Windows.Forms.Application]::Run($f)
`;

const original = await read();
const form = spawn("powershell.exe", ["-NoProfile", "-STA", "-Command", FORM], { detached: true, stdio: "ignore" });

try {
	console.log("Paste chord against a real text box");

	let title = "";
	for (let attempt = 0; attempt < 40 && title !== TITLE; attempt++) {
		await sleep(250);
		const hwnd = FindWindowA(null, TITLE);
		if (hwnd) pullToFront(hwnd);
		title = foregroundTitle();
	}
	if (title !== TITLE) {
		console.log(`  SKIP  the probe window never took focus (front window is "${title}"). Refusing to inject keys.`);
		process.exit(0);
	}

	const sample = "packrat paste probe 12345";
	await write(sample);
	check("the sample is on the clipboard", await read(), sample);

	sendPasteChord();
	await sleep(500);

	// Multi-line, to prove a paste is not silently cut at the first newline.
	const multi = "first line\r\nsecond line";
	await write(multi);
	sendPasteChord();

	for (let attempt = 0; attempt < 60 && !fs.existsSync(outFile); attempt++) await sleep(250);
	check("the text box received both pastes", fs.readFileSync(outFile, "utf-8").replace(/\r\n/g, "\n"), `${sample}first line\nsecond line`);
} finally {
	try {
		execFileSync("taskkill", ["/PID", String(form.pid), "/T", "/F"], { stdio: "ignore" });
	} catch {
		// Already closed itself.
	}
	fs.rmSync(outFile, { force: true });
	if (original !== null) await write(original);
}

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
