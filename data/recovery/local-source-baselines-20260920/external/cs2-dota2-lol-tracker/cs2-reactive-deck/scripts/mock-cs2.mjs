/**
 * Mock CS2 GSI feeder. Posts realistic Game State Integration payloads to the plugin's
 * local server so you can watch every button react without launching Counter-Strike 2.
 *
 *   node scripts/mock-cs2.mjs          # default port 3000
 *   node scripts/mock-cs2.mjs 3001     # custom port
 *
 * Simulates a deathmatch-style run: firing, reloading, taking damage, a multi-kill streak
 * (DOUBLE → TRIPLE → ... → ACE) with a headshot, money rewards, and respawns. Ctrl+C to stop.
 */
import http from "node:http";

const PORT = Number(process.argv[2]) || 3000;

function post(payload) {
	const body = JSON.stringify(payload);
	const req = http.request(
		{ host: "127.0.0.1", port: PORT, method: "POST", path: "/", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
		(res) => res.resume()
	);
	req.on("error", (e) => console.error(`POST failed (is the plugin running on ${PORT}?):`, e.message));
	req.end(body);
}

function payload(f) {
	return {
		provider: { name: "Counter-Strike: Global Offensive", steamid: "76561198000000000" },
		round: { phase: f.phase, ...(f.bomb ? { bomb: f.bomb } : {}) },
		player: {
			steamid: "76561198000000000",
			name: "MockPlayer",
			state: { health: f.health, armor: f.armor, money: f.money, round_kills: f.roundKills, round_killhs: f.roundHs, flashed: 0 },
			match_stats: { kills: f.kills, assists: f.assists, deaths: f.deaths, mvps: f.mvps, score: f.kills * 2 },
			weapons: {
				weapon_0: { name: "weapon_knife", type: "Knife", state: "holstered" },
				weapon_1: {
					name: "weapon_ak47",
					type: "Rifle",
					state: f.reloading ? "reloading" : "active",
					ammo_clip: f.clip,
					ammo_clip_max: 30,
					ammo_reserve: f.reserve
				}
			}
		}
	};
}

const frames = [];
let clip = 30, reserve = 90, hp = 100, armor = 100, money = 800;
let kills = 0, deaths = 0, assists = 3, mvps = 0, roundKills = 0, roundHs = 0;
const push = (extra = {}) => frames.push({ health: hp, armor, money, clip, reserve, kills, assists, deaths, mvps, roundKills, roundHs, phase: "live", ...extra });

// Warmup
for (let i = 0; i < 3; i++) push({ phase: "freezetime" });
// Fire a few, reload
for (let i = 0; i < 4; i++) { clip -= 6; push(); }
push({ reloading: true });
push({ reloading: true });
clip = 30; reserve -= 30; push();
// Multi-kill streak: DOUBLE, TRIPLE, QUAD, ACE (last one a headshot), money + per kill
for (let n = 1; n <= 5; n++) {
	clip = Math.max(0, clip - 4);
	kills++; roundKills++; money += 300;
	if (n === 5) roundHs++; // headshot on the ace kill
	push();
	push(); // hold so the flash is visible
}
// Take damage, then die (kills must NOT reset — match stat)
hp = 40; armor = 60; push();
hp = 0; deaths++; push();
// Respawn — health back, round kills reset, but KDA kills stay
hp = 100; armor = 100; roundKills = 0; roundHs = 0; money = 1000; push();
for (let i = 0; i < 3; i++) { clip -= 5; push(); }
// Eco round example
money = 1200; push();

console.log(`Feeding mock CS2 GSI to http://127.0.0.1:${PORT}  (Ctrl+C to stop)`);
let i = 0;
setInterval(() => {
	post(payload(frames[i % frames.length]));
	i++;
}, 650);
