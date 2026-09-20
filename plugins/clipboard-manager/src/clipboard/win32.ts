import { createRequire } from "node:module";

/**
 * Windows clipboard access through koffi, the same no-C++-addon approach the paste layer
 * uses for user32's SendInput.
 *
 * Change detection is GetClipboardSequenceNumber rather than AddClipboardFormatListener:
 * the listener API needs a message-only window and a running message pump, neither of which
 * a Stream Deck plugin has, while the sequence number is one cheap call that answers the
 * only question the watcher asks.
 */

const require = createRequire(import.meta.url);
const koffi = require("koffi");

const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");

const CF_UNICODETEXT = 13;
const GMEM_MOVEABLE = 0x0002;

const GetClipboardSequenceNumber = user32.func("uint32_t __stdcall GetClipboardSequenceNumber()");
const OpenClipboard = user32.func("bool __stdcall OpenClipboard(void *hWndNewOwner)");
const CloseClipboard = user32.func("bool __stdcall CloseClipboard()");
const EmptyClipboard = user32.func("bool __stdcall EmptyClipboard()");
const GetClipboardData = user32.func("void * __stdcall GetClipboardData(uint32_t uFormat)");
const SetClipboardData = user32.func("void * __stdcall SetClipboardData(uint32_t uFormat, void *hMem)");
const IsClipboardFormatAvailable = user32.func("bool __stdcall IsClipboardFormatAvailable(uint32_t format)");

const GlobalAlloc = kernel32.func("void * __stdcall GlobalAlloc(uint32_t uFlags, size_t dwBytes)");
const GlobalLock = kernel32.func("void * __stdcall GlobalLock(void *hMem)");
const GlobalUnlock = kernel32.func("bool __stdcall GlobalUnlock(void *hMem)");
const GlobalSize = kernel32.func("size_t __stdcall GlobalSize(void *hMem)");
const GlobalFree = kernel32.func("void * __stdcall GlobalFree(void *hMem)");

/**
 * Only one process may hold the clipboard open at a time, so a contended open is normal
 * rather than exceptional: any app the user just copied from may still be closing its own
 * handle. Retry briefly, then give up and let the caller treat it as a miss.
 */
function withClipboard<T>(fallback: T, body: () => T): T {
	for (let attempt = 0; attempt < 5; attempt++) {
		if (OpenClipboard(null)) {
			try {
				return body();
			} finally {
				CloseClipboard();
			}
		}
		// Busy-wait a fraction of a millisecond. Atomics.wait needs a SharedArrayBuffer and
		// this path has to stay synchronous, since the clipboard must not be left open across
		// an await.
		const until = Date.now() + 2;
		while (Date.now() < until);
	}
	return fallback;
}

/** Bumped by Windows on every clipboard change, including changes made by other apps. */
export function sequenceNumber(): number {
	return GetClipboardSequenceNumber();
}

/**
 * The clipboard's text, or null when it holds something else. Images and copied files carry
 * CF_BITMAP or CF_HDROP and never CF_UNICODETEXT, so this check is the whole non-text guard.
 */
export async function read(): Promise<string | null> {
	if (!IsClipboardFormatAvailable(CF_UNICODETEXT)) return null;

	return withClipboard<string | null>(null, () => {
		const handle = GetClipboardData(CF_UNICODETEXT);
		if (!handle) return null;

		const ptr = GlobalLock(handle);
		if (!ptr) return null;
		try {
			// Capped at the allocation's own size so a buffer missing its terminator cannot
			// walk off the end. Passing a length makes decode read exactly that many
			// characters rather than stopping early, and the block is at least one longer
			// than the text, so cut at the terminator to drop it and any padding after it.
			const chars = Math.floor(Number(GlobalSize(handle)) / 2);
			const value = koffi.decode.string16(ptr, chars).split("\0")[0];
			return value.length > 0 ? value : null;
		} finally {
			GlobalUnlock(handle);
		}
	});
}

/** Replaces the clipboard's contents with text. Returns false if the clipboard stayed busy. */
export async function write(text: string): Promise<boolean> {
	const buf = Buffer.from(`${text}\0`, "utf16le");
	const handle = GlobalAlloc(GMEM_MOVEABLE, buf.length);
	if (!handle) throw new Error("GlobalAlloc failed while preparing clipboard text.");

	const ptr = GlobalLock(handle);
	if (!ptr) {
		GlobalFree(handle);
		throw new Error("GlobalLock failed while preparing clipboard text.");
	}
	Buffer.from(koffi.view(ptr, buf.length)).set(buf);
	GlobalUnlock(handle);

	const stored = withClipboard(false, () => {
		EmptyClipboard();
		return SetClipboardData(CF_UNICODETEXT, handle) !== null;
	});

	// Windows takes ownership of the handle on success and frees it itself. On failure it
	// never did, so freeing here is what keeps a busy clipboard from leaking a block per press.
	if (!stored) GlobalFree(handle);
	return stored;
}
