/**
 * Captures the Riot Live Client Data API JSON so we can see exactly what a TFT (or LoL) match
 * exposes. Run this WHILE you're in a live TFT game (past the loading screen):
 *
 *   node tools/capture-liveclient.mjs
 *
 * It ignores the self-signed cert (same as the plugin), prints the useful fields it finds, and
 * saves the full JSON to tools/_liveclient.json. Paste that back and I'll build the TFT plugin
 * around whatever is actually populated.
 */
import https from "node:https";
import fs from "node:fs";

const agent = new https.Agent({ rejectUnauthorized: false });

function get(path) {
	return new Promise((resolve, reject) => {
		https
			.request({ host: "127.0.0.1", port: 2999, path, method: "GET", agent, timeout: 4000 }, (res) => {
				let body = "";
				res.on("data", (c) => (body += c));
				res.on("end", () => resolve({ status: res.statusCode, body }));
			})
			.on("error", reject)
			.on("timeout", () => reject(new Error("timeout — are you IN a live game?")))
			.end();
	});
}

try {
	const { status, body } = await get("/liveclientdata/allgamedata");
	if (status !== 200) {
		console.log(`Got HTTP ${status}. Make sure you're in a live game.`);
		process.exit(1);
	}
	const data = JSON.parse(body);
	fs.writeFileSync(new URL("./_liveclient.json", import.meta.url), JSON.stringify(data, null, 2));
	console.log("Saved full JSON to tools/_liveclient.json\n");
	console.log("gameMode     :", data?.gameData?.gameMode);
	console.log("gameTime     :", data?.gameData?.gameTime);
	console.log("activePlayer :", JSON.stringify(data?.activePlayer ?? {}, null, 0).slice(0, 300));
	console.log("players (#)  :", Array.isArray(data?.allPlayers) ? data.allPlayers.length : "none");
	if (Array.isArray(data?.allPlayers) && data.allPlayers[0]) {
		console.log("player[0]    :", JSON.stringify(data.allPlayers[0]).slice(0, 300));
	}
	console.log("\n--> Paste the contents of tools/_liveclient.json back to me.");
} catch (e) {
	console.log("Could not read the API:", e.message);
	console.log("Open this in a browser while in-game to confirm: https://127.0.0.1:2999/liveclientdata/allgamedata");
}
