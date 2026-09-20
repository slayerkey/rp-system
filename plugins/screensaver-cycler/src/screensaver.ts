/**
 * Windows screensaver control. No native/FFI layer: everything here is a child
 * process, so there is nothing to compile per-arch.
 *
 *  - Which screensaver Windows shows on idle is just a registry value
 *    (HKCU\Control Panel\Desktop\SCRNSAVE.EXE). Writing it is exactly what the
 *    Settings UI does, so setActive() persists and takes effect on the next idle.
 *  - Running a .scr with the "/s" argument shows it full-screen right now, which is
 *    how the "Next" button gives instant feedback instead of waiting out an idle timer.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export type Screensaver = { name: string; path: string };

const SYSTEM32 = path.join(process.env.WINDIR ?? "C:\\Windows", "System32");
const DESKTOP_KEY = "HKCU\\Control Panel\\Desktop";

/** "PhotoScreensaver.scr" -> "Photo Screensaver"; "Mystify.scr" -> "Mystify". */
export function friendlyName(file: string): string {
	return file
		.replace(/\.scr$/i, "")
		.replace(/[_-]+/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/\s+/g, " ")
		.trim();
}

/** Every .scr in one folder; empty (never throws) if the folder is missing or unreadable. */
export function scrFilesIn(dir: string): Screensaver[] {
	if (!existsSync(dir)) return [];
	try {
		return readdirSync(dir)
			.filter((f) => f.toLowerCase().endsWith(".scr"))
			.map((f) => ({ name: friendlyName(f), path: path.join(dir, f) }));
	} catch {
		return [];
	}
}

/** Everything the user can pick: System32 plus an optional custom folder, deduped and sorted. */
export function listScreensavers(extraFolder?: string): Screensaver[] {
	const all = [...scrFilesIn(SYSTEM32), ...(extraFolder ? scrFilesIn(extraFolder) : [])];
	const seen = new Set<string>();
	const out: Screensaver[] = [];
	for (const s of all) {
		const key = s.path.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(s);
	}
	return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Step to the next entry in a ring. Tolerant of a missing or out-of-range current
 * index (e.g. the list shrank since last press), so it never throws or lands out of bounds.
 */
export function advanceIndex(length: number, current: number | undefined): number {
	if (length <= 0) return 0;
	const cur = Number.isInteger(current) ? (current as number) : -1;
	return (((cur % length) + length + 1) % length);
}

/** Point Windows at this .scr and make sure the screensaver feature is on. */
export function setActive(scrPath: string): void {
	execFileSync("reg", ["add", DESKTOP_KEY, "/v", "SCRNSAVE.EXE", "/t", "REG_SZ", "/d", scrPath, "/f"], { stdio: "ignore" });
	execFileSync("reg", ["add", DESKTOP_KEY, "/v", "ScreenSaveActive", "/t", "REG_SZ", "/d", "1", "/f"], { stdio: "ignore" });
}

/** Show a screensaver full-screen immediately. Any keypress or mouse move dismisses it. */
export function preview(scrPath: string): void {
	// Detached + unref: the preview outlives this call and never blocks the plugin.
	const child = spawn(scrPath, ["/s"], { detached: true, stdio: "ignore" });
	child.unref();
}

/** The chosen list, or every system screensaver as a zero-config fallback. */
export function resolveList(paths: string[] | undefined, folder?: string): string[] {
	if (paths && paths.length) return paths;
	return listScreensavers(folder).map((s) => s.path);
}
