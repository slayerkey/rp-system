import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * macOS clipboard access through pbpaste and pbcopy, the two clipboard tools that ship with
 * every macOS install.
 *
 * NSPasteboard has no plain C entry point, so reaching it the way the paste layer reaches
 * CoreGraphics would mean binding objc_msgSend and building NSString objects by hand. These
 * two commands do the same job with none of that surface.
 */

const run = promisify(execFile);

/** Clipboard text longer than this is not something a four-key preview is for. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * The clipboard's text, or null when it holds something else.
 *
 * `-Prefer txt` makes pbpaste fail rather than invent a representation, so images and copied
 * files exit non-zero and land in the catch. That is the whole non-text guard, and it mirrors
 * what IsClipboardFormatAvailable does on Windows.
 */
export async function read(): Promise<string | null> {
	try {
		const { stdout } = await run("pbpaste", ["-Prefer", "txt"], { encoding: "utf8", maxBuffer: MAX_BYTES });
		return stdout.length > 0 ? stdout : null;
	} catch {
		return null;
	}
}

/** Replaces the clipboard's contents with text. */
export function write(text: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		const child = execFile("pbcopy", (error) => (error ? reject(error) : resolve(true)));
		// Streamed rather than passed as an argument: clipboard text can be far longer than
		// the argument limit, and stdin needs no escaping.
		child.stdin?.end(text, "utf8");
	});
}

/**
 * macOS publishes no clipboard sequence number, so the watcher has to compare content
 * instead. Returning null is how it learns that.
 */
export function sequenceNumber(): number | null {
	return null;
}
