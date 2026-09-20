/**
 * Writes the key faces the listing art uses, straight from the shipping renderer.
 *
 * The trackers draw their keys at runtime, so there is no static PNG on disk for the marketing
 * generator to pull the way it does for Better Hotkeys. Rendering them here keeps the listing
 * honest: every key in the art is a real badge from the real code path, with real team colours
 * and real data shapes, not a mockup.
 *
 *   npx tsx scripts/marketing-keys.ts <outDir>
 *
 * The SVGs land in <outDir>/<slug>/<name>.svg; tools/art/svg_to_png.mjs rasterizes them.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { displayColor, entryBadge, eventBadge, nextGameBadge, scoreBadge, standingsBadge } from "../src/badge";

const out = process.argv[2] ?? "marketing-keys";

type Faces = Record<string, Record<string, string>>;

const faces: Faces = {
	"nba-tracker": {
		score: scoreBadge({
			teamColor: "#fdb927",
			teamAbbr: "LAL",
			teamScore: 108,
			oppAbbr: "GS",
			oppScore: 104,
			status: "Q4 - 2:11",
			live: true
		}),
		flash: scoreBadge({
			teamColor: "#fdb927",
			teamAbbr: "LAL",
			teamScore: 111,
			oppAbbr: "GS",
			oppScore: 104,
			status: "Q4 - 1:48",
			live: true,
			flash: true
		}),
		next: nextGameBadge({
			teamColor: "#007a33",
			teamAbbr: "BOS",
			oppAbbr: "NY",
			homeAway: "away",
			when: "2H 15M",
			whenDetail: "TODAY 7:30 PM",
			imminent: true
		}),
		standings: standingsBadge({
			teamColor: "#007a33",
			teamAbbr: "BOS",
			groupLabel: "East",
			seed: 2,
			wins: 56,
			losses: 26,
			gamesBehind: "4.0",
			streak: "W3"
		}),
		board: scoreBadge({
			teamColor: "#1d428a",
			teamAbbr: "NY",
			teamScore: 96,
			oppAbbr: "MIA",
			oppScore: 92,
			status: "Q3 - 5:32",
			live: true,
			index: [2, 8]
		}),
		stale: scoreBadge({
			teamColor: "#c8102e",
			teamAbbr: "MIA",
			teamScore: 88,
			oppAbbr: "TOR",
			oppScore: 91,
			status: "Q3 - 4:02",
			stale: true,
			staleAge: "12m"
		})
	},
	"nfl-tracker": {
		score: scoreBadge({
			teamColor: "#e31837",
			teamAbbr: "KC",
			teamScore: 24,
			oppAbbr: "BUF",
			oppScore: 20,
			status: "Q4 - 6:32",
			live: true
		}),
		flash: scoreBadge({
			teamColor: "#e31837",
			teamAbbr: "KC",
			teamScore: 31,
			oppAbbr: "BUF",
			oppScore: 20,
			status: "Q4 - 4:19",
			live: true,
			flash: true
		}),
		next: nextGameBadge({
			teamColor: "#003594",
			teamAbbr: "DAL",
			oppAbbr: "PHI",
			homeAway: "home",
			when: "SUN SEP 13",
			whenDetail: "4:25 PM"
		}),
		standings: standingsBadge({
			teamColor: "#0076b6",
			teamAbbr: "DET",
			groupLabel: "NFC",
			seed: 1,
			wins: 12,
			losses: 4,
			gamesBehind: "-",
			streak: "W4"
		}),
		board: scoreBadge({
			teamColor: "#69be28",
			teamAbbr: "SEA",
			teamScore: 17,
			oppAbbr: "SF",
			oppScore: 14,
			status: "Q3 - 9:41",
			live: true,
			index: [3, 13]
		}),
		stale: scoreBadge({
			teamColor: "#4f2683",
			teamAbbr: "MIN",
			teamScore: 21,
			oppAbbr: "GB",
			oppScore: 23,
			status: "Final",
			stale: true,
			staleAge: "8m"
		})
	},
	"nhl-tracker": {
		score: scoreBadge({
			teamColor: "#00205b",
			teamAbbr: "TOR",
			teamScore: 3,
			oppAbbr: "MTL",
			oppScore: 2,
			status: "3rd - 4:12",
			live: true
		}),
		flash: scoreBadge({
			teamColor: "#00205b",
			teamAbbr: "TOR",
			teamScore: 4,
			oppAbbr: "MTL",
			oppScore: 2,
			status: "3rd - 3:50",
			live: true,
			flash: true
		}),
		next: nextGameBadge({
			teamColor: "#041e42",
			teamAbbr: "EDM",
			oppAbbr: "WPG",
			homeAway: "home",
			when: "45M",
			whenDetail: "TODAY 8:00 PM",
			imminent: true
		}),
		standings: standingsBadge({
			teamColor: "#c8102e",
			teamAbbr: "CAR",
			groupLabel: "East",
			seed: 3,
			wins: 44,
			losses: 26,
			gamesBehind: "6.0",
			streak: "W2"
		}),
		board: scoreBadge({
			teamColor: "#006847",
			teamAbbr: "DAL",
			teamScore: 1,
			oppAbbr: "STL",
			oppScore: 1,
			status: "2nd - 11:03",
			live: true,
			index: [4, 7]
		}),
		stale: scoreBadge({
			teamColor: "#fcb514",
			teamAbbr: "BOS",
			teamScore: 2,
			oppAbbr: "NYR",
			oppScore: 5,
			status: "Final",
			stale: true,
			staleAge: "15m"
		})
	},
	"soccer-tracker": {
		score: scoreBadge({
			teamColor: "#e20520",
			teamAbbr: "ARS",
			teamScore: 2,
			oppAbbr: "MCI",
			oppScore: 1,
			status: "78'",
			live: true
		}),
		flash: scoreBadge({
			teamColor: "#e20520",
			teamAbbr: "ARS",
			teamScore: 3,
			oppAbbr: "MCI",
			oppScore: 1,
			status: "84'",
			live: true,
			flash: true
		}),
		next: nextGameBadge({
			teamColor: "#004d98",
			teamAbbr: "BAR",
			oppAbbr: "RMA",
			homeAway: "home",
			when: "3H 05M",
			whenDetail: "TODAY 3:00 PM",
			imminent: true
		}),
		standings: standingsBadge({
			teamColor: "#6cabdd",
			teamAbbr: "MCI",
			groupLabel: "Premier League",
			seed: 2,
			wins: 21,
			losses: 5,
			gamesBehind: "",
			note: "71 PTS",
			streak: "W5"
		}),
		board: scoreBadge({
			teamColor: "#241f20",
			teamAbbr: "LIV",
			teamScore: 1,
			oppAbbr: "CHE",
			oppScore: 1,
			status: "HT",
			live: true,
			index: [2, 6]
		}),
		stale: scoreBadge({
			teamColor: "#fde100",
			teamAbbr: "DOR",
			teamScore: 2,
			oppAbbr: "BAY",
			oppScore: 2,
			status: "FT",
			stale: true,
			staleAge: "9m"
		})
	},
	"ufc-tracker": {
		event: eventBadge({
			accent: "#b7202e",
			kicker: "UFC",
			title: "J. Silva vs T. Reed",
			subtitle: "UFC Fight Night",
			when: "5H 20M",
			imminent: true
		}),
		live: eventBadge({
			accent: "#b7202e",
			kicker: "UFC",
			title: "J. Silva vs T. Reed",
			subtitle: "Main card",
			when: "Round 2",
			live: true
		}),
		card: entryBadge({
			accent: "#b7202e",
			kicker: "CARD",
			primary: "M. Ortiz vs D. Kane",
			secondary: "10:00 PM",
			index: [3, 12]
		}),
		result: entryBadge({
			accent: "#b7202e",
			kicker: "CARD",
			primary: "A. Novak vs R. Diaz",
			secondary: "A. Novak won",
			settled: true,
			index: [5, 12]
		})
	},
	"nascar-tracker": {
		event: eventBadge({
			accent: "#e4a11b",
			kicker: "NEXT",
			title: "Cup Series at Iowa",
			subtitle: "Iowa Speedway",
			when: "1D 6H"
		}),
		live: eventBadge({
			accent: "#e4a11b",
			kicker: "NEXT",
			title: "Cup Series at Iowa",
			subtitle: "Lap 148 of 350",
			when: "In Progress",
			live: true
		}),
		field: entryBadge({
			accent: "#e4a11b",
			kicker: "FIELD",
			primary: "C. Heim",
			secondary: "P1",
			settled: true,
			index: [1, 39]
		}),
		standings: entryBadge({
			accent: "#e4a11b",
			kicker: "CUP #1",
			primary: "D. Hamlin",
			secondary: "886 PTS",
			settled: true,
			index: [1, 40]
		})
	},
	// Sports Tracker Ultimate: the whole point is that these are all one plugin, so the faces
	// deliberately span sports rather than repeat one league six times.
	"ultimate-sports": {
		myteams: scoreBadge({
			teamColor: "#e31837",
			teamAbbr: "KC",
			teamScore: 24,
			oppAbbr: "BUF",
			oppScore: 20,
			status: "Q4 - 6:32",
			live: true,
			index: [1, 6]
		}),
		nfl: scoreBadge({
			teamColor: "#003594",
			teamAbbr: "DAL",
			teamScore: 27,
			oppAbbr: "PHI",
			oppScore: 21,
			status: "Q4 - 2:40",
			live: true
		}),
		nba: scoreBadge({
			teamColor: "#fdb927",
			teamAbbr: "LAL",
			teamScore: 108,
			oppAbbr: "GS",
			oppScore: 104,
			status: "Q4 - 2:11",
			live: true
		}),
		nhl: scoreBadge({
			teamColor: "#00205b",
			teamAbbr: "TOR",
			teamScore: 3,
			oppAbbr: "MTL",
			oppScore: 2,
			status: "3rd - 4:12",
			live: true
		}),
		mlb: scoreBadge({
			teamColor: "#0c2340",
			teamAbbr: "NYY",
			teamScore: 5,
			oppAbbr: "BOS",
			oppScore: 4,
			status: "Top 9th",
			live: true
		}),
		soccer: scoreBadge({
			teamColor: "#e20520",
			teamAbbr: "ARS",
			teamScore: 2,
			oppAbbr: "MCI",
			oppScore: 1,
			status: "78'",
			live: true
		}),
		college: scoreBadge({
			teamColor: "#9e1b32",
			teamAbbr: "ALA",
			teamScore: 31,
			oppAbbr: "UGA",
			oppScore: 28,
			status: "Q4 - 5:07",
			live: true
		}),
		next: nextGameBadge({
			teamColor: "#007a33",
			teamAbbr: "BOS",
			oppAbbr: "NY",
			homeAway: "away",
			when: "2H 15M",
			whenDetail: "TODAY 7:30 PM",
			imminent: true
		}),
		standings: standingsBadge({
			teamColor: "#0076b6",
			teamAbbr: "DET",
			groupLabel: "NFC",
			seed: 1,
			wins: 12,
			losses: 4,
			gamesBehind: "-",
			streak: "W4"
		}),
		board: scoreBadge({
			teamColor: "#98002e",
			teamAbbr: "MIA",
			teamScore: "",
			oppAbbr: "TOR",
			oppScore: "",
			status: "",
			when: { day: "FRI OCT 3", time: "4:00 PM" },
			index: [1, 12]
		}),
		ufc: eventBadge({
			accent: "#b7202e",
			kicker: "UFC",
			title: "J. Silva vs T. Reed",
			subtitle: "Main card",
			when: "Round 2",
			live: true
		}),
		f1: entryBadge({
			accent: "#e10600",
			kicker: "DRV #1",
			primary: "L. Norris",
			secondary: "331 PTS",
			settled: true,
			index: [1, 22]
		}),
		nascar: entryBadge({
			accent: "#e4a11b",
			kicker: "FIELD",
			primary: "C. Heim",
			secondary: "P1",
			settled: true,
			index: [1, 39]
		}),
		stale: scoreBadge({
			teamColor: "#4f2683",
			teamAbbr: "MIN",
			teamScore: 21,
			oppAbbr: "GB",
			oppScore: 23,
			status: "Final",
			stale: true,
			staleAge: "8m"
		})
	}
};

// A colour that vanishes against the key ground gets the same treatment here as at runtime.
void displayColor;

for (const [slug, set] of Object.entries(faces)) {
	const dir = path.join(out, slug);
	mkdirSync(dir, { recursive: true });
	for (const [name, svg] of Object.entries(set)) {
		writeFileSync(path.join(dir, `${name}.svg`), svg, "utf-8");
	}
	console.log(`${slug}: ${Object.keys(set).length} key faces`);
}
