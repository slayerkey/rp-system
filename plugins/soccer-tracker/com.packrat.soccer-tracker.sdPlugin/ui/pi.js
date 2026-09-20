/**
 * Property inspector for all three actions, one file driven by document.body.dataset.kind.
 * Talks the Stream Deck PI websocket directly, so the plugin ships no third-party UI code.
 *
 * The team list lives in the plugin bundle, not here, so on open the PI asks for it
 * (probe: "teams") and groups the reply by conference. One list, one place to maintain.
 */

let websocket = null;
let uuid = null;
let actionUuid = null;
let settings = {};
let teams = [];
let competitions = [];

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
		askPlugin({ probe: "teams" });
		askPlugin({ probe: "competitions" });
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
	if (payload.probe === "teams") {
		teams = payload.teams ?? [];
		render();
	} else if (payload.probe === "competitions") {
		competitions = payload.competitions ?? [];
		render();
	}
}

function escapeHtml(s) {
	return String(s).replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
	);
}

function render() {
	const picker = document.getElementById("team");
	if (picker && teams.length) {
		const groups = [];
		for (const t of teams) {
			let group = groups.find((g) => g.name === t.group);
			if (!group) groups.push((group = { name: t.group, items: [] }));
			group.items.push(t);
		}
		picker.innerHTML =
			'<option value="">Pick a team…</option>' +
			groups
				.map(
					(g) =>
						`<optgroup label="${escapeHtml(g.name)}">` +
						g.items.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("") +
						"</optgroup>"
				)
				.join("");
		picker.value = settings.teamId ?? "";
	}

	const view = document.getElementById("view");
	if (view) view.value = settings.view === "division" ? "division" : "conference";

	const league = document.getElementById("league");
	const leagueRow = document.getElementById("league-row");
	if (league && leagueRow) {
		leagueRow.style.display = competitions.length ? "" : "none";
		if (competitions.length) {
			league.innerHTML = competitions
				.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
				.join("");
			league.value = settings.leagueId ?? competitions[0].id;
		}
	}

	const press = document.getElementById("press");
	if (press) press.value = settings.onPress ?? press.options[0].value;
}

function build() {
	document.getElementById("team")?.addEventListener("change", (e) => {
		settings.teamId = e.target.value || undefined;
		save();
	});

	document.getElementById("view")?.addEventListener("change", (e) => {
		settings.view = e.target.value;
		save();
	});

	document.getElementById("league")?.addEventListener("change", (e) => {
		settings.leagueId = e.target.value;
		settings.index = 0;
		save();
	});

	document.getElementById("press")?.addEventListener("change", (e) => {
		settings.onPress = e.target.value;
		save();
	});
}
