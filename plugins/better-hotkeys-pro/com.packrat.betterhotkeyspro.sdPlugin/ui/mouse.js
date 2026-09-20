/**
 * Shared property inspector logic for the mouse actions.
 *
 * Each page opts in to the bits it needs by which elements it contains, so one file
 * serves Click / Move / Hold without three near-copies drifting apart.
 *
 * The cursor position and the monitor list can only come from the plugin -- a property
 * inspector is a browser window and has no idea either exists.
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
		askPlugin({ probe: "monitors" });
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

let armed = false;

function onPluginMessage(payload) {
	if (payload.probe === "monitors") {
		const sel = document.getElementById("monitor");
		if (!sel) return;
		sel.innerHTML = "";
		for (const m of payload.monitors ?? []) {
			const opt = document.createElement("option");
			opt.value = String(m.index);
			opt.textContent = m.label;
			sel.append(opt);
		}
		sel.value = String(settings.monitorIndex ?? 0);
		return;
	}

	if (payload.probe === "armed") {
		armed = payload.armed;
		renderCapture(payload.timedOut ? "Timed out — nothing captured." : "");
		return;
	}

	if (payload.probe === "capture") {
		armed = false;
		// The plugin already wrote these to settings; mirror them so the fields update
		// without waiting for the settings round-trip. It also auto-picks the monitor the
		// cursor was on, so reflect that here.
		settings.xPct = payload.xPct;
		settings.yPct = payload.yPct;
		if (payload.area != null) settings.area = payload.area;
		if (payload.monitorIndex != null) settings.monitorIndex = payload.monitorIndex;
		render();
		const where = payload.area === "monitor" ? " on monitor " + ((payload.monitorIndex ?? 0) + 1) : "";
		renderCapture(`Captured ${payload.xPct}% , ${payload.yPct}%${where}`);
	}
}

/** Reflects arm/idle state on the capture button and its note. */
function renderCapture(message, warn = false) {
	const btn = document.getElementById("capture");
	if (btn) {
		btn.textContent = armed ? "Now press the Stream Deck button…" : "Capture cursor position";
		btn.classList.toggle("recording", armed);
	}
	const note = document.getElementById("capture-note");
	if (!note) return;
	note.textContent = armed
		? "Move your mouse where you want it, then press this action's key on your Stream Deck."
		: message;
	note.className = warn ? "hint warn" : "hint";
}

// --- rendering ------------------------------------------------------------

function render() {
	const set = (id, value) => {
		const el = document.getElementById(id);
		if (el) el.value = value;
	};

	set("x", settings.xPct ?? 50);
	set("y", settings.yPct ?? 50);
	set("xnum", settings.xPct ?? 50);
	set("ynum", settings.yPct ?? 50);
	set("area", settings.area ?? "primary");
	set("button", settings.button ?? "left");
	set("dx", settings.dx ?? 0);
	set("dy", settings.dy ?? 0);

	const monitorRow = document.getElementById("monitor-row");
	if (monitorRow) monitorRow.style.display = (settings.area ?? "primary") === "monitor" ? "" : "none";

	const relative = !!settings.relative;
	const relToggle = document.getElementById("relative");
	if (relToggle) relToggle.checked = relative;

	// Absolute and relative want completely different fields; showing both is noise.
	for (const id of ["point-fields"]) {
		const el = document.getElementById(id);
		if (el) el.style.display = relative ? "none" : "";
	}
	for (const id of ["offset-fields"]) {
		const el = document.getElementById(id);
		if (el) el.style.display = relative ? "" : "none";
	}

	const atPoint = !!settings.atPoint;
	const atToggle = document.getElementById("atpoint");
	if (atToggle) atToggle.checked = atPoint;
	const pf = document.getElementById("point-fields");
	if (pf && atToggle) pf.style.display = atPoint ? "" : "none";

	renderSummary();
}

function renderSummary() {
	const el = document.getElementById("summary");
	if (!el) return;
	const verb = document.body.dataset.verb ?? "";
	const button = { left: "Left", right: "Right", middle: "Middle" }[settings.button ?? "left"];
	const where = { cursor: "the cursor", virtual: "all monitors", primary: "the primary monitor", monitor: "the chosen monitor" }[
		settings.area ?? "primary"
	];

	if (document.body.dataset.kind === "click") {
		el.innerHTML = settings.atPoint
			? `<b>${button}</b> click at <b>${settings.xPct ?? 50}% , ${settings.yPct ?? 50}%</b> of ${where}`
			: `<b>${button}</b> click wherever the cursor is`;
	} else if (document.body.dataset.kind === "move") {
		el.innerHTML = settings.relative
			? `Nudge the cursor by <b>${settings.dx ?? 0}, ${settings.dy ?? 0}</b> pixels`
			: `Move the cursor to <b>${settings.xPct ?? 50}% , ${settings.yPct ?? 50}%</b> of ${where}`;
	} else {
		el.innerHTML = `${verb} the <b>${button}</b> mouse button`;
	}
}

// --- wiring ---------------------------------------------------------------

function bindNumber(id, key, { min, max }) {
	const el = document.getElementById(id);
	if (!el) return;
	el.addEventListener("input", () => {
		const n = Number(el.value);
		if (!Number.isFinite(n)) return;
		settings[key] = Math.min(max, Math.max(min, n));
		save();
		renderSummary();
		// Keep the slider and the number box showing the same thing.
		const twin = document.getElementById(id === "x" ? "xnum" : id === "xnum" ? "x" : id === "y" ? "ynum" : id === "ynum" ? "y" : "");
		if (twin) twin.value = settings[key];
	});
}

function build() {
	bindNumber("x", "xPct", { min: 0, max: 100 });
	bindNumber("y", "yPct", { min: 0, max: 100 });
	bindNumber("xnum", "xPct", { min: 0, max: 100 });
	bindNumber("ynum", "yPct", { min: 0, max: 100 });
	bindNumber("dx", "dx", { min: -10000, max: 10000 });
	bindNumber("dy", "dy", { min: -10000, max: 10000 });

	const area = document.getElementById("area");
	if (area) {
		area.addEventListener("change", () => {
			settings.area = area.value;
			save();
			render();
		});
	}

	const monitor = document.getElementById("monitor");
	if (monitor) {
		monitor.addEventListener("change", () => {
			settings.monitorIndex = Number(monitor.value);
			save();
			renderSummary();
		});
	}

	const button = document.getElementById("button");
	if (button) {
		button.addEventListener("change", () => {
			settings.button = button.value;
			save();
			renderSummary();
		});
	}

	const relative = document.getElementById("relative");
	if (relative) {
		relative.addEventListener("change", () => {
			settings.relative = relative.checked;
			save();
			render();
		});
	}

	const atPoint = document.getElementById("atpoint");
	if (atPoint) {
		atPoint.addEventListener("change", () => {
			settings.atPoint = atPoint.checked;
			save();
			render();
		});
	}

	// Capture is armed, not instant: clicking this button means the pointer is on this
	// button, so reading the cursor now would only ever capture the property inspector.
	// The deck key does the reading instead -- it's the one input that doesn't move the
	// mouse.
	const capture = document.getElementById("capture");
	if (capture) capture.addEventListener("click", () => askPlugin({ probe: armed ? "disarm" : "arm" }));
}

document.addEventListener("DOMContentLoaded", build);
