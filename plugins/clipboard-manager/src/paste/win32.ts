import { createRequire } from "node:module";

/**
 * Windows keystroke injection, trimmed from free/better-hotkeys-mouse/src/win32/input.ts to
 * the key-event path only. This plugin sends exactly one chord (Ctrl+V), so the mouse and
 * monitor halves of that file are left behind rather than carried along unused.
 *
 * Copied rather than shared, following the precedent better-hotkeys-pro already set: each
 * plugin owns its own copy under its own UUID.
 */

const require = createRequire(import.meta.url);
const koffi = require("koffi");

const user32 = koffi.load("user32.dll");

const INPUT_KEYBOARD = 1;
const KEYEVENTF_EXTENDEDKEY = 0x0001;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_SCANCODE = 0x0008;
const MAPVK_VK_TO_VSC_EX = 4;

/** Tags our own synthetic events so later hooks can tell them apart from real input. */
const EXTRA_INFO = 0x52415450; // "RATP"

const MOUSEINPUT = koffi.struct("MOUSEINPUT", {
	dx: "long",
	dy: "long",
	mouseData: "uint32_t",
	dwFlags: "uint32_t",
	time: "uint32_t",
	dwExtraInfo: "uintptr_t"
});

const KEYBDINPUT = koffi.struct("KEYBDINPUT", {
	wVk: "uint16_t",
	wScan: "uint16_t",
	dwFlags: "uint32_t",
	time: "uint32_t",
	dwExtraInfo: "uintptr_t"
});

const HARDWAREINPUT = koffi.struct("HARDWAREINPUT", {
	uMsg: "uint32_t",
	wParamL: "uint16_t",
	wParamH: "uint16_t"
});

// The union members are unused here but must stay in the struct: SendInput reads a fixed
// 40-byte record and a shorter definition would misalign every field after the first.
const INPUT = koffi.struct("INPUT", {
	type: "uint32_t",
	u: koffi.union({ mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT })
});

const SendInput = user32.func("unsigned int __stdcall SendInput(unsigned int cInputs, INPUT *pInputs, int cbSize)");
const MapVirtualKeyExW = user32.func(
	"unsigned int __stdcall MapVirtualKeyExW(unsigned int uCode, unsigned int uMapType, void *dwhkl)"
);
const GetKeyboardLayout = user32.func("void * __stdcall GetKeyboardLayout(unsigned long idThread)");

const hkl = GetKeyboardLayout(0);

/** Resolves a virtual-key code to its hardware scancode and extended-key flag. */
function scanFor(vk: number): { sc: number; ext: boolean } {
	const raw = MapVirtualKeyExW(vk, MAPVK_VK_TO_VSC_EX, hkl);
	const hi = (raw >> 8) & 0xff;
	return { sc: raw & 0xff, ext: hi === 0xe0 || hi === 0xe1 };
}

/**
 * Builds a single INPUT record for a key press or release, on the wire as a hardware
 * scancode. DirectInput and RawInput read scancodes directly, and Windows regenerates the
 * virtual key from the scancode, so ordinary message-loop apps see it too.
 */
export function keyEvent(vk: number, down: boolean): unknown {
	const { sc, ext } = scanFor(vk);
	let wVk = 0;
	let wScan = 0;
	let flags = down ? 0 : KEYEVENTF_KEYUP;

	if (sc === 0) {
		// The layout has no scancode for this VK; the virtual key is all we have.
		wVk = vk;
	} else {
		wScan = sc;
		flags |= KEYEVENTF_SCANCODE;
		if (ext) flags |= KEYEVENTF_EXTENDEDKEY;
	}

	return {
		type: INPUT_KEYBOARD,
		u: { ki: { wVk, wScan, dwFlags: flags, time: 0, dwExtraInfo: EXTRA_INFO } }
	};
}

/**
 * Sends INPUT records as one atomic batch, so nothing can be injected between them.
 * Throws if Windows accepted fewer than we sent -- usually UIPI blocking us from an
 * elevated foreground window.
 */
export function sendInputs(events: unknown[]): number {
	if (events.length === 0) return 0;
	const sent = SendInput(events.length, events, koffi.sizeof(INPUT));
	if (sent !== events.length) {
		throw new Error(
			`SendInput accepted ${sent}/${events.length} events. If the foreground window is elevated, ` +
				`Stream Deck must run elevated too.`
		);
	}
	return sent;
}

/** Size of the marshalled INPUT struct. 40 on x64; useful in support logs. */
export function inputSize(): number {
	return koffi.sizeof(INPUT);
}

/** Fails fast if the struct layout is wrong, rather than corrupting the input stream. */
export function assertLayout(): void {
	const size = inputSize();
	if (size !== 40) {
		throw new Error(`INPUT is ${size} bytes, expected 40 on x64. Struct definition is wrong.`);
	}
}

/** No-op on Windows -- only macOS requires Accessibility permission for synthetic input. */
export async function ensureAccessibilityPermission(): Promise<boolean> {
	return true;
}
