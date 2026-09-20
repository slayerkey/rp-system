import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const koffi = require("koffi");

/**
 * macOS input via CoreGraphics/Quartz, reached through koffi -- the same "no C++ addon"
 * approach as the Windows layer, just against a different native library.
 *
 * Mirrors the exported surface of ../win32/input, so ../input can pick whichever platform
 * module matches process.platform and the actions never know the difference.
 *
 * This file loads its native libraries at module scope, exactly like win32/input.ts does
 * with user32.dll. That is only safe because it is reached exclusively through a dynamic
 * import in ../input -- merely importing it on Windows (or vice versa) would throw
 * immediately, since neither OS's native libraries exist on the other.
 */

const CG = koffi.load("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics");
const CF = koffi.load("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation");
const AX = koffi.load("/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices");

const CGPoint = koffi.struct("CGPoint", { x: "double", y: "double" });
const CGSize = koffi.struct("CGSize", { width: "double", height: "double" });
const CGRect = koffi.struct("CGRect", { origin: CGPoint, size: CGSize });

const CGEventCreate = CG.func("void *CGEventCreate(void *source)");
const CGEventGetLocation = CG.func("CGPoint CGEventGetLocation(void *event)");
const CGEventCreateKeyboardEvent = CG.func("void *CGEventCreateKeyboardEvent(void *source, uint16_t virtualKey, bool keyDown)");
const CGEventPost = CG.func("void CGEventPost(uint32_t tap, void *event)");
const CGEventCreateMouseEvent = CG.func(
	"void *CGEventCreateMouseEvent(void *source, uint32_t mouseType, CGPoint mouseCursorPosition, uint32_t mouseButton)"
);
// The ...2 form, fixed arity, because the original CGEventCreateScrollWheelEvent is
// variadic only from wheel2 onwards -- wheel1 is a NAMED parameter. Declaring wheel1 as
// variadic put it on the stack on Apple Silicon while CoreGraphics read it out of a
// register, so the scroll amount was whatever happened to be in that register: always
// positive, which is why an M1 could scroll up but never down. Intel Macs pass fixed and
// variadic integers in the same registers, so the same build behaved correctly there.
// Available since macOS 10.13, well below this plugin's macOS 11 floor.
const CGEventCreateScrollWheelEvent2 = CG.func(
	"void *CGEventCreateScrollWheelEvent2(void *source, uint32_t units, uint32_t wheelCount, int32_t wheel1, int32_t wheel2, int32_t wheel3)"
);
const CGGetActiveDisplayList = CG.func("int32_t CGGetActiveDisplayList(uint32_t maxDisplays, void *activeDisplays, _Out_ uint32_t *displayCount)");
const CGDisplayBounds = CG.func("CGRect CGDisplayBounds(uint32_t display)");
const CGMainDisplayID = CG.func("uint32_t CGMainDisplayID()");
const CFRelease = CF.func("void CFRelease(void *cf)");
const AXIsProcessTrusted = AX.func("bool AXIsProcessTrusted()");

const kCGHIDEventTap = 0;
const kCGEventMouseMoved = 5;
const kCGScrollEventUnitLine = 1;

const CG_MOUSE_EVENT_TYPE = {
	left: { down: 1, up: 2 }, // kCGEventLeftMouseDown / kCGEventLeftMouseUp
	right: { down: 3, up: 4 }, // kCGEventRightMouseDown / kCGEventRightMouseUp
	middle: { down: 25, up: 26 } // kCGEventOtherMouseDown / kCGEventOtherMouseUp
} as const;
const CG_MOUSE_BUTTON = { left: 0, right: 1, middle: 2 } as const; // CGMouseButton

export type MouseButton = "left" | "right" | "middle";

/**
 * Windows-only concept (how a key is put on the wire). Accepted for signature parity with
 * the Windows layer and ignored here -- the incoming `vk` is already a macOS kVK code, sent
 * straight to CGEventCreateKeyboardEvent.
 */
export type InputMode = "scancode" | "both" | "vk";

export type Rect = { x: number; y: number; width: number; height: number };

/** Which way the wheel turns. "vertical" is the ordinary wheel, "horizontal" the tilt. */
export type WheelAxis = "vertical" | "horizontal";

type DarwinEvent =
	| { kind: "key"; vk: number; down: boolean }
	| { kind: "mouseButton"; button: MouseButton; down: boolean }
	| { kind: "mouseMove"; x: number; y: number }
	| { kind: "mouseWheel"; notches: number; axis: WheelAxis };

/** Builds a key press or release. `mode` exists only for parity with the Windows signature. */
export function keyEvent(vk: number, down: boolean, _mode: InputMode = "scancode"): unknown {
	const event: DarwinEvent = { kind: "key", vk, down };
	return event;
}

export function mouseButtonEvent(button: MouseButton, down: boolean): unknown {
	const event: DarwinEvent = { kind: "mouseButton", button, down };
	return event;
}

/** Moves the cursor to an absolute point. CoreGraphics coordinates are already pixels. */
export function mouseMoveTo(x: number, y: number): unknown {
	const event: DarwinEvent = { kind: "mouseMove", x, y };
	return event;
}

/** Moves the cursor by a delta. Resolved to an absolute point now, since CoreGraphics has
 * no pure "relative move" event -- every mouse event carries an absolute position. */
export function mouseMoveBy(dx: number, dy: number): unknown {
	const { x, y } = cursorPos();
	const event: DarwinEvent = { kind: "mouseMove", x: x + dx, y: y + dy };
	return event;
}

/** Wheel notches; positive scrolls up/away from the user, matching the Windows layer. */
export function mouseWheel(notches: number, axis: WheelAxis = "vertical"): unknown {
	const event: DarwinEvent = { kind: "mouseWheel", notches, axis };
	return event;
}

/**
 * Windows-only. CoreGraphics posts to the system or a process, not to a chosen window, so
 * there is no honest equivalent here. Returning false makes the caller fall back to an
 * ordinary wheel event, which is the existing behaviour on this platform.
 */
export function wheelToActiveWindow(_notches: number, _axis: WheelAxis = "vertical"): boolean {
	return false;
}

/**
 * Posts each event via CGEventPost, back to back with nothing awaited in between -- Node is
 * single-threaded, so nothing else can run between iterations. That is the same practical
 * atomicity guarantee a single Windows SendInput batch gives, even though CoreGraphics has
 * no batched post call of its own.
 */
export function sendInputs(events: unknown[]): number {
	if (events.length === 0) return 0;

	if (!AXIsProcessTrusted()) {
		throw new Error(
			"Accessibility permission not granted. Open System Settings > Privacy & Security > " +
				"Accessibility, enable Stream Deck, then try again."
		);
	}

	for (const raw of events) {
		const ev = raw as DarwinEvent;
		let cgEvent: unknown = null;

		switch (ev.kind) {
			case "key":
				cgEvent = CGEventCreateKeyboardEvent(null, ev.vk, ev.down);
				break;
			case "mouseButton": {
				const pos = cursorPos();
				const type = CG_MOUSE_EVENT_TYPE[ev.button][ev.down ? "down" : "up"];
				cgEvent = CGEventCreateMouseEvent(null, type, pos, CG_MOUSE_BUTTON[ev.button]);
				break;
			}
			case "mouseMove":
				cgEvent = CGEventCreateMouseEvent(null, kCGEventMouseMoved, { x: ev.x, y: ev.y }, CG_MOUSE_BUTTON.left);
				break;
			case "mouseWheel": {
				// Two axes means passing both wheels: CoreGraphics orders them vertical first,
				// horizontal second. The horizontal sign is flipped so that positive means
				// "scroll right" on both platforms, as CoreGraphics counts it the other way.
				const notches = Math.round(ev.notches);
				const horizontal = ev.axis === "horizontal";
				cgEvent = CGEventCreateScrollWheelEvent2(
					null,
					kCGScrollEventUnitLine,
					horizontal ? 2 : 1,
					horizontal ? 0 : notches,
					horizontal ? -notches : 0,
					0
				);
				break;
			}
		}

		if (cgEvent) {
			CGEventPost(kCGHIDEventTap, cgEvent);
			CFRelease(cgEvent);
		}
	}

	return events.length;
}

/** Where the cursor is right now, in screen pixels. */
export function cursorPos(): { x: number; y: number } {
	const ev = CGEventCreate(null);
	if (!ev) throw new Error("CGEventCreate failed while reading the cursor position.");
	const pt = CGEventGetLocation(ev);
	CFRelease(ev);
	return { x: Math.round(pt.x), y: Math.round(pt.y) };
}

const MAX_DISPLAYS = 16;

/** Each display's pixel rectangle, primary first. Mirrors win32/input.ts's monitors(). */
export function monitors(): (Rect & { primary: boolean })[] {
	const ids = Buffer.alloc(MAX_DISPLAYS * 4);
	const count = [0];
	const status = CGGetActiveDisplayList(MAX_DISPLAYS, ids, count);
	if (status !== 0) return [];

	const primaryId = CGMainDisplayID();
	const found: (Rect & { primary: boolean })[] = [];
	for (let i = 0; i < count[0]; i++) {
		const id = ids.readUInt32LE(i * 4);
		const bounds = CGDisplayBounds(id) as { origin: { x: number; y: number }; size: { width: number; height: number } };
		found.push({
			x: Math.round(bounds.origin.x),
			y: Math.round(bounds.origin.y),
			width: Math.round(bounds.size.width),
			height: Math.round(bounds.size.height),
			primary: id === primaryId
		});
	}

	found.sort((a, b) => Number(b.primary) - Number(a.primary));
	return found;
}

/** The bounding box of every display combined. Can start negative on multi-monitor. */
export function virtualScreen(): Rect {
	const all = monitors();
	if (all.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

	const left = Math.min(...all.map((m) => m.x));
	const top = Math.min(...all.map((m) => m.y));
	const right = Math.max(...all.map((m) => m.x + m.width));
	const bottom = Math.max(...all.map((m) => m.y + m.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Percentage of a rectangle -> absolute pixel point. Same maths as the Windows layer. */
export function pctToPixels(xPct: number, yPct: number, area: Rect): { x: number; y: number } {
	return {
		x: Math.round(area.x + (area.width - 1) * (xPct / 100)),
		y: Math.round(area.y + (area.height - 1) * (yPct / 100))
	};
}

/** Diagnostic size, used the same way win32/input.ts uses sizeof(INPUT) in log lines. */
export function inputSize(): number {
	return koffi.sizeof(CGPoint);
}

/** Fails fast if CoreGraphics event creation doesn't work, rather than silently no-opping. */
export function assertLayout(): void {
	const ev = CGEventCreate(null);
	if (!ev) throw new Error("CoreGraphics failed to create a test event -- the native input layer is not usable.");
	CFRelease(ev);
}

/**
 * True once the user has granted Stream Deck Accessibility access. macOS does not
 * automatically prompt for this on a raw CGEventPost the way it does for some other APIs,
 * so sendInputs() checks this itself and throws a clear error when it's missing -- which
 * every action already turns into a showAlert() via its existing catch block.
 */
export async function ensureAccessibilityPermission(): Promise<boolean> {
	return AXIsProcessTrusted();
}
