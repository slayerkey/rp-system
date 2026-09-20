/**
 * Property inspector for all three actions (Next / Auto Cycle / Scheduled), one file
 * driven by document.body.dataset.kind. Talks the Stream Deck PI websocket directly, so
 * the plugin ships no third-party UI code.
 *
 * The list of available screensavers is not known to the browser, so on open the PI asks
 * the plugin for it (probe: "list") and the plugin answers with names + full paths.
 */

let websocket = null;
let uuid = null;
let actionUuid = null;
let settings = {};
let available = [];

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
		requestList();
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

function requestList() {
	askPlugin({ probe: "list", folder: settings.folder || undefined });
}

function onPluginMessage(payload) {
	if (payload.probe === "list") {
		available = payload.screensavers ?? [];
		render();
	}
}

// --- helpers --------------------------------------------------------------

function escapeHtml(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function nameFor(path) {
	const hit = available.find((s) => s.path === path);
	return hit ? hit.name : path;
}

// --- render ---------------------------------------------------------------

function render() {
	const kind = document.body.dataset.kind;

	const folder = document.getElementById("folder");
	if (folder && document.activeElement !== folder) folder.value = settings.folder ?? "";

	if (kind === "schedule") {
		renderRules();
	} else {
		renderChecklist();
	}

	if (kind === "next") {
		const p = document.getElementById("preview");
		if (p) p.checked = settings.preview !== false;
	}

	if (kind === "cycle") {
		const iv = document.getElementById("interval");
		if (iv && document.activeElement !== iv) iv.value = settings.intervalMin ?? 5;
	}
}

function renderChecklist() {
	const box = document.getElementById("list");
	if (!box) return;
	const chosen = new Set(settings.paths ?? []);
	box.innerHTML = "";

	if (!available.length) {
		box.innerHTML = '<p class="hint">No .scr screensavers found in Windows. Add a folder below, or install some.</p>';
		return;
	}

	for (const s of available) {
		const row = document.createElement("label");
		row.className = "check";
		const cb = document.createElement("input");
		cb.type = "checkbox";
		cb.checked = chosen.has(s.path);
		cb.addEventListener("change", () => {
			const set = new Set(settings.paths ?? []);
			if (cb.checked) set.add(s.path);
			else set.delete(s.path);
			settings.paths = [...set];
			save();
		});
		const span = document.createElement("span");
		span.textContent = s.name;
		row.append(cb, span);
		box.append(row);
	}
}

function renderRules() {
	const box = document.getElementById("rules");
	if (!box) return;
	const rules = settings.rules ?? [];
	box.innerHTML = "";

	const options = ['<option value="">Pick a screensaver…</option>']
		.concat(available.map((s) => `<option value="${escapeHtml(s.path)}">${escapeHtml(s.name)}</option>`))
		.join("");

	rules.forEach((rule, i) => {
		const row = document.createElement("div");
		row.className = "rule";

		const time = document.createElement("input");
		time.type = "time";
		time.value = rule.time ?? "";
		time.addEventListener("change", () => {
			rules[i].time = time.value;
			settings.rules = rules;
			save();
		});

		const sel = document.createElement("select");
		sel.innerHTML = options;
		// A scheduled path may not be in `available` if the list hasn't arrived or the file
		// moved; keep showing it as an option so the row doesn't silently blank out.
		if (rule.path && !available.some((s) => s.path === rule.path)) {
			sel.innerHTML += `<option value="${escapeHtml(rule.path)}">${escapeHtml(nameFor(rule.path))}</option>`;
		}
		sel.value = rule.path ?? "";
		sel.addEventListener("change", () => {
			rules[i].path = sel.value;
			settings.rules = rules;
			save();
		});

		const del = document.createElement("button");
		del.className = "link";
		del.type = "button";
		del.textContent = "Remove";
		del.addEventListener("click", () => {
			rules.splice(i, 1);
			settings.rules = rules;
			save();
			render();
		});

		row.append(time, sel, del);
		box.append(row);
	});
}

// --- wiring ---------------------------------------------------------------

function build() {
	const kind = document.body.dataset.kind;

	const folder = document.getElementById("folder");
	if (folder) {
		folder.addEventListener("change", () => {
			settings.folder = folder.value.trim() || undefined;
			save();
			requestList();
		});
	}

	if (kind === "next") {
		document.getElementById("preview")?.addEventListener("change", (e) => {
			settings.preview = e.target.checked;
			save();
		});
	}

	if (kind === "cycle") {
		document.getElementById("interval")?.addEventListener("input", (e) => {
			settings.intervalMin = Math.max(1, Number(e.target.value) || 5);
			save();
		});
	}

	if (kind === "schedule") {
		document.getElementById("add-rule")?.addEventListener("click", () => {
			settings.rules = [...(settings.rules ?? []), { time: "", path: "" }];
			save();
			render();
		});
	}
}
