/**
 * Property inspector logic for the Phase 3 actions: Radial Select, Auto-Repeat,
 * Mouse Drag, Scroll. One file, four pages -- each page wires only the controls it
 * actually contains, so there's no drift between four near-identical copies.
 *
 * The flagship piece is the radial dial: click or drag inside it to set angle and
 * distance at once, instead of typing degrees.
 *
 * Talks the Stream Deck property-inspector websocket directly -- no component library,
 * so the plugin ships no third-party UI code.
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
		if (document.getElementById("monitor")) askPlugin({ probe: "monitors" });
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

let armedSlot = null;

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
		armedSlot = payload.armed ? (payload.slot ?? "from") : null;
		renderCaptureButtons(payload.timedOut ? "Timed out — nothing captured." : "");
		return;
	}

	if (payload.probe === "capture") {
		armedSlot = null;
		// The plugin wrote the fields and auto-picked the monitor; mirror it here.
		if (payload.slot === "to") {
			settings.toXPct = payload.xPct;
			settings.toYPct = payload.yPct;
		} else {
			settings.fromXPct = payload.xPct;
			settings.fromYPct = payload.yPct;
		}
		if (payload.area != null) settings.area = payload.area;
		if (payload.monitorIndex != null) settings.monitorIndex = payload.monitorIndex;
		render();
		const where = payload.area === "monitor" ? " on monitor " + ((payload.monitorIndex ?? 0) + 1) : "";
		renderCaptureButtons(`Captured ${payload.slot === "to" ? "end" : "start"} at ${payload.xPct}% , ${payload.yPct}%${where}`);
	}
}

/** Reflects arm/idle on the two drag capture buttons. */
function renderCaptureButtons(message) {
	for (const [id, slot] of [["capture-from", "from"], ["capture-to", "to"]]) {
		const btn = document.getElementById(id);
		if (!btn) continue;
		const isArmed = armedSlot === slot;
		btn.classList.toggle("recording", isArmed);
		btn.textContent = isArmed
			? "Now press the Stream Deck key…"
			: slot === "from"
				? "Capture cursor as start"
				: "Capture cursor as end";
	}
	const note = document.getElementById("capture-note");
	if (note) {
		note.textContent = armedSlot
			? "Move your mouse where you want it, then press this action's key on your Stream Deck."
			: message;
		note.className = armedSlot ? "hint warn" : "hint";
	}
}

// --- small helpers --------------------------------------------------------

function setVal(id, value) {
	const el = document.getElementById(id);
	if (el != null && value != null) el.value = value;
}

function num(id, fallback) {
	const el = document.getElementById(id);
	const n = el ? Number(el.value) : NaN;
	return Number.isFinite(n) ? n : fallback;
}

function bindInput(id, key, transform = (v) => v) {
	const el = document.getElementById(id);
	if (!el) return;
	el.addEventListener("input", () => {
		settings[key] = transform(el.type === "checkbox" ? el.checked : el.value);
		save();
		render();
	});
}

// --- open-key recorder (radial) ------------------------------------------

const CODE_TO_VK = (() => {
	const map = {
		Space: 0x20, Enter: 0x0d, Tab: 0x09, Escape: 0x1b, Backspace: 0x08,
		ShiftLeft: 0xa0, ControlLeft: 0xa2, AltLeft: 0xa4
	};
	for (let i = 0; i < 26; i++) map[`Key${String.fromCharCode(65 + i)}`] = 0x41 + i;
	for (let i = 0; i < 10; i++) map[`Digit${i}`] = 0x30 + i;
	for (let i = 1; i <= 12; i++) map[`F${i}`] = 0x6f + i;
	return map;
})();

const VK_LABEL = (() => {
	const m = { 0x20: "Space", 0x0d: "Enter", 0x09: "Tab", 0x1b: "Esc", 0x08: "Backspace", 0xa0: "Shift", 0xa2: "Ctrl", 0xa4: "Alt" };
	for (let i = 0; i < 26; i++) m[0x41 + i] = String.fromCharCode(65 + i);
	for (let i = 0; i < 10; i++) m[0x30 + i] = String(i);
	for (let i = 1; i <= 12; i++) m[0x6f + i] = `F${i}`;
	return m;
})();

let recording = false;

/** `store` receives the captured vk and is responsible for writing it into settings. */
function bindRecorder(btnId, store) {
	const btn = document.getElementById(btnId);
	if (!btn) return;
	const onKey = (e) => {
		e.preventDefault();
		e.stopPropagation();
		const vk = CODE_TO_VK[e.code];
		if (vk) {
			store(vk);
			save();
		}
		stop();
	};
	const stop = () => {
		recording = false;
		window.removeEventListener("keydown", onKey, true);
		window.removeEventListener("blur", stop, true);
		btn.blur();
		render();
	};
	btn.addEventListener("click", () => {
		if (recording) return stop();
		recording = true;
		render();
		window.addEventListener("keydown", onKey, true);
		window.addEventListener("blur", stop, true);
	});
}

// --- the radial dial ------------------------------------------------------

const SVGNS = "http://www.w3.org/2000/svg";

function setupDial() {
	const dial = document.getElementById("dial");
	if (!dial) return;
	const R = 78;
	const C = 90;

	// Twelve clock positions: click one for a quick preset ("just give me 3 o'clock"),
	// or drag anywhere on the dial for fine control. Dragging a marker still snaps first,
	// so a click always lands exactly on the hour.
	for (let h = 0; h < 12; h++) {
		const deg = h * 30;
		const mx = C + Math.sin((deg * Math.PI) / 180) * 66;
		const my = C - Math.cos((deg * Math.PI) / 180) * 66;
		const dot = document.createElementNS(SVGNS, "circle");
		dot.setAttribute("cx", mx);
		dot.setAttribute("cy", my);
		dot.setAttribute("r", "8");
		dot.setAttribute("class", "clock-dot");
		dot.dataset.deg = String(deg);
		dot.addEventListener("pointerdown", (e) => {
			e.stopPropagation();
			settings.angle = deg;
			settings.distance = settings.distance ?? 60;
			save();
			drawDial();
		});
		dial.append(dot);
		if (h % 3 === 0) {
			const label = document.createElementNS(SVGNS, "text");
			label.setAttribute("x", mx);
			label.setAttribute("y", my + 4);
			label.setAttribute("text-anchor", "middle");
			label.setAttribute("class", "clock-label");
			label.textContent = h === 0 ? "12" : String(h);
			dial.append(label);
		}
	}

	const pointFromEvent = (e) => {
		const rect = dial.getBoundingClientRect();
		const px = e.clientX - rect.left - C;
		const py = e.clientY - rect.top - C;
		let angle = (Math.atan2(px, -py) * 180) / Math.PI; // 0 = up, clockwise
		if (angle < 0) angle += 360;
		const dist = Math.min(1, Math.hypot(px, py) / R);
		settings.angle = Math.round(angle);
		settings.distance = Math.round(dist * 100);
		save();
		drawDial();
	};

	let dragging = false;
	dial.addEventListener("pointerdown", (e) => {
		dragging = true;
		dial.setPointerCapture(e.pointerId);
		pointFromEvent(e);
	});
	dial.addEventListener("pointermove", (e) => dragging && pointFromEvent(e));
	dial.addEventListener("pointerup", () => (dragging = false));
	drawDial();
}

function drawDial() {
	const handle = document.getElementById("dial-handle");
	const line = document.getElementById("dial-line");
	if (!handle || !line) return;
	const R = 78;
	const C = 90;
	const angle = ((settings.angle ?? 0) * Math.PI) / 180;
	const dist = (settings.distance ?? 60) / 100;
	const x = C + Math.sin(angle) * R * dist;
	const y = C - Math.cos(angle) * R * dist;
	handle.setAttribute("cx", x);
	handle.setAttribute("cy", y);
	line.setAttribute("x2", x);
	line.setAttribute("y2", y);
	setVal("angle", settings.angle ?? 0);
	setVal("distance", settings.distance ?? 60);

	// Light the clock dot nearest the current angle.
	const cur = settings.angle ?? 0;
	for (const dot of document.querySelectorAll(".clock-dot")) {
		const deg = Number(dot.dataset.deg);
		const near = Math.abs(((deg - cur + 540) % 360) - 180) < 15;
		dot.classList.toggle("active", near);
	}
}

// --- render ---------------------------------------------------------------

function render() {
	const kind = document.body.dataset.kind;

	// Radial
	if (kind === "radial") {
		const openBtn = document.getElementById("record-open");
		if (openBtn) {
			openBtn.classList.toggle("recording", recording);
			openBtn.textContent = recording
				? "Press a key…"
				: settings.openVk
					? `Open key: ${VK_LABEL[settings.openVk] ?? settings.openVk}`
					: "Set open key (optional)";
		}
		setVal("area", settings.area ?? "primary");
		toggleMonitorRow();
		setVal("moveStyle", settings.moveStyle ?? "point");
		document.getElementById("confirmClick").checked = !!settings.confirmClick;
		document.getElementById("returnCursor").checked = !!settings.returnCursor;
		document.getElementById("useCustomOrigin").checked = !!settings.useCustomOrigin;
		document.getElementById("origin-fields").style.display = settings.useCustomOrigin ? "" : "none";
		setVal("originXPct", settings.originXPct ?? 50);
		setVal("originYPct", settings.originYPct ?? 50);
		setVal("openDelayMs", settings.openDelayMs ?? 120);
		setVal("holdMs", settings.holdMs ?? 80);
		setVal("stepDelayMs", settings.stepDelayMs ?? 25);
		drawDial();
		const sum = document.getElementById("summary");
		if (sum) {
			const open = settings.openVk ? `hold <b>${VK_LABEL[settings.openVk] ?? settings.openVk}</b>, ` : "";
			sum.innerHTML = `${open}flick to <b>${settings.angle ?? 0}°</b> at <b>${settings.distance ?? 60}%</b>${settings.confirmClick ? ", click" : ""}`;
		}
		return;
	}

	// Auto-Repeat
	if (kind === "repeat") {
		const what = settings.what ?? "key";
		setVal("what", what);
		document.getElementById("key-fields").style.display = what === "key" ? "" : "none";
		document.getElementById("click-fields").style.display = what === "click" ? "" : "none";
		setVal("button", settings.button ?? "left");
		setVal("hz", settings.hz ?? 10);
		setVal("maxSeconds", settings.maxSeconds ?? 0);
		const recBtn = document.getElementById("record-keys");
		if (recBtn) {
			recBtn.classList.toggle("recording", recording);
			const keys = (settings.keys ?? []).map((k) => VK_LABEL[k.vk] ?? k.vk).join(" + ");
			recBtn.textContent = recording ? "Press a key…" : keys ? `Key: ${keys}` : "Set key to repeat";
		}
		const sum = document.getElementById("summary");
		if (sum) {
			const target = what === "click" ? `${settings.button ?? "left"} click` : "the key";
			const cap = settings.maxSeconds ? ` for up to ${settings.maxSeconds}s` : "";
			sum.innerHTML = `Repeat ${target} at <b>${settings.hz ?? 10}×/sec</b>${cap}`;
		}
		return;
	}

	// Drag
	if (kind === "drag") {
		setVal("button", settings.button ?? "left");
		setVal("area", settings.area ?? "primary");
		toggleMonitorRow();
		setVal("fromXPct", settings.fromXPct ?? 25);
		setVal("fromYPct", settings.fromYPct ?? 50);
		setVal("toXPct", settings.toXPct ?? 75);
		setVal("toYPct", settings.toYPct ?? 50);
		setVal("durationMs", settings.durationMs ?? 250);
		const sum = document.getElementById("summary");
		if (sum) {
			sum.innerHTML = `Drag <b>${settings.button ?? "left"}</b> from <b>${settings.fromXPct ?? 25}%,${settings.fromYPct ?? 50}%</b> to <b>${settings.toXPct ?? 75}%,${settings.toYPct ?? 50}%</b>`;
		}
		return;
	}

	// Scroll
	if (kind === "scroll") {
		// One signed "notches" plus an axis covers all four directions, so older setups
		// (which have no axis) still read back as plain up or down.
		const negative = (settings.notches ?? -1) < 0;
		const horizontal = (settings.axis ?? "vertical") === "horizontal";
		const dir = horizontal ? (negative ? "left" : "right") : negative ? "down" : "up";
		setVal("direction", dir);
		setVal("amount", Math.abs(settings.notches ?? 1));
		setVal("target", settings.target ?? "pointer");
		setVal("repeat", settings.repeat ?? 1);
		setVal("interval", settings.interval ?? 40);
		const targetNote = document.getElementById("target-note");
		if (targetNote) targetNote.hidden = (settings.target ?? "pointer") !== "active";
		const axisNote = document.getElementById("axis-note");
		if (axisNote) axisNote.hidden = !horizontal;
		const sum = document.getElementById("summary");
		if (sum) {
			const n = Math.abs(settings.notches ?? 1);
			const times = (settings.repeat ?? 1) > 1 ? ` × ${settings.repeat}` : "";
			const where = (settings.target ?? "pointer") === "active" ? " in the window in front" : "";
			sum.innerHTML = `Scroll <b>${dir}</b> ${n} notch${n === 1 ? "" : "es"}${times}${where}`;
		}
	}
}

function toggleMonitorRow() {
	const row = document.getElementById("monitor-row");
	if (row) row.style.display = (settings.area ?? "primary") === "monitor" ? "" : "none";
}

// --- wiring ---------------------------------------------------------------

function build() {
	const kind = document.body.dataset.kind;

	if (kind === "radial") {
		bindRecorder("record-open", (vk) => (settings.openVk = vk));
		document.getElementById("clear-open")?.addEventListener("click", () => {
			delete settings.openVk;
			save();
			render();
		});
		setupDial();
		bindInput("angle", "angle", (v) => (Number(v) % 360 + 360) % 360);
		bindInput("distance", "distance", (v) => Math.min(100, Math.max(0, Number(v))));
		bindInput("area", "area");
		document.getElementById("area")?.addEventListener("change", () => askPlugin({ probe: "monitors" }));
		bindInput("monitor", "monitorIndex", Number);
		bindInput("moveStyle", "moveStyle");
		bindInput("confirmClick", "confirmClick");
		bindInput("returnCursor", "returnCursor");
		bindInput("useCustomOrigin", "useCustomOrigin");
		bindInput("originXPct", "originXPct", Number);
		bindInput("originYPct", "originYPct", Number);
		bindInput("openDelayMs", "openDelayMs", Number);
		bindInput("holdMs", "holdMs", Number);
		bindInput("stepDelayMs", "stepDelayMs", Number);
	} else if (kind === "repeat") {
		bindInput("what", "what");
		bindInput("button", "button");
		bindInput("hz", "hz", Number);
		bindInput("maxSeconds", "maxSeconds", Number);
		bindRecorder("record-keys", (vk) => (settings.keys = [{ vk }]));
	} else if (kind === "drag") {
		bindInput("button", "button");
		bindInput("area", "area");
		document.getElementById("area")?.addEventListener("change", () => askPlugin({ probe: "monitors" }));
		bindInput("monitor", "monitorIndex", Number);
		bindInput("fromXPct", "fromXPct", Number);
		bindInput("fromYPct", "fromYPct", Number);
		bindInput("toXPct", "toXPct", Number);
		bindInput("toYPct", "toYPct", Number);
		bindInput("durationMs", "durationMs", Number);
		// Arm/disarm capture for each end; the deck key does the actual reading.
		for (const [id, slot] of [["capture-from", "from"], ["capture-to", "to"]]) {
			document.getElementById(id)?.addEventListener("click", () => {
				askPlugin({ probe: armedSlot === slot ? "disarm" : "arm", slot });
			});
		}
	} else if (kind === "scroll") {
		const apply = () => {
			const amount = Math.max(1, num("amount", 1));
			const dir = document.getElementById("direction").value;
			// "down" and "left" are the negative ends of their own axis.
			settings.axis = dir === "left" || dir === "right" ? "horizontal" : "vertical";
			settings.notches = dir === "down" || dir === "left" ? -amount : amount;
			settings.target = document.getElementById("target")?.value === "active" ? "active" : "pointer";
			settings.repeat = Math.max(1, num("repeat", 1));
			settings.interval = Math.max(0, num("interval", 40));
			save();
			render();
		};
		for (const id of ["direction", "amount", "target", "repeat", "interval"]) {
			document.getElementById(id)?.addEventListener("input", apply);
			document.getElementById(id)?.addEventListener("change", apply);
		}
	}
}

document.addEventListener("DOMContentLoaded", build);
