// Local usage bridge: serves GET /usage on 127.0.0.1 for the Packrat AI Usage
// iCUE widget (Corsair Xeneon Edge).
//
// The awkward part is that each provider ships as its OWN plugin built from this
// same source, so no single process knows about the others. Rather than elect a hub
// or add a separate background service the user has to install, every plugin writes
// its latest reading to one shared directory, and whichever plugin wins the race to
// bind the port serves the union of those files.
//
// Consequences worth knowing:
//   - Any subset of the plugins can be installed; the widget shows exactly those.
//   - Whoever holds the port can go away; the next plugin to start picks it up.
//   - A plugin that stops updating drops out on its own once its file goes stale,
//     so the widget never shows a number nobody is refreshing any more.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import streamDeck from "@elgato/streamdeck";
import type { UsageState } from "./poller";

const PORT = 8787;
const HOST = "127.0.0.1";
const DIR = path.join(os.homedir(), ".packrat", "usage");
// A reading older than this is dropped rather than served. Longer than the slowest
// poll interval, short enough that an uninstalled plugin disappears promptly.
const STALE_MS = 15 * 60 * 1000;

interface Reading {
	id: string;
	displayName: string;
	percent: number;
	window: string;
	resetsAt?: string;
	updatedAt: number;
}

/**
 * Write a provider's latest reading. Called on every successful poll.
 *
 * The provider is passed in rather than read from the build singleton because the
 * combined tracker publishes for all eight from one process.
 */
export function publish(providerId: string, displayName: string, state: UsageState): void {
	if (state.status !== "ok" || !state.usage) return;
	const primary = state.usage.windows[0];
	if (!primary) return;
	const reading: Reading = {
		id: providerId,
		displayName,
		percent: Math.max(0, Math.min(100, primary.utilization)),
		window: primary.label.toLowerCase(),
		resetsAt: primary.resetsAt,
		updatedAt: Date.now(),
	};
	try {
		fs.mkdirSync(DIR, { recursive: true });
		// Write-then-rename so the server never reads a half-written file.
		const tmp = path.join(DIR, `.${providerId}.tmp`);
		fs.writeFileSync(tmp, JSON.stringify(reading), "utf-8");
		fs.renameSync(tmp, path.join(DIR, `${providerId}.json`));
	} catch (e) {
		streamDeck.logger.warn(`usage bridge: could not publish reading: ${String(e)}`);
	}
}

function collect(): Reading[] {
	let files: string[] = [];
	try {
		files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
	} catch {
		return [];
	}
	const now = Date.now();
	const out: Reading[] = [];
	for (const f of files) {
		try {
			const r = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf-8")) as Reading;
			if (typeof r.percent === "number" && now - r.updatedAt < STALE_MS) out.push(r);
		} catch {
			// A corrupt file is skipped, never fatal: one bad provider must not take
			// the whole panel down.
		}
	}
	return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Bind the bridge port if nobody else has.
 *
 * EADDRINUSE is the EXPECTED case, not an error: it means a sibling Packrat plugin
 * is already serving, and this process only needs to keep publishing its own file.
 */
export function startBridge(): void {
	const server = http.createServer((req, res) => {
		// The widget runs from a file:// origin, so every request is cross-origin and
		// the browser sends a preflight first.
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}
		if (!req.url || req.url.split("?")[0] !== "/usage") {
			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "not found" }));
			return;
		}
		res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
		res.end(JSON.stringify({ providers: collect() }));
	});

	server.on("error", (e: NodeJS.ErrnoException) => {
		if (e.code === "EADDRINUSE") {
			streamDeck.logger.info(`usage bridge: port ${PORT} already served by another Packrat plugin`);
		} else {
			streamDeck.logger.warn(`usage bridge: ${String(e)}`);
		}
	});
	server.listen(PORT, HOST, () => {
		streamDeck.logger.info(`usage bridge: serving http://${HOST}:${PORT}/usage`);
	});
}
