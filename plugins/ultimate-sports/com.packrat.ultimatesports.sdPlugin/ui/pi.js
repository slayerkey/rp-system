/**
 * Property inspector for all eight actions, one file driven by document.body.dataset.kind.
 * Talks the Stream Deck PI websocket directly, so the plugin ships no third-party UI code.
 *
 * Everything this UI needs lives in the plugin bundle rather than here: the team catalogue spans
 * eleven leagues and would be a second copy to maintain. On open the PI asks for whatever the page
 * needs (probe: "sports" / "teams" / "competitions" / "favorites") and renders the reply.
 *
 * The favourites list is the one control that does not write to key settings. It is global, shared
 * by every key on the deck, so it round trips through the plugin instead.
 */

let websocket = null;
let uuid = null;
let actionUuid = null;
let settings = {};
let teams = [];
let sports = [];
let competitions = [];
let favorites = [];

/** Picker narrowing. Eight hundred teams in one dropdown is not a list, it is a haystack. */
let search = "";
let groupFilter = "";

const kind = () => document.body.dataset.kind;

// eslint-disable-next-line no-unused-vars
function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
	uuid = inUUID;
	try {
		const info = JSON.parse(inActionInfo);
		settings = info.payload.settings ?? {};
		actionUuid = info.action;
	} catch {
		settings = {};
	}

	websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
	websocket.onopen = () => {
		websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
		build();
		render();
		if (document.getElementById("sport")) askPlugin({ probe: "sports" });
		if (document.getElementById("team")) askPlugin({ probe: "teams" });
		if (kind() === "myteams") askPlugin({ probe: "favorites" });
		if (settings.sportId) askPlugin({ probe: "competitions", sportId: settings.sportId });
	};
	websocket.onmessage = (e) => {
		const msg = JSON.parse(e.data);
		if (msg.event === "didReceiveSettings") {
			settings = msg.payload.settings ?? {};
			render();
		} else if (msg.event === "sendToPropertyInspector") {
			onPluginMessage(msg.payload ?? {});
		}
	};
}

function save() {
	if (websocket?.readyState === WebSocket.OPEN) {
		websocket.send(JSON.stringify({ event: "setSettings", context: uuid, payload: settings }));
	}
}

function askPlugin(payload) {
	if (websocket?.readyState === WebSocket.OPEN) {
		websocket.send(JSON.stringify({ event: "sendToPlugin", context: uuid, action: actionUuid, payload }));
	}
}

function onPluginMessage(payload) {
	if (payload.probe === "teams") teams = payload.teams ?? [];
	else if (payload.probe === "sports") sports = payload.sports ?? [];
	else if (payload.probe === "competitions") competitions = payload.competitions ?? [];
	else if (payload.probe === "favorites") favorites = payload.favorites ?? [];
	else return;
	render();
}

function escapeHtml(s) {
	return String(s).replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
	);
}

/** Name for a saved favourite, which is stored as a bare reference like "nfl::12". */
function labelFor(ref) {
	const hit = teams.find((t) => t.id === ref);
	return hit ? `${hit.group} · ${hit.name}` : ref;
}

function optionsHtml(list, placeholder) {
	return (
		`<option value="">${escapeHtml(placeholder)}</option>` +
		list.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`).join("")
	);
}

/** Every distinct group the plugin sent, which in the combined plugin is one per sport. */
function groupNames() {
	const seen = [];
	for (const t of teams) if (!seen.includes(t.group)) seen.push(t.group);
	return seen;
}

function matches(team) {
	if (groupFilter && team.group !== groupFilter) return false;
	if (!search) return true;
	const needle = search.toLowerCase();
	return team.name.toLowerCase().includes(needle) || team.abbr.toLowerCase().includes(needle);
}

/** Teams grouped the way the plugin sent them: by sport when several are registered. */
function teamOptionsHtml(selected) {
	const shown = teams.filter(matches);
	// A selection that the current filter hides still has to stay in the list, or changing the
	// filter would silently blank the key's saved team.
	if (selected && !shown.some((t) => t.id === selected)) {
		const kept = teams.find((t) => t.id === selected);
		if (kept) shown.unshift(kept);
	}

	const groups = [];
	for (const t of shown) {
		let group = groups.find((g) => g.name === t.group);
		if (!group) groups.push((group = { name: t.group, items: [] }));
		group.items.push(t);
	}

	const placeholder = shown.length === 0 ? "No team matches" : `Pick a team… (${shown.length})`;
	const html =
		`<option value="">${escapeHtml(placeholder)}</option>` +
		groups
			.map(
				(g) =>
					`<optgroup label="${escapeHtml(g.name)}">` +
					g.items.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("") +
					"</optgroup>"
			)
			.join("");
	return { html, selected };
}

function renderFavorites() {
	const list = document.getElementById("favs");
	if (!list) return;
	if (favorites.length === 0) {
		list.innerHTML = '<li class="empty">No teams yet. Pick one above and press Add.</li>';
		return;
	}
	list.innerHTML = favorites
		.map(
			(ref, i) =>
				`<li><span>${escapeHtml(labelFor(ref))}</span>` +
				`<button type="button" class="remove" data-at="${i}" aria-label="Remove ${escapeHtml(labelFor(ref))}">Remove</button></li>`
		)
		.join("");
	for (const button of list.querySelectorAll(".remove")) {
		button.addEventListener("click", () => {
			favorites.splice(Number(button.dataset.at), 1);
			askPlugin({ favorites });
			renderFavorites();
		});
	}
}

function render() {
	const picker = document.getElementById("team");
	if (picker && teams.length) {
		const built = teamOptionsHtml(settings.teamId ?? "");
		picker.innerHTML = built.html;
		// The favourites page uses the picker as an "add" control, so it never shows a selection.
		picker.value = kind() === "myteams" ? "" : built.selected;
	}

	const filter = document.getElementById("sport-filter");
	if (filter && teams.length && filter.options.length <= 1) {
		filter.innerHTML =
			'<option value="">All sports</option>' +
			groupNames().map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
		filter.value = groupFilter;
	}

	const sport = document.getElementById("sport");
	if (sport && sports.length) {
		sport.innerHTML = optionsHtml(sports, "Pick a sport…");
		sport.value = settings.sportId ?? "";
	}

	const league = document.getElementById("league");
	const leagueRow = document.getElementById("league-row");
	if (league) {
		league.innerHTML = optionsHtml(competitions, "All of it");
		league.value = settings.leagueId ?? "";
		// Only soccer offers a real choice; one competition means the row is noise.
		if (leagueRow) leagueRow.style.display = competitions.length > 1 ? "" : "none";
	}

	const view = document.getElementById("view");
	if (view) view.value = settings.view === "division" ? "division" : "conference";

	const press = document.getElementById("press");
	if (press) press.value = settings.onPress ?? press.options[0].value;

	const covered = document.getElementById("covered");
	if (covered && sports.length) {
		const chosen = new Set(settings.sports ?? []);
		covered.innerHTML = sports
			.map(
				(s) =>
					`<label class="check"><input type="checkbox" value="${escapeHtml(s.id)}"` +
					`${chosen.has(s.id) ? " checked" : ""} /> ${escapeHtml(s.name)}</label>`
			)
			.join("");
		for (const box of covered.querySelectorAll("input")) {
			box.addEventListener("change", () => {
				const picked = [...covered.querySelectorAll("input")].filter((b) => b.checked).map((b) => b.value);
				settings.sports = picked.length ? picked : undefined;
				save();
			});
		}
	}

	renderFavorites();
}

function build() {
	document.getElementById("search")?.addEventListener("input", (e) => {
		search = e.target.value.trim();
		render();
	});

	document.getElementById("sport-filter")?.addEventListener("change", (e) => {
		groupFilter = e.target.value;
		render();
	});

	document.getElementById("team")?.addEventListener("change", (e) => {
		if (kind() === "myteams") return;
		settings.teamId = e.target.value || undefined;
		save();
	});

	document.getElementById("add")?.addEventListener("click", () => {
		const picker = document.getElementById("team");
		const ref = picker?.value;
		if (!ref || favorites.includes(ref)) return;
		favorites = [...favorites, ref];
		askPlugin({ favorites });
		picker.value = "";
		renderFavorites();
	});

	document.getElementById("sport")?.addEventListener("change", (e) => {
		settings.sportId = e.target.value || undefined;
		// A new sport means a new competition list, and the old selection cannot survive it.
		settings.leagueId = undefined;
		competitions = [];
		save();
		if (settings.sportId) askPlugin({ probe: "competitions", sportId: settings.sportId });
		render();
	});

	document.getElementById("league")?.addEventListener("change", (e) => {
		settings.leagueId = e.target.value || undefined;
		save();
	});

	document.getElementById("view")?.addEventListener("change", (e) => {
		settings.view = e.target.value;
		save();
	});

	document.getElementById("press")?.addEventListener("change", (e) => {
		settings.onPress = e.target.value;
		save();
	});
}
