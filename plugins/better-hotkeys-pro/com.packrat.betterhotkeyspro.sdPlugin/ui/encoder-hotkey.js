/**
 * Property inspector for the Dial action.
 *
 * Four independent slots (rotate clockwise, rotate counter-clockwise, push, touch tap),
 * each a {vk, modifiers} pair rather than Hold/Toggle Key's `keys` array -- a dial only
 * ever taps one combo per slot, so a bitmask is enough and matches what the
 * ratpack-projects profile builder emits directly.
 *
 * Recording captures modifiers and the main key together: hold Shift, press Right, and
 * both land in one shot as {vk: <Right>, modifiers: 1}.
 *
 * Talks the Stream Deck property-inspector websocket directly, like every other page in
 * this plugin -- no component library, so the plugin ships no third-party UI code.
 */

const CODE_TO_VK = (() => {
	const map = {
		Space: 0x20, Enter: 0x0d, Tab: 0x09, Escape: 0x1b, Backspace: 0x08,
		ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
		Insert: 0x2d, Delete: 0x2e, Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22,
		NumpadAdd: 0x6b, NumpadSubtract: 0x6d, NumpadMultiply: 0x6a, NumpadDivide: 0x6f, NumpadDecimal: 0x6e,
		Semicolon: 0xba, Equal: 0xbb, Comma: 0xbc, Minus: 0xbd, Period: 0xbe, Slash: 0xbf,
		Backquote: 0xc0, BracketLeft: 0xdb, Backslash: 0xdc, BracketRight: 0xdd, Quote: 0xde
	};
	for (let i = 0; i < 26; i++) map[`Key${String.fromCharCode(65 + i)}`] = 0x41 + i;
	for (let i = 0; i < 10; i++) map[`Digit${i}`] = 0x30 + i;
	for (let i = 0; i < 10; i++) map[`Numpad${i}`] = 0x60 + i;
	for (let i = 1; i <= 24; i++) map[`F${i}`] = 0x6f + i;
	return map;
})();

const VK_LABELS = (() => {
	const m = {
		0x20: "Space", 0x0d: "Enter", 0x09: "Tab", 0x1b: "Esc", 0x08: "Backspace",
		0x25: "←", 0x26: "↑", 0x27: "→", 0x28: "↓",
		0x2d: "Insert", 0x2e: "Delete", 0x24: "Home", 0x23: "End", 0x21: "Page Up", 0x22: "Page Down",
		0x6b: "Num +", 0x6d: "Num -", 0x6a: "Num *", 0x6f: "Num /", 0x6e: "Num .",
		0xba: ";", 0xbb: "=", 0xbc: ",", 0xbd: "-", 0xbe: ".", 0xbf: "/",
		0xc0: "`", 0xdb: "[", 0xdc: "\\", 0xdd: "]", 0xde: "'"
	};
	for (let i = 0; i < 26; i++) m[0x41 + i] = String.fromCharCode(65 + i);
	for (let i = 0; i < 10; i++) m[0x30 + i] = String(i);
	for (let i = 0; i < 10; i++) m[0x60 + i] = `Num ${i}`;
	for (let i = 1; i <= 24; i++) m[0x6f + i] = `F${i}`;
	return m;
})();

/** Windows VK codes, sent to CGEventCreateKeyboardEvent unchanged when the plugin runs on
 * macOS. The profile builder emits OS-appropriate codes directly; this recorder is a
 * manual-editing convenience and, like keys.js, only records Windows VKs today. */
const MODIFIER_CODE_BITS = {
	ShiftLeft: 1, ShiftRight: 1,
	ControlLeft: 2, ControlRight: 2,
	AltLeft: 4, AltRight: 4,
	MetaLeft: 8, MetaRight: 8
};

const SLOTS = [
	{ id: "cw", key: "rotateCW", btn: "record-cw", label: "Clockwise" },
	{ id: "ccw", key: "rotateCCW", btn: "record-ccw", label: "Counter-clockwise" },
	{ id: "push", key: "push", btn: "record-push", label: "Push" },
	{ id: "touch", key: "touchTap", btn: "record-touch", label: "Touch tap" }
];

let websocket = null;
let uuid = null;
let settings = {};
let recordingSlot = null;
let heldModifiers = new Set();

// eslint-disable-next-line no-unused-vars
function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
	uuid = inUUID;
	try {
		settings = JSON.parse(inActionInfo).payload.settings ?? {};
	} catch {
		settings = {};
	}

	websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
	websocket.onopen = () => {
		websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
		render();
	};
	websocket.onmessage = (e) => {
		const msg = JSON.parse(e.data);
		if (msg.event === "didReceiveSettings") {
			settings = msg.payload.settings ?? {};
			if (!recordingSlot) render();
		}
	};
}

function save() {
	if (websocket?.readyState === WebSocket.OPEN) {
		websocket.send(JSON.stringify({ event: "setSettings", context: uuid, payload: settings }));
	}
}

function hotkeyLabel(hotkey) {
	if (!hotkey?.vk) return null;
	const parts = [];
	if (hotkey.modifiers & 1) parts.push("Shift");
	if (hotkey.modifiers & 2) parts.push("Ctrl");
	if (hotkey.modifiers & 4) parts.push("Alt");
	if (hotkey.modifiers & 8) parts.push("Cmd/Win");
	parts.push(VK_LABELS[hotkey.vk] ?? `VK ${hotkey.vk}`);
	return parts.join(" + ");
}

function stopRecording() {
	if (!recordingSlot) return;
	recordingSlot = null;
	heldModifiers.clear();
	window.removeEventListener("keydown", onRecordKeyDown, true);
	window.removeEventListener("blur", stopRecording, true);
	render();
}

function onRecordKeyDown(e) {
	e.preventDefault();
	e.stopPropagation();
	if (e.repeat) return;

	const modBit = MODIFIER_CODE_BITS[e.code];
	if (modBit) {
		heldModifiers.add(modBit);
		return;
	}

	const vk = CODE_TO_VK[e.code];
	if (vk === undefined) return; // unsupported key -- keep listening

	const modifiers = [...heldModifiers].reduce((a, b) => a | b, 0);
	const slot = SLOTS.find((s) => s.id === recordingSlot);
	settings[slot.key] = { vk, modifiers };
	save();
	stopRecording();
}

function startRecording(slotId) {
	if (recordingSlot === slotId) return stopRecording();
	recordingSlot = slotId;
	heldModifiers.clear();
	render();
	window.addEventListener("keydown", onRecordKeyDown, true);
	window.addEventListener("blur", stopRecording, true);
}

function render() {
	for (const s of SLOTS) {
		const btn = document.getElementById(s.btn);
		if (!btn) continue;
		const recording = recordingSlot === s.id;
		btn.classList.toggle("recording", recording);
		if (recording) {
			btn.textContent = "Hold modifiers, press key…";
		} else {
			const label = hotkeyLabel(settings[s.key]);
			btn.textContent = label ? `${s.label}: ${label}` : `Set ${s.label.toLowerCase()}`;
		}
	}

	const stepSize = document.getElementById("stepSize");
	if (stepSize) stepSize.value = settings.stepSize ?? 1;
	const accel = document.getElementById("acceleration");
	if (accel) accel.checked = settings.acceleration ?? true;

	// Absent rotateMode means hotkey: dials configured before scroll existed keep working.
	const scroll = settings.rotateMode === "scroll";
	const mode = document.getElementById("rotateMode");
	if (mode) mode.value = scroll ? "scroll" : "hotkey";
	const slots = document.getElementById("hotkey-slots");
	if (slots) slots.hidden = scroll;
	const scrollOpts = document.getElementById("scroll-opts");
	if (scrollOpts) scrollOpts.hidden = !scroll;
	const invert = document.getElementById("invertScroll");
	if (invert) invert.checked = settings.invertScroll ?? false;
	const axisSel = document.getElementById("scrollAxis");
	if (axisSel) axisSel.value = settings.scrollAxis ?? "vertical";
	const targetSel = document.getElementById("scrollTarget");
	if (targetSel) targetSel.value = settings.scrollTarget ?? "pointer";

	const sum = document.getElementById("summary");
	if (sum) {
		if (scroll) {
			sum.className = "summary";
			const pair = (settings.scrollAxis ?? "vertical") === "horizontal" ? ["right", "left"] : ["up", "down"];
			const dir = settings.invertScroll ? [pair[1], pair[0]] : pair;
			const where = (settings.scrollTarget ?? "pointer") === "active" ? " in the window in front" : "";
			sum.innerHTML = `Turning right scrolls <b>${dir[0]}</b>, left scrolls <b>${dir[1]}</b>${where}.`;
		} else {
			const cw = hotkeyLabel(settings.rotateCW);
			const ccw = hotkeyLabel(settings.rotateCCW);
			if (!cw && !ccw) {
				sum.className = "summary error";
				sum.innerHTML = "<b>No rotation set.</b> This dial won't do anything yet.";
			} else {
				sum.className = "summary";
				sum.innerHTML = `Turning right sends <b>${cw ?? "nothing"}</b>, left sends <b>${ccw ?? "nothing"}</b>.`;
			}
		}
	}
}

function build() {
	for (const s of SLOTS) {
		document.getElementById(s.btn)?.addEventListener("click", () => startRecording(s.id));
	}
	document.getElementById("clear-push")?.addEventListener("click", () => {
		delete settings.push;
		save();
		render();
	});
	document.getElementById("clear-touch")?.addEventListener("click", () => {
		delete settings.touchTap;
		save();
		render();
	});
	document.getElementById("stepSize")?.addEventListener("input", (e) => {
		settings.stepSize = Math.max(1, Math.min(50, Number(e.target.value) || 1));
		save();
	});
	document.getElementById("acceleration")?.addEventListener("change", (e) => {
		settings.acceleration = e.target.checked;
		save();
	});
	document.getElementById("rotateMode")?.addEventListener("change", (e) => {
		settings.rotateMode = e.target.value === "scroll" ? "scroll" : "hotkey";
		save();
		render();
	});
	document.getElementById("invertScroll")?.addEventListener("change", (e) => {
		settings.invertScroll = e.target.checked;
		save();
		render();
	});
	document.getElementById("scrollAxis")?.addEventListener("change", (e) => {
		settings.scrollAxis = e.target.value === "horizontal" ? "horizontal" : "vertical";
		save();
		render();
	});
	document.getElementById("scrollTarget")?.addEventListener("change", (e) => {
		settings.scrollTarget = e.target.value === "active" ? "active" : "pointer";
		save();
		render();
	});
}

document.addEventListener("DOMContentLoaded", build);
