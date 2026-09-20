import type { InputMode, MouseButton, Rect } from "./win32/input";

export type { InputMode, MouseButton, Rect } from "./win32/input";

/**
 * Platform-neutral entry point for native key/mouse input. Actions and shared modules
 * import from here, never from ./win32/input or ./darwin/input directly.
 *
 * Both platform modules load their OS's native library at module scope (user32.dll on
 * Windows, CoreGraphics on macOS), which would throw immediately if merely imported on
 * the wrong OS. So the matching module is chosen with a dynamic import -- rollup is
 * configured with inlineDynamicImports so this still ships as one file, but the unused
 * platform's module body is never evaluated, only the one process.platform actually
 * selects.
 */
interface NativeInputApi {
	keyEvent(vk: number, down: boolean, mode?: InputMode): unknown;
	sendInputs(events: unknown[]): number;
	cursorPos(): { x: number; y: number };
	virtualScreen(): Rect;
	monitors(): (Rect & { primary: boolean })[];
	pctToPixels(xPct: number, yPct: number, area: Rect): { x: number; y: number };
	mouseMoveTo(x: number, y: number): unknown;
	mouseMoveBy(dx: number, dy: number): unknown;
	mouseButtonEvent(button: MouseButton, down: boolean): unknown;
	mouseWheel(notches: number): unknown;
	inputSize(): number;
	assertLayout(): void;
	ensureAccessibilityPermission(): Promise<boolean>;
}

const impl: NativeInputApi = process.platform === "darwin" ? await import("./darwin/input") : await import("./win32/input");

export const keyEvent = impl.keyEvent;
export const sendInputs = impl.sendInputs;
export const cursorPos = impl.cursorPos;
export const virtualScreen = impl.virtualScreen;
export const monitors = impl.monitors;
export const pctToPixels = impl.pctToPixels;
export const mouseMoveTo = impl.mouseMoveTo;
export const mouseMoveBy = impl.mouseMoveBy;
export const mouseButtonEvent = impl.mouseButtonEvent;
export const mouseWheel = impl.mouseWheel;
export const inputSize = impl.inputSize;
export const assertLayout = impl.assertLayout;
export const ensureAccessibilityPermission = impl.ensureAccessibilityPermission;
