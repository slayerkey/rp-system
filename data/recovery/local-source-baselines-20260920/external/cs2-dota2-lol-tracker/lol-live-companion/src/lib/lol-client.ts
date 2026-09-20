/**
 * Polls the Riot **Live Client Data API**, which the League client serves locally at
 * https://127.0.0.1:2999 with a self-signed certificate (so we disable cert verification
 * for this host only). Emits "update" with parsed data while a game is running, and
 * "idle" when the API is unreachable (champ select, post-game, or League closed).
 */
import https from "node:https";
import { EventEmitter } from "node:events";
import streamDeck from "@elgato/streamdeck";

const HOST = "127.0.0.1";
const PORT = 2999;
const PATH = "/liveclientdata/allgamedata";

export type LiveData = Record<string, any>;

class LolClient {
	private readonly bus = new EventEmitter();
	private timer?: ReturnType<typeof setInterval>;
	private readonly agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
	latest: LiveData | null = null;
	connected = false;

	constructor() {
		this.bus.setMaxListeners(50);
	}

	start(intervalMs = 2000): void {
		if (this.timer) return;
		void this.poll();
		this.timer = setInterval(() => void this.poll(), intervalMs);
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	onUpdate(fn: (d: LiveData) => void): () => void {
		this.bus.on("update", fn);
		return () => this.bus.off("update", fn);
	}

	onIdle(fn: () => void): () => void {
		this.bus.on("idle", fn);
		return () => this.bus.off("idle", fn);
	}

	private poll(): Promise<void> {
		return new Promise((resolve) => {
			const req = https.request(
				{ host: HOST, port: PORT, path: PATH, method: "GET", agent: this.agent, timeout: 1500 },
				(res) => {
					let body = "";
					res.on("data", (c) => (body += c));
					res.on("end", () => {
						if (res.statusCode !== 200) return resolve(this.goIdle());
						try {
							this.latest = JSON.parse(body);
							this.connected = true;
							this.bus.emit("update", this.latest);
						} catch {
							this.goIdle();
						}
						resolve();
					});
				}
			);
			// Any connection error => game not running. This is normal, log at debug only.
			req.on("error", () => {
				resolve(this.goIdle());
			});
			req.on("timeout", () => {
				req.destroy();
				resolve(this.goIdle());
			});
			req.end();
		});
	}

	private goIdle(): void {
		if (this.connected) streamDeck.logger.debug("LoL API unreachable — going idle");
		this.connected = false;
		this.latest = null;
		this.bus.emit("idle");
	}
}

export const lol = new LolClient();
