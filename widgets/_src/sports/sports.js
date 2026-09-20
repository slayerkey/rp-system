/* Sports Tracker: live scores for a set of favourite teams across several leagues.
 *
 * Every piece of logic that decides WHAT to show is compiled from the Stream Deck
 * tracker rather than rewritten here: lib/sports-data.js is built by
 * plugins/_shared/scripts/bundle-sports-widget.mjs and exposes the ESPN client,
 * the sport registry, the poll cadence and the view helpers as SportsData. This
 * file only decides how the answer is laid out on a strip.
 *
 * ESPN's endpoints send Access-Control-Allow-Origin: *, so they are readable
 * straight from the file:// origin a widget runs at. No proxy, no key.
 *
 * Two kinds of thing can be followed, because ESPN publishes two shapes. A team plays
 * a game with a score. UFC, NASCAR and Formula 1 have no teams and no score: a card of
 * bouts or a grid of drivers, parsed by event.ts and drawn as their own kind of cell.
 * In the settings panel a team is an abbreviation and an event sport is just its name.
 *
 * The league prefix on a team is not decoration: 172 of the 805 abbreviations across
 * the eight team leagues are shared, so BAL, CLE and HOU are genuinely ambiguous and
 * "NFL:BAL" is the only way to say which one is meant.
 */

/* Six is what the rail can lay out and still stay readable in the smaller slots. */
var MAX_TEAMS = 6;
var DEFAULT_TEAMS = "NFL:KC, NBA:LAL, MLB:NYY";

/* Per-league poll bookkeeping, keyed "sport/league". */
var leagues = {};
var booted = false;

function leagueKey(lg) { return lg.sport + "/" + lg.league; }

function t(s) { return s; }

function isEventSport(cfg) {
    return !!cfg && (cfg.model === "fights" || cfg.model === "race");
}

/* --- settings --------------------------------------------------------------- */

/* One settings token to something followable, or null.
 *
 * "UFC", "F1", "NASCAR" name an event sport outright. Anything else is a team, as
 * "[LEAGUE:]ABBR"; without a league the first registered sport carrying that
 * abbreviation wins, which is why the default spells it out: it teaches the syntax. */
function resolveToken(token) {
    var raw = token.trim();
    if (!raw) return null;

    var sports = SportsData.allSports();
    var i, cfg;

    // Event sports first: they have no teams, so an abbreviation lookup can never
    // find them and a bare "UFC" would otherwise read as an unknown team.
    var wanted = raw.toLowerCase();
    for (i = 0; i < sports.length; i++) {
        cfg = sports[i];
        if (!isEventSport(cfg)) continue;
        if (wanted === cfg.id || wanted === String(cfg.label || "").toLowerCase()) {
            return { kind: "event", sportId: cfg.id };
        }
    }

    var sportId = null;
    var abbr = raw;
    var at = raw.indexOf(":");
    if (at >= 0) {
        sportId = raw.slice(0, at).trim().toLowerCase();
        abbr = raw.slice(at + 1);
    }
    abbr = abbr.trim().toUpperCase();
    if (!abbr) return null;

    for (i = 0; i < sports.length; i++) {
        cfg = sports[i];
        if (sportId && cfg.id !== sportId) continue;
        for (var j = 0; j < cfg.teams.length; j++) {
            if (cfg.teams[j].abbr.toUpperCase() === abbr) {
                return { kind: "team", ref: SportsData.qualify(cfg.id, cfg.teams[j].id) };
            }
        }
    }
    return null;
}

function favourites() {
    var raw = String(getIcueProperty("teams", DEFAULT_TEAMS) || DEFAULT_TEAMS);
    var parts = raw.split(",");
    var picks = [];
    var unresolved = 0;
    for (var i = 0; i < parts.length && picks.length < MAX_TEAMS; i++) {
        if (!parts[i].trim()) continue;
        var hit = resolveToken(parts[i]);
        if (hit) picks.push(hit); else unresolved++;
    }
    return { picks: picks, unresolved: unresolved };
}

/* The leagues the current settings actually need, and the model each one is read as.
 * Built here rather than with targetsFor(), which always adds every registered event
 * league whether or not it is being followed. */
function wantedLeagues(picks) {
    var out = {};
    for (var i = 0; i < picks.length; i++) {
        var pick = picks[i];
        var league = null;
        var model = "team";
        if (pick.kind === "event") {
            var cfg = SportsData.sportById(pick.sportId);
            if (!cfg) continue;
            league = cfg.league;
            model = cfg.model;
        } else {
            league = SportsData.leagueForRef(pick.ref);
        }
        if (league) out[leagueKey(league)] = { league: league, model: model };
    }
    return out;
}

/* --- data ------------------------------------------------------------------ */

/* Brings the running pollers in line with whatever the settings now ask for.
 *
 * Only the leagues that actually changed are touched. Every property change comes
 * through here, colours included, and tearing every source down to rebuild an
 * identical set would re-poll ESPN each time someone nudged a colour picker. */
function syncLeagues() {
    var wanted = wantedLeagues(favourites().picks);

    for (var key in leagues) {
        if (!wanted[key]) {
            leagues[key].src.stop();
            delete leagues[key];
        }
    }

    for (var want in wanted) {
        if (leagues[want]) continue;
        (function (target, key) {
            var league = target.league;
            var model = target.model;
            // A game carries its own score, so the client parses it. An event carries a
            // field, so the raw payload goes to the parser event.ts provides for it.
            var client = model === "team" ? SportsData.createEspnClient(league) : null;
            var parse = model === "fights" ? SportsData.parseFightCard : SportsData.parseRaceField;
            var entry = { model: model, items: [], lastPollMs: 0, meta: null, src: null };

            entry.src = packratSource({
                namespace: "games:" + key,
                load: function () {
                    entry.lastPollMs = Date.now();
                    if (client) return client.scoreboard();
                    return SportsData.fetchScoreboardJson(league).then(function (json) {
                        return json === null ? null : parse(json);
                    });
                },
                onUpdate: function (data, meta) {
                    entry.items = data || [];
                    entry.meta = meta;
                    render();
                }
            });

            leagues[key] = entry;
            // 15 minutes is packratSource's own floor. Its job here is to paint the
            // cached scoreboard the instant the widget opens and to act as a backstop;
            // the real cadence comes from the tier ticker below.
            entry.src.start(15);
        })(wanted[want], want);
    }
}

/* The cadence the Stream Deck tracker uses: 45s while a game is live, 10m when one
 * is close, an hour otherwise, decided per league by poller.ts's own rules rather
 * than by a second copy of them written here. */
function tick() {
    var now = Date.now();
    for (var key in leagues) {
        var entry = leagues[key];
        // tierFor reads only .state and .startIso, which a SportEvent carries too, so
        // a fight card paces itself on the same rules a game does.
        if (SportsData.isDue(entry.lastPollMs, entry.items, now)) entry.src.refresh();
    }
}

/* --- cells ------------------------------------------------------------------ */

function cellsFor(picks) {
    var out = [];
    for (var i = 0; i < picks.length; i++) {
        var pick = picks[i];
        if (pick.kind === "event") {
            var eventCfg = SportsData.sportById(pick.sportId);
            if (!eventCfg) continue;
            var eventEntry = leagues[leagueKey(eventCfg.league)];
            var current = eventEntry
                ? SportsData.currentEvent(eventEntry.items, Date.now())
                : undefined;
            out.push({
                kind: "event",
                label: eventCfg.label || eventCfg.id,
                spine: SportsData.SPORT_ACCENT[eventCfg.id] || null,
                event: current || null,
                subject: current || null
            });
            continue;
        }

        var team = SportsData.teamById(pick.ref);
        var cfg = SportsData.sportOf(pick.ref);
        if (!team || !cfg) continue;

        var entry = leagues[leagueKey(SportsData.leagueForRef(pick.ref) || cfg.league)];
        var game = entry ? SportsData.gameForTeam(entry.items, team.id) : undefined;
        out.push({
            kind: "team",
            team: team,
            label: cfg.label || cfg.id,
            spine: SportsData.displayColor(team.color, team.altColor),
            game: game || null,
            sides: game ? SportsData.sidesFor(game, team.id) : null,
            subject: game || null
        });
    }
    return order(out);
}

/* Live first, then whatever starts soonest, then finals, then anything with nothing
 * on. The ordering inside the first three groups is sortForBoard's, so the rail reads
 * the same way the plugin's scoreboard key does. Games and events sort together:
 * sortForBoard reads only .state and .startIso, which both shapes carry. */
function order(cells) {
    var active = [];
    var idle = [];
    for (var i = 0; i < cells.length; i++) {
        if (cells[i].subject) active.push(cells[i]); else idle.push(cells[i]);
    }
    var sorted = SportsData.sortForBoard(active.map(function (c) { return c.subject; }));
    active.sort(function (a, b) {
        return sorted.indexOf(a.subject) - sorted.indexOf(b.subject);
    });
    return active.concat(idle);
}

/* --- render ----------------------------------------------------------------- */

function esc(s) {
    return String(s === null || s === undefined ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sideHtml(side, abbr, trailing) {
    return '<div class="side' + (trailing ? " trailing" : "") + '">'
         + '<span class="side-abbr">' + esc(abbr) + '</span>'
         + '<span class="side-score">' + esc(side.score) + '</span>'
         + '</div>';
}

/* A card or a race weekend. The event's own name is the identity, and the answer is
 * whatever the field says right now: the main event before the first bell, the leader
 * once it is running. Entries are already in the right order, main event and race
 * leader first, so entry zero is always the line worth showing. */
function eventBodyHtml(cell, now) {
    var event = cell.event;

    if (!event) {
        return '<div class="cell-team">' + esc(cell.label) + '</div>'
             + '<div class="cell-status idle label">' + t("Nothing scheduled") + '</div>';
    }

    var name = event.shortName || event.name;
    var lead = event.entries && event.entries.length ? event.entries[0] : null;
    var head = '<div class="cell-team">' + esc(name) + '</div>';

    // Before the off there is often no field published yet, which is a real state and
    // not an error: the countdown is the answer, exactly as it is for a fixture.
    if (event.state === "pre" || !lead) {
        var left = SportsData.countdown(event.startIso, now);
        var when = SportsData.startLines(event.startIso);
        return head
             + '<div class="countdown">' + esc(left || when.day) + '</div>'
             + '<div class="cell-status label">' + esc(when.day + " " + when.time) + '</div>';
    }

    var note = lead.secondary || event.statusShort;
    return head
         + '<div class="event-lead">' + esc(lead.primary) + '</div>'
         + '<div class="cell-status label">' + esc(note) + '</div>';
}

function bodyHtml(cell, now) {
    if (cell.kind === "event") return eventBodyHtml(cell, now);

    var game = cell.game;

    if (!game || !cell.sides) {
        return '<div class="cell-team">' + esc(cell.team.abbr) + '</div>'
             + '<div class="cell-status idle label">' + t("No game today") + '</div>';
    }

    var own = cell.sides.own;
    var opp = cell.sides.opp;
    var oppTeam = own.homeAway === "home" ? game.away : game.home;

    if (game.state === "pre") {
        // A bare kick-off time reads as "now" at a glance, so a game far enough out
        // carries its date instead of a countdown.
        var left = SportsData.countdown(game.startIso, now);
        var when = SportsData.startLines(game.startIso);
        var at = own.homeAway === "home" ? "vs " : "@ ";
        return '<div class="cell-team">' + esc(own.abbr || cell.team.abbr) + '</div>'
             + '<div class="matchup">' + esc(at + oppTeam.abbr) + '</div>'
             + '<div class="countdown">' + esc(left || when.day) + '</div>'
             + '<div class="cell-status label">' + esc(when.day + " " + when.time) + '</div>';
    }

    var ownNum = Number(own.score);
    var oppNum = Number(opp.score);
    return sideHtml(own, own.abbr || cell.team.abbr, ownNum < oppNum)
         + sideHtml(opp, oppTeam.abbr, oppNum < ownNum)
         + '<div class="cell-status label">' + esc(game.statusShort) + '</div>';
}

function cellHtml(cell, now) {
    // An event sport has no team colour to borrow, so it uses the accent the plugin
    // already assigns it. displayColor still runs, to keep a near-black off the spine.
    var spine = SportsData.displayColor(cell.spine || "", null);
    var live = cell.subject && cell.subject.state === "in";
    return '<div class="cell" style="--cell-spine:' + esc(spine) + '">'
         + '<div class="cell-head">'
         + '<span class="cell-league label">' + esc(cell.label) + '</span>'
         + (live ? '<span class="live-dot"></span>' : "")
         + '</div>'
         + bodyHtml(cell, now)
         + '</div>';
}

/* The oldest payload across the leagues, so the header tells the truth when only
 * one of them has gone quiet. */
function staleness() {
    var worst = null;
    for (var key in leagues) {
        var meta = leagues[key].meta;
        if (!meta || !meta.stale) continue;
        if (worst === null || (meta.ageMs || 0) > worst) worst = meta.ageMs || 0;
    }
    return worst;
}

function render() {
    var host = document.getElementById("rail");
    var status = document.getElementById("status");
    var now = Date.now();
    var picked = favourites();
    var cells = cellsFor(picked.picks);

    if (!cells.length) {
        // Naming a team that does not resolve is a typo the user can only fix if the
        // widget says so; silently showing nothing looks like a broken product.
        host.innerHTML = '<div class="empty">'
            + (picked.unresolved ? t("No teams recognised. Check the Teams setting.")
                                 : t("Waiting for scores."))
            + "</div>";
        status.textContent = "";
        status.className = "label";
        return;
    }

    host.innerHTML = cells.map(function (c) { return cellHtml(c, now); }).join("");

    var stale = staleness();
    if (stale !== null) {
        status.textContent = t("Offline") + " · " + packratAgo(stale);
        status.className = "label stale";
    } else {
        status.textContent = "";
        status.className = "label";
    }
}

/* --- wiring ----------------------------------------------------------------- */

// A settings change can arrive per keystroke while someone types a team list, and
// each one may add a league. Coalesce before touching the network.
var resync = rateLimit(syncLeagues, 1500);

packratEvents(function () { render(); resync(); });

packratBoot(function () {
    document.getElementById("title").textContent = t("Sports");
    // Teams are compiled in, so the rail paints identity immediately and never shows
    // an empty frame while the first request is in flight.
    render();
    if (booted) return;
    booted = true;
    syncLeagues();
    setInterval(tick, SportsData.BASE_TICK_MS);
});
