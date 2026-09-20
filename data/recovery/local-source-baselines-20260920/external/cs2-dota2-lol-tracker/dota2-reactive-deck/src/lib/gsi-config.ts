/**
 * Auto-installs the Game State Integration .cfg into the game's own cfg folder so users don't
 * have to copy anything by hand. We locate the game via Steam's library folders, then write the
 * config if it's missing or out of date. If we can't find/write it, the plugin still runs — the
 * action just shows a "waiting" state and the README explains the manual step.
 *
 * Note: GSI configs are read by the game at launch, so the user must restart the game once after
 * the file is first installed.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import streamDeck from "@elgato/streamdeck";

function exists(p: string): boolean {
	try {
		return fs.existsSync(p);
	} catch {
		return false;
	}
}

/** Candidate Steam install roots for this OS. */
function steamRoots(): string[] {
	const roots = new Set<string>();
	if (process.platform === "win32") {
		try {
			const out = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', {
				stdio: ["ignore", "pipe", "ignore"]
			}).toString();
			const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
			if (m) roots.add(path.normalize(m[1].trim()));
		} catch {
			/* registry not readable — fall back to defaults */
		}
		for (const p of [process.env["ProgramFiles(x86)"], process.env.ProgramFiles]) {
			if (p) roots.add(path.join(p, "Steam"));
		}
		roots.add("C:\\Program Files (x86)\\Steam");
	} else if (process.platform === "darwin") {
		roots.add(path.join(os.homedir(), "Library", "Application Support", "Steam"));
	} else {
		roots.add(path.join(os.homedir(), ".steam", "steam"));
		roots.add(path.join(os.homedir(), ".local", "share", "Steam"));
	}
	return [...roots].filter(exists);
}

/** All Steam library paths (parses libraryfolders.vdf so games on other drives are found). */
function libraries(steam: string): string[] {
	const libs = new Set<string>([steam]);
	try {
		const txt = fs.readFileSync(path.join(steam, "steamapps", "libraryfolders.vdf"), "utf8");
		for (const m of txt.matchAll(/"path"\s*"([^"]+)"/g)) libs.add(m[1].replace(/\\\\/g, "\\"));
	} catch {
		/* no library index — just use the root */
	}
	return [...libs];
}

/** Find a game's folder under any Steam library and return the requested subdirectory within it. */
export function findGameDir(installDir: string, ...sub: string[]): string | null {
	for (const steam of steamRoots()) {
		for (const lib of libraries(steam)) {
			const base = path.join(lib, "steamapps", "common", installDir);
			if (exists(base)) return path.join(base, ...sub);
		}
	}
	return null;
}

export type CfgResult = "written" | "exists" | "notfound" | "error";

/** Ensure the GSI cfg exists (and is current) in `dir`. Returns what happened, for logging/status. */
export function ensureCfg(dir: string | null, fileName: string, content: string): CfgResult {
	if (!dir) {
		streamDeck.logger.warn("GSI: could not locate the game's cfg folder; manual install needed.");
		return "notfound";
	}
	try {
		fs.mkdirSync(dir, { recursive: true });
		const file = path.join(dir, fileName);
		if (exists(file) && fs.readFileSync(file, "utf8") === content) return "exists";
		fs.writeFileSync(file, content, "utf8");
		streamDeck.logger.info(`GSI config installed at ${file} — restart the game once to load it.`);
		return "written";
	} catch (err) {
		streamDeck.logger.warn(`GSI: couldn't write config to ${dir}`, err);
		return "error";
	}
}
