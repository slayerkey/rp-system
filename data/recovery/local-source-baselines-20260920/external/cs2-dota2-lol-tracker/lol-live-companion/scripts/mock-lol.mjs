/**
 * Mock League of Legends "Live Client Data" server. Serves an evolving /liveclientdata/allgamedata
 * over HTTPS on port 2999 — exactly where the real League client serves it — so you can watch the
 * plugin's buttons react without launching the game.
 *
 *   node scripts/mock-lol.mjs        # serves on https://127.0.0.1:2999
 *
 * The cert below is a throwaway self-signed cert (the plugin ignores cert validation for localhost,
 * just like it does for the real client). Ctrl+C to stop. Stop it to see the plugin's idle state.
 */
import https from "node:https";

const KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDR0p6tfqWkMHxe
zgTlbLVEHVhno12sn0LyIbYcZ/4TdS4SAWF5Bca7k7YmVnxeNz9u7lxBA0CCoIWA
+6M0zBliVwAhE6pMkS9JoFvDtco3BWDUDvefARUI4in149V4kxbzLumOLbc7Cw1A
WiSK4nG3rfU59AVTlmO1gG141ZexePdWn5DnY4boLWX7K8MgsK+OfUcrU1YcnG5u
DQjo138s+5AgsIJVuA7plbKJUfhZVJ+a58zYKFep3SRviyaqJzsUBmXygPG/37IU
o9KlYYkvi85pOCNWtGayT/p5fVYrg+HAoI4XjG4ULoCdd8mHx6iy4VIoAtmJdjXz
rIa6w4zJAgMBAAECggEAVTZDwfLuo0UbpUbm3yOsY/rE9eX3O408W2hMdLHZEh7j
NGXCJ6usX25oKZ6zCHJIfS0pYy/GaaZ2QYEwcVc4MeNiRoyde1X1DeIlklBITNsO
zWA8uSLv33k2EEnUXpDh36YcLOUtBjoBSjKxp4O6Kh3oOv56kU1AtivviYS5A9X/
yXSUtuQ803xKVsVmfx5kHn62v5QxZNdeq+xdf8Elgk0ZCIVvVKN3W8xHWCBLfKKO
DNVsZL51KnxXCHgIaP6bhpn7VU7E/Wc7pTKTe7TUPDCl6elAi48ILeLfbEeEzkXj
AirUWr7DfeSa3tiZ79rHRVJDib0ATbSLu2Upig4+/wKBgQDvMMN6nv60qvq/WPpX
VjM2JBmPBdFqwNcpw20Wc55/LGzX/B3eG6VS2nsZg1bOxrn0JfH/UdRS/rJpKXkU
Bc6d8/d6EQsRJjCgbwJz86s3t4F+92hd0FSuHx9Zxi6fRIxnDYrKUQWvYhH8Pe0G
Ih+UeXJ04dGwuUPZElw96wPyCwKBgQDgkYGEncl1AVYWRQMP9WYuT5vJqyRe20en
6CsKUy+0v3Vxj73wvupmTtRkKoK6hz1UmnGMAI+a/b8BMS290QnC8Cw4SDkZq3Yg
kN3lqFrwTFvzZnNbni8EAiwILdoas1QECAW4kIDO26mFZyGbVi7mUb5N9Yzu+vY6
lM83ChE0+wKBgC27EwS0tVnxfrNq3aIpFu15BXH02M8iQ4D2njq2rE0AP2ckCsnW
W0t1/icol0Y9dHwbbSM1j/S2QYIdrcqIObK1XFF4RLdop89kqgFlSw0CBr4xq0CU
fjw0MxhE7dEBmB5z1l9MElwv0eR6KoELsSH//kQekKrLIQ+1lPE5p611AoGAEK//
VeF7xOwSf5klPxxXOX3E79l93GajDoEcIapI0z+e9I9f5/Hn7S5SbhcSm9XM4uqP
IX4xLa1Jckc7RO2xsgCy6IPFanjpUEYzlwtJpq2l75JfZCF/EOcwanMtz+ofhiUq
d6qVR8ne8QDW6HohBhBw+c4TaPbRMU05kLd4y90CgYEAlL13BAnM9ds2E8/12387
abfkMhrmvBSM5nBVH0fkQ6MgUh94dQMfEStchSgHcy5UEYbmFPVc4Z7CFa+rakmg
H0IyEaC5cs016Ri0eA965RV/cncwgdhemxKa4eNiMtY+6FNKvtUhrfjsrFZjFR9w
Ht3vt/o1I8LV3QouDzfYtc4=
-----END PRIVATE KEY-----`;

const CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUN+YQmfOrk5ooqkDuq/cLlAP/O0swDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MDYyMTA1MDk1MFoXDTM2MDYx
ODA1MDk1MFowFDESMBAGA1UEAwwJMTI3LjAuMC4xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEA0dKerX6lpDB8Xs4E5Wy1RB1YZ6NdrJ9C8iG2HGf+E3Uu
EgFheQXGu5O2JlZ8Xjc/bu5cQQNAgqCFgPujNMwZYlcAIROqTJEvSaBbw7XKNwVg
1A73nwEVCOIp9ePVeJMW8y7pji23OwsNQFokiuJxt631OfQFU5ZjtYBteNWXsXj3
Vp+Q52OG6C1l+yvDILCvjn1HK1NWHJxubg0I6Nd/LPuQILCCVbgO6ZWyiVH4WVSf
mufM2ChXqd0kb4smqic7FAZl8oDxv9+yFKPSpWGJL4vOaTgjVrRmsk/6eX1WK4Ph
wKCOF4xuFC6AnXfJh8eosuFSKALZiXY186yGusOMyQIDAQABo1MwUTAdBgNVHQ4E
FgQU95HmeVFdkpmQj5i1IF1m2gjfrywwHwYDVR0jBBgwFoAU95HmeVFdkpmQj5i1
IF1m2gjfrywwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEACZdp
f/I5bScLw+mG6dVIqs33DsHqIR3sj5Sa/VTJzuGb52shPOtxCBFcVyhnqxu+0FLC
viNxp5OR5p69puOKkjna62YR2O7azBySVvVnhG+JMEDL5PGaa6/8KAeFiRTME8tg
iBF2TJ5DZwO99jDzIYhFwff373K7HIgeKkbgDI7p8PU16Vm4c0ErugW6aEpKQ4Qf
WMFVZMarSHeB0rsyMRKvyuG6JCAQwpfc8D40/n6EM/YbU38uVApuasHzMgMPSBil
miOvRQlvvsJW4mG2KZJx2gP3biOKutsqqHuuuU6QMhdayZg1fAzvv/GTHjJhETY9
sVP6jz+vpAWusbRw1w==
-----END CERTIFICATE-----`;

const NAME = "MockSummoner";
let t = 0;

function allGameData() {
	t++;
	// Gold climbs (passive + the occasional spike), HP oscillates, KDA grows.
	const gold = 500 + t * 35 + (t % 12 === 0 ? 300 : 0);
	const maxHealth = 2100;
	const currentHealth = Math.max(0, Math.round(maxHealth * (0.5 + 0.5 * Math.sin(t / 4))));
	const kills = Math.floor(t / 10);
	const deaths = Math.floor(t / 25);
	const assists = Math.floor(t / 7);
	const cs = 30 + t * 2;
	return {
		activePlayer: {
			summonerName: NAME,
			currentGold: gold,
			championStats: { currentHealth, maxHealth, resourceValue: 300, resourceMax: 500 },
			level: 1 + Math.floor(t / 8)
		},
		allPlayers: [
			{ summonerName: NAME, championName: "Ahri", team: "ORDER", scores: { kills, deaths, assists, creepScore: cs, wardScore: 12.3 } },
			{ summonerName: "Enemy", championName: "Zed", team: "CHAOS", scores: { kills: 3, deaths: 2, assists: 1, creepScore: 80, wardScore: 4 } }
		],
		gameData: { gameMode: "CLASSIC", gameTime: t * 2 }
	};
}

const server = https.createServer({ key: KEY, cert: CERT }, (req, res) => {
	if (req.url && req.url.startsWith("/liveclientdata/allgamedata")) {
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify(allGameData()));
	} else {
		res.writeHead(404);
		res.end();
	}
});

server.listen(2999, "127.0.0.1", () => {
	console.log("Mock LoL Live Client serving https://127.0.0.1:2999/liveclientdata/allgamedata");
	console.log("Gold climbs (with spikes), HP oscillates, KDA grows. Ctrl+C to stop (idle state).");
});
server.on("error", (e) => console.error("Server error (is port 2999 already in use by League?):", e.message));
