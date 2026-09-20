import streamDeck from "@elgato/streamdeck";
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StatsAction } from "./actions/stats";

// The SDK reads manifest.json from process.cwd(), which Stream Deck is
// expected to set to the plugin folder but does not always do reliably.
// Force it explicitly so manifest reads never depend on host behavior.
process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

// Early crash diagnostics — logged BEFORE any SDK calls
const _DEBUG_EARLY = join(homedir(), "Desktop", "ratpack-debug.txt");
try { appendFileSync(_DEBUG_EARLY, `[${new Date().toISOString()}] STARTUP pid=${process.pid} node=${process.version} cwd=${process.cwd()} args=${JSON.stringify(process.argv.slice(2))}\n`); } catch { /**/ }
process.on("uncaughtException", (err) => {
	try { appendFileSync(_DEBUG_EARLY, `[${new Date().toISOString()}] UNCAUGHT: ${String(err)}\nSTACK: ${err instanceof Error ? err.stack : ""}\n`); } catch { /**/ }
	process.exit(1);
});
process.on("unhandledRejection", (reason) => {
	try { appendFileSync(_DEBUG_EARLY, `[${new Date().toISOString()}] UNHANDLED_REJECTION: ${String(reason)}\n`); } catch { /**/ }
	process.exit(1);
});

streamDeck.actions.registerAction(new StatsAction());

const DEBUG_FILE = join(homedir(), "Desktop", "ratpack-debug.txt");

// Global fallback: catches openUrl from PI if action routing has issues
streamDeck.ui.onSendToPlugin(({ payload }) => {
	const msg = payload as Record<string, unknown>;
	try { appendFileSync(DEBUG_FILE, `[${new Date().toISOString()}] global: ${String(msg.event)}\n`); } catch { /* */ }
	if (msg.event === "openUrl" && typeof msg.url === "string" && /^https?:\/\//.test(msg.url)) {
		void streamDeck.system.openUrl(msg.url);
	}
});

streamDeck.connect();
