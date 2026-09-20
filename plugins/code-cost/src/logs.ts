/**
 * Reads what Claude Code and Codex already write to disk and turns it into priced turns.
 *
 * No network, no API key, no account. Everything here is the user's own files under their own
 * home directory, which is what lets this plugin work on a Pro or Max subscription rather than
 * needing an API-platform account.
 *
 * Both formats are undocumented (registry risk flag
 * `platform-risk:undocumented-claude-code-jsonl-schema`), so every field access is defensive
 * and a line that does not parse is skipped rather than throwing.
 */
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";

import { costOf, type Tokens } from "./pricing";

export type Tool = "claude" | "codex";

export type Turn = {
	tool: Tool;
	/** Epoch ms. Falls back to the file mtime when a line carries no usable timestamp. */
	at: number;
	model: string;
	tokens: Tokens;
	/** USD, or null when the model has no known rate. */
	cost: number | null;
	/** Directory-derived project label, used by the Pro breakdown. */
	project: string;
};

const ZERO: Tokens = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

export function claudeRoot(): string {
	return join(homedir(), ".claude", "projects");
}

export function codexRoot(): string {
	return join(homedir(), ".codex", "sessions");
}

/**
 * Claude Code names a session directory after the project's full absolute path, with the
 * separators flattened to hyphens. Every project under the same parent therefore shares a long
 * prefix, and truncating that for a 144px key renders several projects identically. The trailing
 * segments are the identifying part, so the label is built from those.
 */
export function projectLabel(dir: string): string {
	const parts = dir.split("-").filter(Boolean);
	if (parts.length <= 2) return dir;
	return parts.slice(-2).join("-");
}

/** Every *.jsonl under a root, with its mtime, newest first. */
function sessionFiles(root: string): { path: string; mtimeMs: number; project: string }[] {
	if (!existsSync(root)) return [];
	const out: { path: string; mtimeMs: number; project: string }[] = [];
	const walk = (dir: string, project: string): void => {
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return; // unreadable directory is not a reason to fail the whole scan
		}
		for (const e of entries) {
			const p = join(dir, e.name);
			if (e.isDirectory()) {
				walk(p, project || e.name);
			} else if (e.isFile() && e.name.endsWith(".jsonl")) {
				try {
					out.push({ path: p, mtimeMs: statSync(p).mtimeMs, project: projectLabel(project || "unknown") });
				} catch {
					/* raced with a delete */
				}
			}
		}
	};
	walk(root, "");
	return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function eachLine(path: string, fn: (line: string) => void): Promise<void> {
	await new Promise<void>((resolve) => {
		const rl = createInterface({ input: createReadStream(path, { encoding: "utf-8" }), crlfDelay: Infinity });
		rl.on("line", fn);
		rl.on("close", resolve);
		rl.on("error", () => resolve());
	});
}

function num(v: unknown): number {
	return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function parseTime(v: unknown, fallback: number): number {
	if (typeof v === "string") {
		const t = Date.parse(v);
		if (!Number.isNaN(t)) return t;
	}
	if (typeof v === "number" && Number.isFinite(v)) return v > 1e12 ? v : v * 1000;
	return fallback;
}

/**
 * Claude Code: one JSON object per line, assistant turns carrying `message.usage` and
 * `message.model`. Usage is per turn, so these sum directly.
 */
async function readClaudeFile(f: { path: string; mtimeMs: number; project: string }): Promise<Turn[]> {
	const turns: Turn[] = [];
	await eachLine(f.path, (line) => {
		if (!line.includes('"usage"')) return;
		let d: Record<string, unknown>;
		try {
			d = JSON.parse(line);
		} catch {
			return;
		}
		const msg = (d.message ?? d) as Record<string, unknown>;
		const u = msg.usage as Record<string, unknown> | undefined;
		if (!u || typeof u !== "object") return;
		const model = String(msg.model ?? d.model ?? "");
		if (!model || model === "<synthetic>") return;
		const tokens: Tokens = {
			input: num(u.input_tokens),
			output: num(u.output_tokens),
			cacheWrite: num(u.cache_creation_input_tokens),
			cacheRead: num(u.cache_read_input_tokens)
		};
		if (tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead === 0) return;
		turns.push({
			tool: "claude",
			at: parseTime(d.timestamp, f.mtimeMs),
			model,
			tokens,
			cost: costOf(model, tokens),
			project: f.project
		});
	});
	return turns;
}

/**
 * Codex: `event_msg` lines with `payload.type === "token_count"`.
 *
 * The trap: `info.total_token_usage` is CUMULATIVE for the session, so summing it across a
 * session multiplies the real figure by the number of turns. `last_token_usage` is the per-turn
 * delta and is the only field safe to add up. The model id arrives separately on `turn_context`
 * lines, so it is tracked as it goes past and applied to subsequent counts.
 */
async function readCodexFile(f: { path: string; mtimeMs: number; project: string }): Promise<Turn[]> {
	const turns: Turn[] = [];
	let model = "";
	await eachLine(f.path, (line) => {
		if (!line.includes('"model"') && !line.includes('"token_count"')) return;
		let d: Record<string, unknown>;
		try {
			d = JSON.parse(line);
		} catch {
			return;
		}
		const payload = (d.payload ?? {}) as Record<string, unknown>;
		if (typeof d.type === "string" && d.type === "turn_context") {
			const m = (d as Record<string, unknown>).model ?? payload.model;
			if (typeof m === "string" && m) model = m;
			return;
		}
		if (payload.type !== "token_count") return;
		const info = (payload.info ?? {}) as Record<string, unknown>;
		const last = info.last_token_usage as Record<string, unknown> | undefined;
		if (!last || typeof last !== "object") return;
		// `input_tokens` already includes the cached portion, so subtract it to avoid
		// charging cached reads at the full input rate.
		const cacheRead = num(last.cached_input_tokens);
		const tokens: Tokens = {
			input: Math.max(0, num(last.input_tokens) - cacheRead),
			output: num(last.output_tokens),
			cacheWrite: num(last.cache_write_input_tokens),
			cacheRead
		};
		if (tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead === 0) return;
		turns.push({
			tool: "codex",
			at: parseTime(d.timestamp, f.mtimeMs),
			model,
			tokens,
			cost: costOf(model, tokens),
			project: f.project
		});
	});
	return turns;
}

/**
 * Parsed sessions, keyed by path and invalidated by mtime.
 *
 * Without this a 30 day read is roughly 3.3 seconds of disk I/O across 270 session files, and
 * the plugin repeats it every minute for as long as the deck is plugged in. Almost all of those
 * files are finished conversations that will never change again, so they are parsed once. Only
 * the session being written to right now gets re-read, which takes the repeat cost to a few
 * milliseconds.
 */
const parsed = new Map<string, { mtimeMs: number; turns: Turn[] }>();

async function readCached(
	f: { path: string; mtimeMs: number; project: string },
	read: (f: { path: string; mtimeMs: number; project: string }) => Promise<Turn[]>
): Promise<Turn[]> {
	const hit = parsed.get(f.path);
	if (hit && hit.mtimeMs === f.mtimeMs) return hit.turns;
	const turns = await read(f);
	parsed.set(f.path, { mtimeMs: f.mtimeMs, turns });
	return turns;
}

/**
 * All turns newer than `sinceMs`. Files whose mtime predates the window are skipped without
 * being opened, which is what keeps a 30 day read cheap against hundreds of sessions.
 */
export async function readTurns(sinceMs: number): Promise<Turn[]> {
	const jobs: Promise<Turn[]>[] = [];
	const live = new Set<string>();
	for (const f of sessionFiles(claudeRoot())) {
		if (f.mtimeMs < sinceMs) continue;
		live.add(f.path);
		jobs.push(readCached(f, readClaudeFile));
	}
	for (const f of sessionFiles(codexRoot())) {
		if (f.mtimeMs < sinceMs) continue;
		live.add(f.path);
		jobs.push(readCached(f, readCodexFile));
	}
	const all = (await Promise.all(jobs)).flat();
	// Drop entries that aged out of the window or were deleted, so the map cannot grow forever
	// on a machine that is left running for weeks.
	for (const key of parsed.keys()) {
		if (!live.has(key)) parsed.delete(key);
	}
	return all.filter((t) => t.at >= sinceMs);
}

/** True when neither tool has ever written a session log, so the key can say so honestly. */
export function anyLogsPresent(): boolean {
	return existsSync(claudeRoot()) || existsSync(codexRoot());
}

export type Totals = {
	cost: number;
	tokens: number;
	/** Turns whose model had no known rate, so `cost` understates the truth. */
	unpriced: number;
	turns: number;
	byModel: Map<string, number>;
	byProject: Map<string, number>;
};

export function total(turns: Turn[], tool?: Tool): Totals {
	const t: Totals = { cost: 0, tokens: 0, unpriced: 0, turns: 0, byModel: new Map(), byProject: new Map() };
	for (const turn of turns) {
		if (tool && turn.tool !== tool) continue;
		t.turns++;
		t.tokens += turn.tokens.input + turn.tokens.output + turn.tokens.cacheWrite + turn.tokens.cacheRead;
		if (turn.cost === null) {
			t.unpriced++;
			continue;
		}
		t.cost += turn.cost;
		t.byModel.set(turn.model, (t.byModel.get(turn.model) ?? 0) + turn.cost);
		t.byProject.set(turn.project, (t.byProject.get(turn.project) ?? 0) + turn.cost);
	}
	return t;
}

export const EMPTY_TOTALS: Totals = {
	cost: 0,
	tokens: 0,
	unpriced: 0,
	turns: 0,
	byModel: new Map(),
	byProject: new Map()
};

export { ZERO };
