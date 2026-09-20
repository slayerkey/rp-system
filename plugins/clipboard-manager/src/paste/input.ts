/**
 * Platform-neutral entry point for the paste keystroke. The slot action imports from here,
 * never from ./win32 or ./darwin directly.
 *
 * Both platform modules load their OS's native library at module scope (user32.dll on
 * Windows, CoreGraphics on macOS), which would throw immediately if merely imported on the
 * wrong OS. So the matching module is chosen with a dynamic import, and rollup keeps each as
 * its own chunk so the unused platform's module body is never evaluated.
 */
interface NativeInputApi {
	keyEvent(vk: number, down: boolean): unknown;
	sendInputs(events: unknown[]): number;
	inputSize(): number;
	assertLayout(): void;
	ensureAccessibilityPermission(): Promise<boolean>;
}

const isMac = process.platform === "darwin";
const impl: NativeInputApi = isMac ? await import("./darwin") : await import("./win32");

export const inputSize = impl.inputSize;
export const assertLayout = impl.assertLayout;
export const ensureAccessibilityPermission = impl.ensureAccessibilityPermission;

// Windows virtual-key codes vs macOS kVK codes. Paste is Ctrl+V on Windows and Cmd+V on
// macOS, so the modifier differs in both meaning and numbering.
const MOD_VK = isMac ? 0x37 : 0xa2; // kVK_Command : VK_LCONTROL
const V_VK = isMac ? 0x09 : 0x56; // kVK_ANSI_V : VK_V

/**
 * Taps the platform's paste chord at whatever window currently has focus.
 *
 * Sent as one batch so nothing can land between the modifier and the key. The catch is a
 * safety net rather than error handling: if the batch throws partway through on Windows,
 * the modifier may already be down, and a stuck Ctrl makes every later keystroke a shortcut.
 */
export function sendPasteChord(): void {
	try {
		impl.sendInputs([impl.keyEvent(MOD_VK, true), impl.keyEvent(V_VK, true), impl.keyEvent(V_VK, false), impl.keyEvent(MOD_VK, false)]);
	} catch (error) {
		try {
			impl.sendInputs([impl.keyEvent(V_VK, false), impl.keyEvent(MOD_VK, false)]);
		} catch {
			// Nothing more to try. The original failure is the one worth reporting.
		}
		throw error;
	}
}
