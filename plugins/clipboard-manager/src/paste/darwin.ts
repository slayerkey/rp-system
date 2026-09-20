import { createRequire } from "node:module";

/**
 * macOS keystroke injection via CoreGraphics, trimmed from
 * free/better-hotkeys-mouse/src/darwin/input.ts to the key-event path only.
 *
 * Mirrors the exported surface of ./win32, so ./input can pick whichever platform module
 * matches process.platform and the action never knows the difference.
 *
 * This file loads its native libraries at module scope, exactly like win32.ts does with
 * user32.dll. That is only safe because it is reached exclusively through a dynamic import
 * in ./input -- merely importing it on Windows would throw immediately.
 */

const require = createRequire(import.meta.url);
const koffi = require("koffi");

const CG = koffi.load("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics");
const CF = koffi.load("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation");
const AX = koffi.load("/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices");

const CGPoint = koffi.struct("CGPoint", { x: "double", y: "double" });

const CGEventCreate = CG.func("void *CGEventCreate(void *source)");
const CGEventCreateKeyboardEvent = CG.func("void *CGEventCreateKeyboardEvent(void *source, uint16_t virtualKey, bool keyDown)");
const CGEventPost = CG.func("void CGEventPost(uint32_t tap, void *event)");
const CFRelease = CF.func("void CFRelease(void *cf)");
const AXIsProcessTrusted = AX.func("bool AXIsProcessTrusted()");

const kCGHIDEventTap = 0;

type KeyEvent = { vk: number; down: boolean };

/** Builds a key press or release. The vk is already a macOS kVK code. */
export function keyEvent(vk: number, down: boolean): unknown {
	const event: KeyEvent = { vk, down };
	return event;
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
		const ev = raw as KeyEvent;
		const cgEvent = CGEventCreateKeyboardEvent(null, ev.vk, ev.down);
		if (cgEvent) {
			CGEventPost(kCGHIDEventTap, cgEvent);
			CFRelease(cgEvent);
		}
	}

	return events.length;
}

/** Diagnostic size, used the same way win32.ts uses sizeof(INPUT) in log lines. */
export function inputSize(): number {
	return koffi.sizeof(CGPoint);
}

/** Fails fast if CoreGraphics event creation doesn't work, rather than silently no-opping. */
export function assertLayout(): void {
	const ev = CGEventCreate(null);
	if (!ev) throw new Error("CoreGraphics failed to create a test event, the native input layer is not usable.");
	CFRelease(ev);
}

/**
 * True once the user has granted Stream Deck Accessibility access. macOS does not
 * automatically prompt for this on a raw CGEventPost the way it does for some other APIs,
 * so sendInputs() checks this itself and throws a clear error when it's missing.
 */
export async function ensureAccessibilityPermission(): Promise<boolean> {
	return AXIsProcessTrusted();
}
