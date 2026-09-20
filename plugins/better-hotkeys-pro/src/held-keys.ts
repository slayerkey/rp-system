import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { type InputMode, keyEvent, type MouseButton, mouseButtonEvent, sendInputs } from "./input";

/**
 * Anything that can be held down. Mouse buttons get the same treatment as keys: a stuck
 * right-button is every bit as bad as a stuck Shift, arguably worse.
 */
export type Held = { kind: "key"; vk: number; mode: InputMode } | { kind: "mouse"; button: MouseButton };

/**
 * Windows does not release synthetic input when the injecting process dies -- SendInput
 * writes into the global input stream, which outlives us. Stream Deck also exposes no
 * websocket-close or shutdown hook, so "release everything on quit" is not something we
 * can always do from inside the process. Verified: see held-keys.test.ts, which SIGKILLs
 * a child holding Shift and finds Shift still down afterwards.
 *
 * So the in-memory map is not enough. Everything held is journalled to disk BEFORE it
 * goes down, and replayed as a release on next start.
 *
 * The journal lives in tmp rather than the plugin folder because .sdPlugin is replaced
 * wholesale on update. Global settings would be the obvious store, but writing them needs
 * the websocket -- exactly what is dead in the cases being defended against.
 */
const JOURNAL_DIR = path.join(os.tmpdir(), "com.packrat.betterhotkeyspro");
const JOURNAL = path.join(JOURNAL_DIR, "held.json");

const held = new Map<string, Held[]>();

const same = (a: Held, b: Held): boolean =>
	a.kind === "key" && b.kind === "key" ? a.vk === b.vk : a.kind === "mouse" && b.kind === "mouse" ? a.button === b.button : false;

const downEvent = (h: Held): unknown => (h.kind === "key" ? keyEvent(h.vk, true, h.mode) : mouseButtonEvent(h.button, true));
const upEvent = (h: Held): unknown => (h.kind === "key" ? keyEvent(h.vk, false, h.mode) : mouseButtonEvent(h.button, false));

function flush(): void {
	try {
		const all = [...held.values()].flat();
		if (all.length === 0) {
			fs.rmSync(JOURNAL, { force: true });
			return;
		}
		fs.mkdirSync(JOURNAL_DIR, { recursive: true });
		fs.writeFileSync(JOURNAL, JSON.stringify(all));
	} catch {
		// Journalling is best-effort. A disk problem must never block input.
	}
}

/** Presses inputs for an action instance. Anything already held is not re-sent. */
export function press(context: string, items: Held[]): void {
	const current = held.get(context) ?? [];
	const additions = items.filter((item) => !current.some((h) => same(h, item)));
	if (additions.length === 0) return;

	held.set(context, [...current, ...additions]);
	flush(); // journal first: a kill in this gap must leave a repairable record
	sendInputs(additions.map(downEvent));
}

/** Convenience for the keyboard actions. */
export function pressKeys(context: string, vks: number[], mode: InputMode = "scancode"): void {
	press(
		context,
		vks.map((vk) => ({ kind: "key", vk, mode }))
	);
}

/** Releases everything held by an action instance. Safe when nothing is held. */
export function release(context: string): void {
	const current = held.get(context);
	if (!current || current.length === 0) return;

	held.delete(context);
	try {
		// Reverse order: Shift-down then W-down must unwind as W-up then Shift-up.
		sendInputs([...current].reverse().map(upEvent));
	} finally {
		flush();
	}
}

export function releaseAll(): void {
	for (const context of [...held.keys()]) {
		try {
			release(context);
		} catch {
			// Keep going: one failed release must not strand the rest.
		}
	}
}

export function isHeld(context: string): boolean {
	return (held.get(context)?.length ?? 0) > 0;
}

/** Older journals stored bare {vk, mode} with no discriminator. */
function normalise(raw: unknown): Held | null {
	const item = raw as Partial<Held> & { vk?: number; mode?: InputMode; button?: MouseButton };
	if (item?.kind === "mouse" && item.button) return { kind: "mouse", button: item.button };
	if (typeof item?.vk === "number") return { kind: "key", vk: item.vk, mode: item.mode ?? "scancode" };
	return null;
}

/**
 * Replays a journal left by a previous run as releases. Idempotent -- releasing something
 * already up is harmless, so a stale journal costs nothing.
 */
export function recover(): number {
	try {
		if (!fs.existsSync(JOURNAL)) return 0;
		const stale = (JSON.parse(fs.readFileSync(JOURNAL, "utf8")) as unknown[])
			.map(normalise)
			.filter((h): h is Held => h !== null);
		if (stale.length > 0) sendInputs(stale.reverse().map(upEvent));
		fs.rmSync(JOURNAL, { force: true });
		return stale.length;
	} catch {
		try {
			fs.rmSync(JOURNAL, { force: true });
		} catch {
			/* ignore */
		}
		return 0;
	}
}

/**
 * Catches the shutdown paths that are catchable. Signals only arrive if Stream Deck stops
 * us with process.kill rather than TerminateProcess, so these are a best-effort fast path
 * -- the journal is the actual guarantee.
 */
export function installSafetyNets(): void {
	for (const signal of ["SIGTERM", "SIGINT", "SIGHUP", "SIGBREAK"] as const) {
		process.on(signal, () => {
			releaseAll();
			process.exit(0);
		});
	}
	process.on("exit", releaseAll);
	process.on("uncaughtException", (error) => {
		releaseAll();
		throw error;
	});
	process.on("unhandledRejection", () => releaseAll());
}
