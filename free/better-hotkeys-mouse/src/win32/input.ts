import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const koffi = require("koffi");

const user32 = koffi.load("user32.dll");

const INPUT_MOUSE = 0;
const INPUT_KEYBOARD = 1;
const KEYEVENTF_EXTENDEDKEY = 0x0001;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_SCANCODE = 0x0008;
const MAPVK_VK_TO_VSC_EX = 4;

const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_WHEEL = 0x0800;
const MOUSEEVENTF_VIRTUALDESK = 0x4000;
const MOUSEEVENTF_ABSOLUTE = 0x8000;

const MOUSE_BUTTON_FLAGS = {
	left: { down: 0x0002, up: 0x0004 },
	right: { down: 0x0008, up: 0x0010 },
	middle: { down: 0x0020, up: 0x0040 }
} as const;

export type MouseButton = keyof typeof MOUSE_BUTTON_FLAGS;

/** GetSystemMetrics indices for the virtual screen (all monitors as one rectangle). */
const SM_XVIRTUALSCREEN = 76;
const SM_YVIRTUALSCREEN = 77;
const SM_CXVIRTUALSCREEN = 78;
const SM_CYVIRTUALSCREEN = 79;

/** Tags our own synthetic events so later hooks can tell them apart from real input. */
export const EXTRA_INFO = 0x52415450; // "RATP"

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

export const INPUT = koffi.struct("INPUT", {
	type: "uint32_t",
	u: koffi.union({ mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT })
});

const POINT = koffi.struct("POINT", { x: "long", y: "long" });
const RECT = koffi.struct("RECT", { left: "long", top: "long", right: "long", bottom: "long" });

const MONITORINFO = koffi.struct("MONITORINFO", {
	cbSize: "uint32_t",
	rcMonitor: RECT,
	rcWork: RECT,
	dwFlags: "uint32_t"
});

const SendInput = user32.func("unsigned int __stdcall SendInput(unsigned int cInputs, INPUT *pInputs, int cbSize)");
const MapVirtualKeyExW = user32.func(
	"unsigned int __stdcall MapVirtualKeyExW(unsigned int uCode, unsigned int uMapType, void *dwhkl)"
);
const GetKeyboardLayout = user32.func("void * __stdcall GetKeyboardLayout(unsigned long idThread)");
const GetSystemMetrics = user32.func("int __stdcall GetSystemMetrics(int nIndex)");
const GetCursorPos = user32.func("bool __stdcall GetCursorPos(_Out_ POINT *lpPoint)");
const GetMonitorInfoW = user32.func("bool __stdcall GetMonitorInfoW(void *hMonitor, _Inout_ MONITORINFO *lpmi)");

const MonitorEnumProc = koffi.proto("bool __stdcall MonitorEnumProc(void *hMonitor, void *hdc, RECT *rect, long long lparam)");
const EnumDisplayMonitors = user32.func(
	"bool __stdcall EnumDisplayMonitors(void *hdc, RECT *clip, MonitorEnumProc *callback, long long lparam)"
);

/**
 * Keys that require KEYEVENTF_EXTENDEDKEY (an E0 prefix on the wire).
 *
 * MapVirtualKeyExW is documented to report this in the high byte, but measured
 * against Windows 11 it only does so for 7 of these. It returns a bare 0x004D for
 * VK_RIGHT -- the same scancode as VK_NUMPAD6 -- so without this table the arrow
 * cluster and the nav cluster are indistinguishable from the numpad and would be
 * delivered as digits whenever NumLock is on. The high-byte check is still OR'd in
 * below to cover anything a non-US layout flags that isn't listed here.
 *
 * Deliberately absent: VK_NUMLOCK (sc 0x45, genuinely not extended) and
 * VK_SNAPSHOT (MapVirtualKey returns SysRq 0x54, not the real E0 37).
 */
const EXTENDED_VKS = new Set([
	0x03, // VK_CANCEL (Ctrl+Break)
	0x21, // VK_PRIOR (Page Up)
	0x22, // VK_NEXT (Page Down)
	0x23, // VK_END
	0x24, // VK_HOME
	0x25, // VK_LEFT
	0x26, // VK_UP
	0x27, // VK_RIGHT
	0x28, // VK_DOWN
	0x2d, // VK_INSERT
	0x2e, // VK_DELETE
	0x5b, // VK_LWIN
	0x5c, // VK_RWIN
	0x5d, // VK_APPS
	0x6f, // VK_DIVIDE (numpad /)
	0xa3, // VK_RCONTROL
	0xa5 // VK_RMENU (right Alt / AltGr)
]);

/**
 * How key events are put on the wire.
 * - `scancode` (default): hardware scancode. DirectInput and RawInput read scancodes
 *   directly, so this reaches games that ignore virtual-key-only injection. Windows
 *   regenerates the VK from the scancode, so ordinary message-loop apps see it too.
 * - `vk`: virtual key only. Kept as a fallback and as a diagnostic.
 * - `both`: sets wVk and wScan without KEYEVENTF_SCANCODE. Undocumented territory;
 *   exposed for support escape-hatch use, not recommended.
 */
export type InputMode = "scancode" | "both" | "vk";

const hkl = GetKeyboardLayout(0);

/** Resolves a virtual-key code to its hardware scancode and extended-key flag. */
export function scanFor(vk: number): { sc: number; ext: boolean } {
	const raw = MapVirtualKeyExW(vk, MAPVK_VK_TO_VSC_EX, hkl);
	const hi = (raw >> 8) & 0xff;
	return {
		sc: raw & 0xff,
		ext: EXTENDED_VKS.has(vk) || hi === 0xe0 || hi === 0xe1
	};
}

/** Builds a single INPUT record for a key press or release. */
export function keyEvent(vk: number, down: boolean, mode: InputMode = "scancode"): unknown {
	const { sc, ext } = scanFor(vk);
	let wVk = 0;
	let wScan = 0;
	let flags = down ? 0 : KEYEVENTF_KEYUP;

	if (mode === "vk" || sc === 0) {
		// sc === 0 means the layout has no scancode for this VK; VK is all we have.
		wVk = vk;
	} else if (mode === "both") {
		wVk = vk;
		wScan = sc;
		if (ext) flags |= KEYEVENTF_EXTENDEDKEY;
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

// --- mouse ----------------------------------------------------------------

export type Rect = { x: number; y: number; width: number; height: number };

/** Where the cursor is right now, in virtual-desktop pixels. */
export function cursorPos(): { x: number; y: number } {
	const out = {};
	if (!GetCursorPos(out)) throw new Error("GetCursorPos failed.");
	return { x: (out as { x: number }).x, y: (out as { y: number }).y };
}

/** The bounding box of every monitor combined. Can start negative on multi-monitor. */
export function virtualScreen(): Rect {
	return {
		x: GetSystemMetrics(SM_XVIRTUALSCREEN),
		y: GetSystemMetrics(SM_YVIRTUALSCREEN),
		width: GetSystemMetrics(SM_CXVIRTUALSCREEN),
		height: GetSystemMetrics(SM_CYVIRTUALSCREEN)
	};
}

/** Each monitor's pixel rectangle, primary first. */
export function monitors(): (Rect & { primary: boolean })[] {
	const found: (Rect & { primary: boolean })[] = [];

	type MonitorInfoOut = {
		cbSize: number;
		rcMonitor?: { left: number; top: number; right: number; bottom: number };
		dwFlags?: number;
	};

	const cb = koffi.register((hMonitor: unknown) => {
		// GetMonitorInfoW needs cbSize set on the way in and fills the rest on the way out.
		const info: MonitorInfoOut = { cbSize: koffi.sizeof(MONITORINFO) };
		if (GetMonitorInfoW(hMonitor, info) && info.rcMonitor) {
			const r = info.rcMonitor;
			found.push({
				x: r.left,
				y: r.top,
				width: r.right - r.left,
				height: r.bottom - r.top,
				primary: ((info.dwFlags ?? 0) & 1) === 1 // MONITORINFOF_PRIMARY
			});
		}
		return true; // keep enumerating
	}, koffi.pointer(MonitorEnumProc));

	try {
		EnumDisplayMonitors(null, null, cb, 0);
	} finally {
		koffi.unregister(cb);
	}

	found.sort((a, b) => Number(b.primary) - Number(a.primary));
	return found;
}

/**
 * Converts a pixel point to the 0..65535 space SendInput wants for absolute moves.
 *
 * Windows maps back with `pixel = (value * size) / 65536`, so dividing by `size` here
 * (not `size - 1`) is what actually round-trips. Getting this wrong lands you one pixel
 * short at the right edge, which is invisible until someone aims at a 4K corner.
 *
 * Exported so the coordinate maths can be tested without moving the real cursor.
 */
export function toAbsolute(x: number, y: number, screen: Rect): { dx: number; dy: number } {
	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
	return {
		dx: clamp(Math.round(((x - screen.x) * 65536) / screen.width), 0, 65535),
		dy: clamp(Math.round(((y - screen.y) * 65536) / screen.height), 0, 65535)
	};
}

/** Percentage of a rectangle -> absolute pixel point. */
export function pctToPixels(xPct: number, yPct: number, area: Rect): { x: number; y: number } {
	return {
		x: Math.round(area.x + (area.width - 1) * (xPct / 100)),
		y: Math.round(area.y + (area.height - 1) * (yPct / 100))
	};
}

function mouseInput(dx: number, dy: number, flags: number, mouseData = 0): unknown {
	return {
		type: INPUT_MOUSE,
		u: { mi: { dx, dy, mouseData, dwFlags: flags, time: 0, dwExtraInfo: EXTRA_INFO } }
	};
}

/** Moves the cursor to an absolute pixel point anywhere on the virtual desktop. */
export function mouseMoveTo(x: number, y: number): unknown {
	const { dx, dy } = toAbsolute(x, y, virtualScreen());
	return mouseInput(dx, dy, MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK);
}

/** Moves the cursor by a pixel delta from wherever it is. */
export function mouseMoveBy(dx: number, dy: number): unknown {
	return mouseInput(Math.round(dx), Math.round(dy), MOUSEEVENTF_MOVE);
}

export function mouseButtonEvent(button: MouseButton, down: boolean): unknown {
	const flags = MOUSE_BUTTON_FLAGS[button];
	return mouseInput(0, 0, down ? flags.down : flags.up);
}

/** Wheel notches; positive scrolls up/away from the user. */
export function mouseWheel(notches: number): unknown {
	return mouseInput(0, 0, MOUSEEVENTF_WHEEL, Math.round(notches * 120)); // WHEEL_DELTA
}

// --- diagnostics ----------------------------------------------------------

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
