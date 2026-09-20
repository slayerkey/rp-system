/**
 * Platform-neutral clipboard access. The watcher and the slot action import from here, never
 * from ./win32 or ./darwin directly.
 *
 * ./win32 loads user32.dll at module scope and would throw the moment it was imported on a
 * Mac, so the matching module is chosen with a dynamic import and rollup keeps each as its
 * own lazily evaluated chunk.
 */
interface ClipboardApi {
	read(): Promise<string | null>;
	write(text: string): Promise<boolean>;
	/** A counter that changes on every clipboard change, or null where the OS has none. */
	sequenceNumber(): number | null;
}

const impl: ClipboardApi = process.platform === "darwin" ? await import("./darwin") : await import("./win32");

export const read = impl.read;
export const write = impl.write;
export const sequenceNumber = impl.sequenceNumber;
