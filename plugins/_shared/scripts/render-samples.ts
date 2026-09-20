/**
 * Writes one SVG per key face into ./samples so the layout can be eyeballed without a Stream
 * Deck attached. Handy when tuning a badge: the tests prove the text is there, this shows
 * whether it fits.
 *
 *   npm run samples [outDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
	displayColor,
	entryBadge,
	eventBadge,
	messageBadge,
	nextGameBadge,
	scoreBadge,
	standingsBadge
} from "../src/badge";

const out = process.argv[2] ?? "samples";
mkdirSync(out, { recursive: true });

const faces: Record<string, string> = {
	"score-live": scoreBadge({
		teamColor: "#1d428a",
		teamAbbr: "NY",
		teamScore: 107,
		oppAbbr: "SA",
		oppScore: 106,
		status: "Q3 - 5:32",
		live: true
	}),
	"score-final-stale": scoreBadge({
		teamColor: "#c8102e",
		teamAbbr: "ATL",
		teamScore: 98,
		oppAbbr: "MEM",
		oppScore: 101,
		status: "Final",
		stale: true
	}),
	// Brooklyn's official primary is black, which is why displayColor exists.
	"score-dark-team": scoreBadge({
		teamColor: displayColor("#000000", "#ffffff"),
		teamAbbr: "BKN",
		teamScore: 88,
		oppAbbr: "BOS",
		oppScore: 92,
		status: "Q4 - 0:48",
		live: true
	}),
	"next-home": nextGameBadge({
		teamColor: "#fdb927",
		teamAbbr: "LAL",
		oppAbbr: "GS",
		homeAway: "home",
		when: "WED OCT 7",
		whenDetail: "7:30 PM"
	}),
	"next-away": nextGameBadge({
		teamColor: "#008348",
		teamAbbr: "BOS",
		oppAbbr: "PHI",
		homeAway: "away",
		when: "TODAY",
		whenDetail: "10:00 PM"
	}),
	"standings-conference": standingsBadge({
		teamColor: "#008348",
		teamAbbr: "BOS",
		groupLabel: "East",
		seed: 2,
		wins: 56,
		losses: 26,
		gamesBehind: "4.0"
	}),
	"standings-division-leader": standingsBadge({
		teamColor: "#5d76a9",
		teamAbbr: "MIN",
		groupLabel: "Northwest",
		seed: 1,
		wins: 49,
		losses: 33,
		gamesBehind: "-"
	}),
	"message-pick": messageBadge({ title: "PICK TEAM", detail: "in settings" }),
	"message-nogame": messageBadge({ title: "NO GAME", detail: "next 30 days", stale: true }),
	// The states added for v1.1: a score change, a countdown, an aged cache, the league board.
	"score-flash": scoreBadge({
		teamColor: "#1d428a",
		teamAbbr: "NY",
		teamScore: 109,
		oppAbbr: "SA",
		oppScore: 106,
		status: "Q4 - 2:10",
		live: true,
		flash: true
	}),
	"score-stale-age": scoreBadge({
		teamColor: "#c8102e",
		teamAbbr: "MIA",
		teamScore: 88,
		oppAbbr: "TOR",
		oppScore: 91,
		status: "Q3 - 4:02",
		stale: true,
		staleAge: "12m"
	}),
	"next-countdown": nextGameBadge({
		teamColor: "#98002e",
		teamAbbr: "MIA",
		oppAbbr: "TOR",
		homeAway: "away",
		when: "2H 15M",
		whenDetail: "TODAY 7:30 PM",
		imminent: true
	}),
	"board-live": scoreBadge({
		teamColor: "#fdb927",
		teamAbbr: "LAL",
		teamScore: 54,
		oppAbbr: "GS",
		oppScore: 61,
		status: "Q2 - 3:44",
		live: true,
		index: [2, 8]
	}),
	"board-upcoming": scoreBadge({
		teamColor: "#007a33",
		teamAbbr: "BOS",
		teamScore: "",
		oppAbbr: "PHI",
		oppScore: "",
		status: "",
		when: { time: "7:30 PM" },
		index: [5, 8]
	}),
	// Out of season the board shows the next match day, which can be weeks out.
	"board-offseason": scoreBadge({
		teamColor: "#98002e",
		teamAbbr: "MIA",
		teamScore: "",
		oppAbbr: "TOR",
		oppScore: "",
		status: "",
		when: { day: "FRI OCT 3", time: "4:00 PM" },
		index: [1, 12]
	}),
	"standings-streak": standingsBadge({
		teamColor: "#98002e",
		teamAbbr: "MIA",
		groupLabel: "Southeast",
		seed: 4,
		wins: 44,
		losses: 38,
		gamesBehind: "12.0",
		streak: "W3"
	}),
	// The event model: fight cards and race weekends, which have no score and no win-loss table.
	"event-next": eventBadge({
		accent: "#b7202e",
		kicker: "UFC",
		title: "Gaethje vs Pimblett",
		subtitle: "UFC 324",
		when: "SAT 10:00 PM"
	}),
	"event-imminent": eventBadge({
		accent: "#e4a11b",
		kicker: "Next",
		title: "Daytona 500",
		subtitle: "Cup Series",
		when: "45M",
		imminent: true
	}),
	"event-live": eventBadge({
		accent: "#b7202e",
		kicker: "UFC",
		title: "Main Card",
		subtitle: "Round 2",
		when: "LIVE NOW",
		live: true
	}),
	"entry-bout": entryBadge({
		accent: "#b7202e",
		kicker: "UFC",
		primary: "Gaethje vs Pimblett",
		secondary: "Gaethje won",
		settled: true,
		index: [1, 12]
	}),
	"entry-driver": entryBadge({
		accent: "#e4a11b",
		kicker: "Cup",
		primary: "Kyle Larson",
		secondary: "P3",
		index: [3, 37]
	}),
	"entry-standings": entryBadge({
		accent: "#e4a11b",
		kicker: "Cup",
		primary: "William Byron",
		secondary: "4210 PTS",
		index: [1, 40],
		stale: true
	}),
	// A short driver name is the case that used to leave half the key empty.
	"entry-f1": entryBadge({
		accent: "#e10600",
		kicker: "DRV #5",
		primary: "L. Norris",
		secondary: "128 PTS",
		index: [5, 22]
	})
};

for (const [name, svg] of Object.entries(faces)) {
	writeFileSync(path.join(out, `${name}.svg`), svg, "utf-8");
}
console.log(`wrote ${Object.keys(faces).length} key faces to ${path.resolve(out)}`);
