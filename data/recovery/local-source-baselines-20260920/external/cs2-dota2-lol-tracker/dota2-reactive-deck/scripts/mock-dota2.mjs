/**
 * Mock Dota 2 GSI feeder. Posts realistic Game State Integration payloads to the plugin's
 * local server so you can watch the buttons react without launching Dota 2.
 *
 *   node scripts/mock-dota2.mjs        # default port 3001 (Dota; CS2 uses 3000)
 *   node scripts/mock-dota2.mjs 3005   # custom port
 *
 * Simulates a hero taking damage, regenerating, earning a kill bounty (gold jump), and
 * climbing KDA. (The Roshan timer is manual — press the key in Stream Deck to test it.)
 */
import http from "node:http";

const PORT = Number(process.argv[2]) || 3001;

function post(payload) {
	const body = JSON.stringify(payload);
	const req = http.request(
		{ host: "127.0.0.1", port: PORT, method: "POST", path: "/", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
		(res) => res.resume()
	);
	req.on("error", (e) => console.error(`POST failed (is the plugin running on ${PORT}?):`, e.message));
	req.end(body);
}

function payload({ hp, maxHp, mp, maxMp, alive, gold, k, d, a, level, clock, respawn }) {
	return {
		provider: { name: "Dota 2", appid: 570 },
		map: { game_time: clock + 60, clock_time: clock, daytime: Math.floor(clock / 240) % 2 === 0, game_state: "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS" },
		player: { gold, kills: k, deaths: d, assists: a, last_hits: 42, denies: 6, gpm: 520, xpm: 610 },
		hero: {
			name: "npc_dota_hero_juggernaut",
			level,
			alive,
			respawn_seconds: respawn,
			health: hp,
			max_health: maxHp,
			health_percent: Math.round((hp / maxHp) * 100),
			mana: mp,
			max_mana: maxMp,
			mana_percent: Math.round((mp / maxMp) * 100)
		}
	};
}

const maxHp = 1800, maxMp = 700;
const frames = [];
let hp = 1800, mp = 700, gold = 1200, k = 2, d = 1, a = 4, level = 11;
for (let i = 0; i < 60; i++) {
	// Take damage / regen waves.
	if (i % 9 < 4) hp = Math.max(120, hp - 230);
	else hp = Math.min(maxHp, hp + 160);
	mp = Math.max(0, mp - 40);
	if (mp <= 0) mp = maxMp;
	gold += 8; // passive trickle (should NOT flash)
	if (i === 14 || i === 33) { gold += 260; k++; } // kill bounty (SHOULD flash)
	if (i === 22) { d++; hp = 0; }                  // death
	if (i === 26) { hp = maxHp; mp = maxMp; }        // respawn
	if (i === 40) a++;
	// Respawn countdown while dead (frames 22..25 = 8,6,4,2s), clock advances each frame.
	const respawn = hp <= 0 ? Math.max(2, 8 - (i - 22) * 2) : 0;
	frames.push({ hp, maxHp, mp, maxMp, alive: hp > 0, gold, k, d, a, level, clock: 90 + i * 12, respawn });
}

console.log(`Feeding mock Dota 2 GSI to http://127.0.0.1:${PORT}  (Ctrl+C to stop)`);
let i = 0;
setInterval(() => {
	post(payload(frames[i % frames.length]));
	i++;
}, 700);
