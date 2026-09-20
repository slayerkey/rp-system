"""Generate a tracker's src/teams.ts (and refresh its fixtures) from ESPN.

One command per sport. Names, abbreviations and colours come from the /teams payload; the
conference and division grouping comes from the level=3 standings payload, which is the only
ESPN response that carries it.

The table ships baked into the bundle rather than fetched at runtime: a roster changes about
once a decade, the first key can paint before any network call, and the team picker works
offline.

    python plugins/_shared/scripts/gen_teams.py nba-tracker basketball nba
    python plugins/_shared/scripts/gen_teams.py nfl-tracker football nfl
    python plugins/_shared/scripts/gen_teams.py soccer-tracker soccer eng.1 --no-standings
"""
import argparse
import json
import os
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
FIXTURES = os.path.join(ROOT, "plugins", "_shared", "test-fixtures")
SITE = "https://site.api.espn.com/apis/site/v2/sports"
CORE = "https://site.api.espn.com/apis/v2/sports"

# ESPN's team feed and level=3 standings can briefly disagree about conference placement.
# Repairs are intentionally tiny and keyed by stable ESPN team IDs so --only-grouped does not
# silently delete a real FBS team when the standings payload omits it.
GROUP_REPAIRS = {
    ("football", "college-football", "2633"): ("sec", "Southeastern Conference"),  # Tennessee
}


def fetch(url):
    req = urllib.request.Request(url, headers={"accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def save_fixture(name, payload):
    os.makedirs(FIXTURES, exist_ok=True)
    path = os.path.join(FIXTURES, name)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False)
    return path


def hexed(raw, fallback):
    s = (raw or "").strip().lstrip("#").lower()
    return f"#{s}" if len(s) == 6 else fallback


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", help="plugin folder under plugins/, e.g. nfl-tracker")
    ap.add_argument("sport", help="ESPN sport path segment, e.g. football")
    ap.add_argument("league", help="ESPN league path segment, e.g. nfl")
    ap.add_argument("--no-standings", action="store_true",
                    help="league has no conference/division tree; group everything as one list")
    ap.add_argument("--group", default="", help="group label to use when standings are skipped")
    ap.add_argument("--out", default="src/teams.ts",
                    help="path under plugins/<slug>/ to write, for a plugin holding several tables")
    ap.add_argument("--var", default="TEAMS", help="exported constant name")
    ap.add_argument("--only-grouped", action="store_true",
                    help="drop teams the standings do not place. College football's /teams returns "
                         "every division while its standings cover only FBS, so this is what keeps "
                         "a 500 row payload down to the teams anyone is actually following.")
    args = ap.parse_args()

    key = args.league.replace(".", "-")
    teams_payload = fetch(f"{SITE}/{args.sport}/{args.league}/teams?limit=500")
    save_fixture(f"{key}-teams.json", teams_payload)

    groups = {}
    if not args.no_standings:
        standings = fetch(f"{CORE}/{args.sport}/{args.league}/standings?level=3")
        save_fixture(f"{key}-standings-div.json", standings)
        for conf in standings.get("children", []):
            kids = conf.get("children") or [conf]
            for div in kids:
                for entry in (div.get("standings") or {}).get("entries", []):
                    groups[entry["team"]["id"]] = (
                        conf.get("abbreviation") or conf.get("name", ""),
                        div.get("name", ""),
                    )

    rows = []
    for wrapper in teams_payload["sports"][0]["leagues"][0]["teams"]:
        t = wrapper["team"]
        if t.get("isActive") is False:
            continue
        conference, division = groups.get(t["id"], (args.group, ""))
        if not conference:
            conference, division = GROUP_REPAIRS.get(
                (args.sport, args.league, t["id"]),
                (conference, division),
            )
        rows.append({
            "id": t["id"],
            "abbr": t.get("abbreviation") or t.get("shortDisplayName", "")[:4].upper(),
            "name": t.get("displayName", ""),
            "color": hexed(t.get("color"), "#1b1f27"),
            "altColor": hexed(t.get("alternateColor"), "#f5faf8"),
            "conference": conference,
            "division": division,
        })

    # Alphabetical inside each group. Division order would look arbitrary to anyone scanning
    # the picker for their team, which is the only job this list has.
    rows.sort(key=lambda r: (r["conference"], r["name"]))

    ungrouped = [r["abbr"] for r in rows if not r["conference"]]
    if ungrouped and not args.no_standings:
        if args.only_grouped:
            rows = [r for r in rows if r["conference"]]
            print(f"  dropped {len(ungrouped)} teams the standings do not place")
        else:
            print(f"  warning: no conference for {ungrouped}")

    out = os.path.join(ROOT, "plugins", args.slug, *args.out.split("/"))
    # One ".." per path segment in --out, which walks back up to plugins/ from any table depth:
    # "src/teams.ts" is two segments and needs "../..", "src/teams/nba.ts" three and needs "../../..".
    up = "/".join([".."] * len(args.out.split("/")))
    lines = [
        "/**",
        f" * {args.league.upper()} teams, generated from ESPN by plugins/_shared/scripts/gen_teams.py.",
        " * Do not hand edit: rerun the script to refresh.",
        " *",
        " * Colours are the official team colours, used as the key's colour spine. They are the only",
        " * team branding this product ever renders. No logos, crests or wordmarks, anywhere.",
        " */",
        f'import type {{ SportTeam }} from "{up}/_shared/src/sport";',
        "",
        f"export const {args.var}: SportTeam[] = [",
    ]
    for r in rows:
        lines.append(
            '\t{ id: "%s", abbr: "%s", name: "%s", color: "%s", altColor: "%s", '
            'conference: "%s", division: "%s" },'
            % (r["id"], r["abbr"], r["name"].replace('"', ""), r["color"], r["altColor"],
               r["conference"], r["division"])
        )
    lines += ["];", ""]

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(f"wrote {len(rows)} teams to {out}")


if __name__ == "__main__":
    main()
