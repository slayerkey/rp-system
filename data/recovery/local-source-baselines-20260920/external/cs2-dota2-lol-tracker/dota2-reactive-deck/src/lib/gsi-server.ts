/**
 * Local HTTP server that receives Game State Integration (GSI) payloads.
 *
 * CS2 POSTs JSON to a local URI we configure via a `.cfg` file dropped in the game's
 * cfg folder. We run one shared server for the whole plugin; every action subscribes
 * to {@link GsiServer.onUpdate} and re-renders from the latest snapshot.
 */
import http from "node:http";
import { EventEmitter } from "node:events";
import streamDeck from "@elgato/streamdeck";

/** Loose typing — GSI payloads are large and partial; actions read what they need. */
export type GsiPayload = Record<string, any>;

class GsiServer {
	private server?: http.Server;
	private port = 0;
	private readonly bus = new EventEmitter();
	/** Most recent full payload received from the game. */
	latest: GsiPayload | null = null;
	/** Epoch ms of the last payload — used to detect "game not connected". */
	lastSeen = 0;

	constructor() {
		this.bus.setMaxListeners(50);
	}

	/** Start (or restart on a new port) the listener. Safe to call repeatedly. */
	start(port: number): void {
		if (this.server && this.port === port) return;
		this.stop();
		this.port = port;

		this.server = http.createServer((req, res) => {
			if (req.method !== "POST") {
				res.writeHead(200, { "content-type": "text/plain" });
				res.end("Ratpack GSI listener");
				return;
			}
			let body = "";
			req.on("data", (chunk) => {
				body += chunk;
				// Guard against runaway payloads.
				if (body.length > 1_000_000) req.destroy();
			});
			req.on("end", () => {
				try {
					this.latest = JSON.parse(body);
					this.lastSeen = Date.now();
					this.bus.emit("update", this.latest);
				} catch (err) {
					streamDeck.logger.warn("GSI: failed to parse payload", err);
				}
				res.writeHead(200);
				res.end();
			});
		});

		this.server.on("error", (err: NodeJS.ErrnoException) => {
			if (err.code === "EADDRINUSE") {
				streamDeck.logger.error(`GSI: port ${port} already in use. Change the port in the property inspector.`);
			} else {
				streamDeck.logger.error("GSI server error", err);
			}
		});

		this.server.listen(port, "127.0.0.1", () => {
			streamDeck.logger.info(`GSI listening on http://127.0.0.1:${port}`);
		});
	}

	stop(): void {
		this.server?.close();
		this.server = undefined;
	}

	/** Subscribe to every parsed payload. Returns an unsubscribe function. */
	onUpdate(fn: (p: GsiPayload) => void): () => void {
		this.bus.on("update", fn);
		return () => this.bus.off("update", fn);
	}

	/** True when we've heard from the game within `withinMs`. */
	isConnected(withinMs = 30_000): boolean {
		return this.lastSeen > 0 && Date.now() - this.lastSeen < withinMs;
	}
}

/** Shared singleton used by every action in the plugin. */
export const gsi = new GsiServer();
