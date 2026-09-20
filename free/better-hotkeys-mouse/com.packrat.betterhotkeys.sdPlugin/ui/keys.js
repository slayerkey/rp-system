/**
 * Property inspector for Hold Key and Toggle Key.
 *
 * Recording is the primary way to pick keys: click, press what you want, let go. The
 * dropdown is a fallback for keys the browser never sees (the Windows key opens the
 * Start menu before we get a look at it).
 *
 * Talks the Stream Deck property-inspector websocket directly rather than pulling in a
 * component library, so the plugin ships no third-party code.
 *
 * Settings shape: { keys: [{ vk }], mode }
 * `keys` is an array of objects so scancode fields can be added later without migrating
 * anyone's saved settings.
 */

/**
 * KeyboardEvent.code -> Windows virtual key.
 *
 * `code` is the physical key regardless of keyboard layout, which is exactly what we
 * want: the plugin sends hardware scan codes, so a recorded key must mean "this position
 * on the board", not "the letter this position types today".
 *
 * Absent on purpose: NumpadEnter (shares VK_RETURN, so it can't be told apart when
 * sending), PrintScreen and Pause (their scan codes don't round-trip). Pick those from
 * the list if you really need them -- or rather, you can't, and that's deliberate.
 */
const CODE_TO_VK = (() => {
	const map = {
		Space: 0x20, Enter: 0x0d, Tab: 0x09, Escape: 0x1b, Backspace: 0x08, CapsLock: 0x14,
		ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
		Insert: 0x2d, Delete: 0x2e, Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22,
		ShiftLeft: 0xa0, ShiftRight: 0xa1, ControlLeft: 0xa2, ControlRight: 0xa3,
		AltLeft: 0xa4, AltRight: 0xa5, MetaLeft: 0x5b, MetaRight: 0x5c, ContextMenu: 0x5d,
		NumpadAdd: 0x6b, NumpadSubtract: 0x6d, NumpadMultiply: 0x6a, NumpadDivide: 0x6f,
		NumpadDecimal: 0x6e, NumLock: 0x90,
		Semicolon: 0xba, Equal: 0xbb, Comma: 0xbc, Minus: 0xbd, Period: 0xbe, Slash: 0xbf,
		Backquote: 0xc0, BracketLeft: 0xdb, Backslash: 0xdc, BracketRight: 0xdd, Quote: 0xde
	};
	for (let i = 0; i < 26; i++) map[`Key${String.fromCharCode(65 + i)}`] = 0x41 + i;
	for (let i = 0; i < 10; i++) map[`Digit${i}`] = 0x30 + i;
	for (let i = 0; i < 10; i++) map[`Numpad${i}`] = 0x60 + i;
	for (let i = 1; i <= 24; i++) map[`F${i}`] = 0x6f + i;
	return map;
})();

const MODIFIER_VKS = new Set([0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0x5b, 0x5c]);

const VK_LABELS = {
	0x20: "Space", 0x0d: "Enter", 0x09: "Tab", 0x1b: "Esc", 0x08: "Backspace", 0x14: "Caps Lock",
	0x25: "←", 0x26: "↑", 0x27: "→", 0x28: "↓",
	0x2d: "Insert", 0x2e: "Delete", 0x24: "Home", 0x23: "End", 0x21: "Page Up", 0x22: "Page Down",
	0xa0: "L Shift", 0xa1: "R Shift", 0xa2: "L Ctrl", 0xa3: "R Ctrl",
	0xa4: "L Alt", 0xa5: "R Alt", 0x5b: "L Win", 0x5c: "R Win", 0x5d: "Menu",
	0x6b: "Num +", 0x6d: "Num -", 0x6a: "Num *", 0x6f: "Num /", 0x6e: "Num .", 0x90: "Num Lock",
	0xba: ";", 0xbb: "=", 0xbc: ",", 0xbd: "-", 0xbe: ".", 0xbf: "/",
	0xc0: "`", 0xdb: "[", 0xdc: "\\", 0xdd: "]", 0xde: "'"
};
for (let i = 0; i < 26; i++) VK_LABELS[0x41 + i] = String.fromCharCode(65 + i);
for (let i = 0; i < 10; i++) VK_LABELS[0x30 + i] = String(i);
for (let i = 0; i < 10; i++) VK_LABELS[0x60 + i] = `Num ${i}`;
for (let i = 1; i <= 24; i++) VK_LABELS[0x6f + i] = `F${i}`;

/**
 * Modifier checkboxes, laid out as a two-column grid filled row by row: every Left
 * modifier lands in the left column and every Right one in the right column.
 * Shift and Ctrl lead because that's what nearly everyone actually binds.
 */
const MODIFIER_ROWS = [
	[
		[0xa0, "Left Shift"],
		[0xa1, "Right Shift"]
	],
	[
		[0xa2, "Left Ctrl"],
		[0xa3, "Right Ctrl"]
	],
	[
		[0xa4, "Left Alt"],
		[0xa5, "Right Alt"]
	],
	[
		[0x5b, "Left Win"],
		[0x5c, "Right Win"]
	]
];

/** Manual key picker. Modifiers live in the checkboxes above, so they're not repeated here. */
const KEY_GROUPS = [
	["Letters", Array.from({ length: 26 }, (_, i) => 0x41 + i)],
	["Numbers", Array.from({ length: 10 }, (_, i) => 0x30 + i)],
	["Function", Array.from({ length: 12 }, (_, i) => 0x70 + i)],
	["Common", [0x20, 0x0d, 0x09, 0x1b, 0x08, 0x14]],
	["Arrows", [0x25, 0x26, 0x27, 0x28]],
	["Navigation", [0x2d, 0x2e, 0x24, 0x23, 0x21, 0x22]],
	["Numpad", [...Array.from({ length: 10 }, (_, i) => 0x60 + i), 0x6b, 0x6d, 0x6a, 0x6f, 0x6e]],
	["Punctuation", [0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf, 0xc0, 0xdb, 0xdc, 0xdd, 0xde]]
];

let websocket = null;
let uuid = null;
let settings = {};
let recording = false;
let downNow = [];
let captured = [];

// --- Stream Deck plumbing -------------------------------------------------

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
			if (!recording) render();
		}
	};
}

function save() {
	if (websocket?.readyState === WebSocket.OPEN) {
		websocket.send(JSON.stringify({ event: "setSettings", context: uuid, payload: settings }));
	}
}

const currentVks = () => (settings.keys ?? []).map((k) => k.vk);
const currentMods = () => currentVks().filter((v) => MODIFIER_VKS.has(v));
const currentMain = () => currentVks().filter((v) => !MODIFIER_VKS.has(v));

function setVks(vks) {
	// Modifiers first: Shift has to be down before W, or the W arrives unshifted.
	const ordered = [...vks.filter((v) => MODIFIER_VKS.has(v)), ...vks.filter((v) => !MODIFIER_VKS.has(v))];
	settings.keys = ordered.map((vk) => ({ vk }));
	save();
	render();
}

// --- Recording ------------------------------------------------------------

function startRecording() {
	recording = true;
	downNow = [];
	captured = [];
	render();
	window.addEventListener("keydown", onRecordKeyDown, true);
	window.addEventListener("keyup", onRecordKeyUp, true);
	window.addEventListener("blur", stopRecording, true);
}

function stopRecording() {
	if (!recording) return;
	recording = false;
	window.removeEventListener("keydown", onRecordKeyDown, true);
	window.removeEventListener("keyup", onRecordKeyUp, true);
	window.removeEventListener("blur", stopRecording, true);

	// Drop focus, or a later Space press would re-trigger the button instead of
	// doing whatever the user actually meant.
	document.getElementById("record").blur();

	if (captured.length > 0) setVks(captured);
	else render();
}

function onRecordKeyDown(e) {
	// Swallow everything while recording, or Tab moves focus and Space clicks the button.
	e.preventDefault();
	e.stopPropagation();
	if (e.repeat) return;

	const vk = CODE_TO_VK[e.code];
	if (vk === undefined) {
		flashUnsupported(e.code);
		return;
	}

	if (!downNow.includes(vk)) downNow.push(vk);
	// Keep the largest combo seen, so releasing in any order still records Shift+W.
	if (downNow.length >= captured.length) captured = [...downNow];
	render();
}

function onRecordKeyUp(e) {
	e.preventDefault();
	e.stopPropagation();

	const vk = CODE_TO_VK[e.code];
	if (vk !== undefined) downNow = downNow.filter((v) => v !== vk);

	// Everything let go -> the user has finished expressing the combo.
	if (downNow.length === 0) stopRecording();
}

function onModChange() {
	const checked = [...document.querySelectorAll("#mods input:checked")].map((el) => Number(el.dataset.vk));
	setVks([...checked, ...currentMain()]);
}

function flashUnsupported(code) {
	const el = document.getElementById("summary");
	el.className = "summary error";
	el.innerHTML = `<b>${code}</b> can't be recorded. Pick it from the list below if it's there.`;
}

// --- Rendering ------------------------------------------------------------

function caps(vks) {
	if (vks.length === 0) return '<span class="empty">nothing yet</span>';
	return vks.map((vk) => `<kbd>${VK_LABELS[vk] ?? `VK ${vk}`}</kbd>`).join('<span class="plus">+</span>');
}

function render() {
	const btn = document.getElementById("record");
	const preview = document.getElementById("preview");

	if (recording) {
		btn.classList.add("recording");
		btn.textContent = "Press the keys you want…";
		preview.innerHTML = caps(downNow.length ? downNow : captured);
		document.getElementById("summary").className = "summary hidden";
		return;
	}

	btn.classList.remove("recording");
	const vks = currentVks();
	btn.textContent = vks.length ? "Record again" : "Click to record";
	preview.innerHTML = caps(vks);

	// The manual controls mirror whatever is set, however it got set.
	for (const cb of document.querySelectorAll("#mods input")) {
		cb.checked = vks.includes(Number(cb.dataset.vk));
	}

	const list = document.getElementById("fallback");
	if (list) {
		const main = currentMain();
		list.value = main.length === 1 ? String(main[0]) : "";
	}

	const mode = document.getElementById("mode");
	if (mode) mode.value = settings.mode ?? "scancode";

	const el = document.getElementById("summary");
	if (vks.length === 0) {
		el.className = "summary error";
		el.innerHTML = "<b>No keys set.</b> This button won't do anything yet.";
	} else {
		el.className = "summary";
		el.innerHTML = `${document.body.dataset.verb} <b>${vks.map((v) => VK_LABELS[v] ?? v).join(" + ")}</b>`;
	}
}

function build() {
	document.getElementById("record").addEventListener("click", () => {
		if (recording) stopRecording();
		else startRecording();
	});

	document.getElementById("clear").addEventListener("click", () => setVks([]));

	// Modifier checkboxes. Two columns, filled row by row, so Left stacks on the left.
	const mods = document.getElementById("mods");
	for (const row of MODIFIER_ROWS) {
		for (const [vk, label] of row) {
			const el = document.createElement("label");
			el.className = "mod";
			const cb = document.createElement("input");
			cb.type = "checkbox";
			cb.dataset.vk = String(vk);
			cb.addEventListener("change", onModChange);
			el.append(cb, document.createTextNode(label));
			mods.append(el);
		}
	}

	// Manual key picker, always visible -- recording is nicer, but some keys never
	// reach this window and some people would just rather pick from a list.
	const list = document.getElementById("fallback");
	const none = document.createElement("option");
	none.value = "";
	none.textContent = "(none)";
	list.append(none);
	for (const [name, vks] of KEY_GROUPS) {
		const og = document.createElement("optgroup");
		og.label = name;
		for (const vk of vks) {
			const opt = document.createElement("option");
			opt.value = String(vk);
			opt.textContent = VK_LABELS[vk] ?? `VK ${vk}`;
			og.append(opt);
		}
		list.append(og);
	}
	list.addEventListener("change", (e) => {
		const value = e.target.value;
		setVks(value === "" ? currentMods() : [...currentMods(), Number(value)]);
	});

	document.getElementById("mode").addEventListener("change", (e) => {
		settings.mode = e.target.value;
		save();
	});
}

document.addEventListener("DOMContentLoaded", build);
