/**
 * Property inspector for the mic actions: Mute Mic, Push to Talk, Mic Volume.
 *
 * The microphone list can only come from the plugin (a PI is a browser window), so it's
 * fetched over the websocket. "Default microphone" is always the first option and stores
 * an empty id, meaning "follow whatever Windows' default is".
 */

let websocket = null;
let uuid = null;
let actionUuid = null;
let settings = {};

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
		render();
		askPlugin({ probe: "mics" });
	};
	websocket.onmessage = (e) => {
		const msg = JSON.parse(e.data);
		if (msg.event === "didReceiveSettings") {
			settings = msg.payload.settings ?? {};
			render();
		} else if (msg.event === "sendToPropertyInspector" && (msg.payload ?? {}).probe === "mics") {
			fillMics(msg.payload.mics ?? []);
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

function fillMics(mics) {
	const sel = document.getElementById("device");
	if (!sel) return;
	sel.innerHTML = "";
	const def = document.createElement("option");
	def.value = "";
	def.textContent = "Default microphone";
	sel.append(def);
	// Windows keeps separate defaults for voice apps and everything else, and a routed
	// rig (Voicemeeter, virtual cables) can leave a real mic live under both. This option
	// mutes every active input so nothing is still listening.
	const all = document.createElement("option");
	all.value = "__all__";
	all.textContent = "All microphones";
	sel.append(all);
	for (const m of mics) {
		const opt = document.createElement("option");
		opt.value = m.id;
		opt.textContent = m.label;
		sel.append(opt);
	}
	sel.value = settings.deviceId ?? "";
	lastMics = mics;
	renderTargets();
}

let lastMics = [];

/**
 * Spells out which microphones the current choice will actually mute.
 *
 * Without this the picker just says "Default microphone" and you find out it missed an
 * app by not being heard. Naming the devices makes a mismatch obvious before it matters:
 * if the app you care about is on a mic that is not listed here, it will stay live.
 */
function renderTargets() {
	const el = document.getElementById("targets");
	if (!el) return;
	const chosen = settings.deviceId ?? "";
	let names = [];
	if (chosen === "__all__") {
		names = lastMics.map((m) => m.name ?? m.label);
	} else if (chosen === "") {
		names = lastMics.filter((m) => (m.roles ?? []).length > 0).map((m) => m.label);
	} else {
		names = lastMics.filter((m) => m.id === chosen).map((m) => m.label);
	}
	el.textContent = names.length
		? `Mutes: ${[...new Set(names)].join(", ")}`
		: "No microphone found to mute.";
}

function setVal(id, value) {
	const el = document.getElementById(id);
	if (el != null && value != null) el.value = value;
}

function render() {
	setVal("device", settings.deviceId ?? "");

	const kind = document.body.dataset.kind;
	if (kind === "ptt") {
		setVal("mode", settings.mode ?? "talk");
	} else if (kind === "volume") {
		const mode = settings.volMode ?? "set";
		setVal("volMode", mode);
		setVal("level", settings.level ?? 75);
		setVal("delta", settings.delta ?? 5);
		const setRow = document.getElementById("set-row");
		const nudgeRow = document.getElementById("nudge-row");
		if (setRow) setRow.style.display = mode === "set" ? "" : "none";
		if (nudgeRow) nudgeRow.style.display = mode === "nudge" ? "" : "none";
	}
}

function build() {
	document.getElementById("device")?.addEventListener("change", (e) => {
		settings.deviceId = e.target.value;
		save();
		renderTargets();
	});

	const kind = document.body.dataset.kind;
	if (kind === "ptt") {
		document.getElementById("mode")?.addEventListener("change", (e) => {
			settings.mode = e.target.value;
			save();
		});
	} else if (kind === "volume") {
		document.getElementById("volMode")?.addEventListener("change", (e) => {
			settings.volMode = e.target.value;
			save();
			render();
		});
		document.getElementById("level")?.addEventListener("input", (e) => {
			settings.level = Math.min(100, Math.max(0, Number(e.target.value) || 0));
			save();
		});
		document.getElementById("delta")?.addEventListener("input", (e) => {
			settings.delta = Math.max(-100, Math.min(100, Number(e.target.value) || 0));
			save();
		});
	}
}

document.addEventListener("DOMContentLoaded", build);
