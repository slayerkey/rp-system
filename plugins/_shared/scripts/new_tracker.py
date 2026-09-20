"""Scaffold a team-sport tracker plugin from the proven NBA Tracker layout.

Writes the boilerplate that is identical across trackers: package.json, tsconfig, the Rollup
config with both of its load-bearing settings, the manifest, the three property inspector pages,
the plugin entry point, and the icon script. What it does not write is the part that differs:
the team table (plugins/_shared/scripts/gen_teams.py) and the listing copy.

    python plugins/_shared/scripts/new_tracker.py nfl-tracker "NFL Tracker" football nfl \
        --glyph ball-american-football --league-name "the NFL"

Then:
    python plugins/_shared/scripts/gen_teams.py nfl-tracker football nfl
    python plugins/nfl-tracker/scripts/gen-icons.py
    cd plugins/nfl-tracker && npm install && npm run build && npx streamdeck validate <uuid>.sdPlugin
"""
import argparse
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text if text.endswith("\n") else text + "\n")


def build(slug, name, sport, league, uuid, glyph, league_name, group_noun, score_noun):
    base = os.path.join(ROOT, "plugins", slug)
    sd = os.path.join(base, f"{uuid}.sdPlugin")

    write(os.path.join(base, "package.json"), json.dumps({
        "name": slug,
        "version": "1.0.0",
        "private": True,
        "scripts": {
            "build": "rollup -c",
            "watch": f'rollup -c -w --watch.onEnd="streamdeck restart {uuid}"',
            "test": "npm --prefix ../_shared test",
        },
        "type": "module",
        "devDependencies": {
            "@elgato/cli": "^1.7.4",
            "@elgato/utils": "^0.4.5",
            "@rollup/plugin-commonjs": "^29.0.2",
            "@rollup/plugin-node-resolve": "^15.2.2",
            "@rollup/plugin-terser": "^1.0.0",
            "@rollup/plugin-typescript": "^12.1.0",
            "@tsconfig/node20": "^20.1.2",
            "@types/node": "~24.1.0",
            "rollup": "^4.0.2",
            "tslib": "^2.6.2",
            "tsx": "^4.23.1",
            "typescript": "^5.2.2",
        },
        "dependencies": {"@elgato/streamdeck": "^2.1.0"},
    }, indent="\t"))

    write(os.path.join(base, "tsconfig.json"), json.dumps({
        "extends": "@tsconfig/node20/tsconfig.json",
        "compilerOptions": {
            "customConditions": ["node"],
            "module": "ES2022",
            "moduleResolution": "Bundler",
            "noImplicitOverride": True,
        },
        "include": ["src/**/*.ts", "../_shared/src/**/*.ts"],
        "exclude": ["node_modules", "../_shared/src/**/*.test.ts"],
    }, indent="\t"))

    write(os.path.join(base, "rollup.config.mjs"), f'''import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "{uuid}.sdPlugin";

/**
 * Pulls in plugins/_shared/src (the ESPN client, poller, actions and key renderer that every
 * Packrat sport tracker uses) by relative import and bundles it into the single plugin.js. No
 * native code anywhere: data comes from fetch and key faces are SVG strings, so the same bundle
 * runs on Windows and macOS.
 *
 * @type {{import('rollup').RollupOptions}}
 */
const config = {{
	input: "src/plugin.ts",
	output: {{
		dir: `${{sdPlugin}}/bin`,
		entryFileNames: "plugin.js",
		format: "es",
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {{
			return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
		}}
	}},
	plugins: [
		{{
			name: "watch-externals",
			buildStart: function () {{
				this.addWatchFile(`${{sdPlugin}}/manifest.json`);
			}}
		}},
		typescript({{
			mapRoot: isWatching ? "./" : undefined,
			// The plugin only transforms files under its own root by default, which would leave
			// the shared module's TypeScript for Rollup's JavaScript parser to choke on.
			include: ["src/**/*.ts", "../_shared/src/**/*.ts"]
		}}),
		nodeResolve({{
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true,
			// The shared tracker core is imported as source from ../_shared/src, so resolution
			// has to know about .ts; the default extensions stop at .js.
			extensions: [".ts", ".mjs", ".js", ".json", ".node"],
			// Load bearing. ../_shared has its own node_modules for its tests, so without dedupe
			// the shared files resolve the SDK to that copy and the bundle ends up with two
			// instances: two Connection singletons, one of which is never registered. The
			// symptom is nasty, every settings call from shared code hangs forever with no error.
			dedupe: ["@elgato/streamdeck", "@elgato/utils", "ws"]
		}}),
		commonjs(),
		!isWatching && terser(),
		{{
			name: "emit-module-package-file",
			generateBundle() {{
				this.emitFile({{ fileName: "package.json", source: `{{ "type": "module" }}`, type: "asset" }});
			}}
		}}
	]
}};

export default config;
''')

    write(os.path.join(base, ".gitignore"), f"node_modules/\n{uuid}.sdPlugin/logs/\n{uuid}.sdPlugin/bin/\n*.streamDeckPlugin\n")

    write(os.path.join(base, "src", "plugin.ts"), f'''import streamDeck, {{ action }} from "@elgato/streamdeck";

import {{ ScoreboardBase }} from "../../_shared/src/actions/scoreboard";
import {{ StandingsBase }} from "../../_shared/src/actions/standings";
import {{ TeamScoreBase }} from "../../_shared/src/actions/team-score";
import {{ configureSport }} from "../../_shared/src/sport";
import {{ startTracking }} from "../../_shared/src/tracker";
import {{ TEAMS }} from "./teams";

streamDeck.logger.setLevel("info");

// Everything sport specific about this plugin lives in this one call. The actions, the polling,
// the key faces and the settings protocol are all shared with the other trackers.
configureSport({{ league: {{ sport: "{sport}", league: "{league}" }}, teams: TEAMS }});

@action({{ UUID: "{uuid}.score" }})
class TeamScore extends TeamScoreBase {{}}

@action({{ UUID: "{uuid}.standings" }})
class Standings extends StandingsBase {{}}

@action({{ UUID: "{uuid}.scoreboard" }})
class Scoreboard extends ScoreboardBase {{}}

const score = new TeamScore();
const standings = new Standings();
const scoreboard = new Scoreboard();

streamDeck.actions.registerAction(score);
streamDeck.actions.registerAction(standings);
streamDeck.actions.registerAction(scoreboard);

// Polling has to wait for the connection: the first thing a poll does is write the cache to
// global settings, and that call simply never resolves if the websocket is not up yet.
streamDeck.connect().then(() => startTracking([score, standings, scoreboard]));
''')

    write(os.path.join(base, "scripts", "gen-icons.py"), f'''"""Action and plugin icons for {name}, via the shared generator.

Run from anywhere:  python plugins/{slug}/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="{slug}",
    uuid="{uuid}",
    actions={{"score": "{glyph}", "standings": "list-numbers", "scoreboard": "layout-grid"}},
    plugin_glyph="{glyph}",
)
''')

    manifest = {
        "Name": name,
        "Version": "1.0.0.0",
        "Author": "Packrat",
        "Actions": [
            {
                "Name": "Team Score",
                "UUID": f"{uuid}.score",
                "Icon": "imgs/actions/score/icon",
                "Tooltip": f"Live {score_noun} for your team, with a countdown to the next {score_noun} when none is on. "
                           "Press to refresh, or set it to open the game page.",
                "PropertyInspectorPath": "ui/score.html",
                "Controllers": ["Keypad"],
                "States": [{"Image": "imgs/actions/score/key", "TitleAlignment": "bottom"}],
            },
            {
                "Name": "Standings",
                "UUID": f"{uuid}.standings",
                "Icon": "imgs/actions/standings/icon",
                "Tooltip": f"Where your team sits in the {group_noun} or its division. Press to swap the view.",
                "PropertyInspectorPath": "ui/standings.html",
                "Controllers": ["Keypad"],
                "States": [{"Image": "imgs/actions/standings/key", "TitleAlignment": "bottom"}],
            },
            {
                "Name": "League Scoreboard",
                "UUID": f"{uuid}.scoreboard",
                "Icon": "imgs/actions/scoreboard/icon",
                "Tooltip": "Every game playing today on one key, live games first. Press for the next one.",
                "PropertyInspectorPath": "ui/scoreboard.html",
                "Controllers": ["Keypad"],
                "States": [{"Image": "imgs/actions/scoreboard/key", "TitleAlignment": "bottom"}],
            },
        ],
        "Category": name,
        "CategoryIcon": "imgs/plugin/category-icon",
        "CodePath": "bin/plugin.js",
        "Description": (
            f"Keep the game on your deck. Live scores, start times, and where your team stands, updating on "
            f"their own while you play or stream. No alt-tabbing to check the score. Not affiliated with or "
            f"endorsed by {league_name} or any team."
        ),
        "Icon": "imgs/plugin/marketplace",
        "SDKVersion": 3,
        "Software": {"MinimumVersion": "6.9"},
        "OS": [
            {"Platform": "windows", "MinimumVersion": "10"},
            {"Platform": "mac", "MinimumVersion": "12"},
        ],
        "Nodejs": {"Version": "20", "Debug": "enabled"},
        "UUID": uuid,
    }
    write(os.path.join(sd, "manifest.json"), json.dumps(manifest, indent="\t", ensure_ascii=False))

    # The property inspector is byte identical across trackers apart from the disclaimer, so it
    # is copied from the NBA plugin rather than restated here.
    nba_ui = os.path.join(ROOT, "plugins", "nba-tracker", "com.packrat.nba-tracker.sdPlugin", "ui")
    disclaimer_from = "the NBA"
    for fname in ("pi.js", "pi.css", "score.html", "standings.html", "scoreboard.html"):
        with open(os.path.join(nba_ui, fname), encoding="utf-8") as f:
            body = f.read()
        write(os.path.join(sd, "ui", fname), body.replace(disclaimer_from, league_name))

    print(f"scaffolded plugins/{slug}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("name", help='listing name, e.g. "NFL Tracker"')
    ap.add_argument("sport", help="ESPN sport path segment")
    ap.add_argument("league", help="ESPN league path segment")
    ap.add_argument("--uuid", default=None)
    ap.add_argument("--glyph", default="ball-basketball", help="Tabler glyph for the icons")
    ap.add_argument("--league-name", default="the league", help="used in the non-affiliation line")
    ap.add_argument("--group-noun", default="conference")
    ap.add_argument("--score-noun", default="score")
    args = ap.parse_args()
    build(args.slug, args.name, args.sport, args.league, args.uuid or f"com.packrat.{args.slug}",
          args.glyph, args.league_name, args.group_noun, args.score_noun)


if __name__ == "__main__":
    main()
