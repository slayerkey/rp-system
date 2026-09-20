/**
 * Property inspector for the Run Sequence action: the sequence builder.
 *
 * Talks the Stream Deck PI websocket directly, so the plugin ships no third-party UI code.
 * The rows are rebuilt from the settings object on every change rather than mutated in place,
 * which keeps the displayed list and the saved list from ever drifting apart. That matters
 * more here than elsewhere, because reordering and removing rows are the two operations most
 * likely to leave a partially updated DOM behind.
 *
 * TIER decides what this build offers. The paid plugin ships the same file with "pro".
 */
const TIER = "lite";

const LIMITS = { lite: { max: 5, types: ["launch", "key", "wait", "url"] }, pro: { max: 25, types: ["launch", "key", "wait", "url", "check", "http"] } };
const { max: MAX_STEPS, types: STEP_TYPES } = LIMITS[TIER];

const TYPE_LABELS = {
	launch: "Open a program",
	key: "Press keys",
	wait: "Wait",
	url: "Open a link",
	check: "Only carry on if",
	http: "Send a web request"
};

/** Windows virtual-key codes. The plugin translates these for macOS when it sends them. */
const KEYS = (() => {
	const out = [];
	for (let i = 0; i < 26; i++) out.push({ vk: 65 + i, name: String.fromCharCode(65 + i) });
	for (let i = 0; i <= 9; i++) out.push({ vk: 48 + i, name: String(i) });
	for (let i = 1; i <= 12; i++) out.push({ vk: 111 + i, name: `F${i}` });
	out.push(
		{ vk: 13, name: "Enter" }, { vk: 27, name: "Escape" }, { vk: 9, name: "Tab" }, { vk: 32, name: "Space" },
		{ vk: 8, name: "Backspace" }, { vk: 46, name: "Delete" }, { vk: 38, name: "Up" }, { vk: 40, name: "Down" },
		{ vk: 37, name: "Left" }, { vk: 39, name: "Right" }, { vk: 36, name: "Home" }, { vk: 35, name: "End" },
		{ vk: 33, name: "Page Up" }, { vk: 34, name: "Page Down" }
	);
	return out;
})();

const MODIFIERS = [
	{ bit: 2, label: "Ctrl", macLabel: "Cmd" },
	{ bit: 1, label: "Shift", macLabel: "Shift" },
	{ bit: 4, label: "Alt", macLabel: "Option" }
];

const WAITS = [250, 500, 1000, 2000, 3000, 5000, 10000];

let websocket = null;
let uuid = null;
let settings = {};

// eslint-disable-next-line no-unused-vars
function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
	uuid = inUUID;
	try {
		settings = JSON.parse(inActionInfo).payload.settings ?? {};
	} catch {
		settings = {};
	}
	if (!Array.isArray(settings.steps)) settings.steps = [];

	websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
	websocket.onopen = () => {
		websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
		bindStatic();
		render();
	};
	websocket.onmessage = (e) => {
		const msg = JSON.parse(e.data);
		if (msg.event === "didReceiveSettings") {
			settings = msg.payload.settings ?? {};
			if (!Array.isArray(settings.steps)) settings.steps = [];
			render();
		}
	};
}

function save() {
	if (websocket?.readyState === WebSocket.OPEN) {
		websocket.send(JSON.stringify({ event: "setSettings", context: uuid, payload: settings }));
	}
}

/** Saves and redraws. Every edit goes through here so the two can never disagree. */
function commit() {
	save();
	render();
}

function bindStatic() {
	document.getElementById("name").addEventListener("input", (e) => {
		settings.name = e.target.value;
		save(); // No redraw: rebuilding the rows would steal focus from the field being typed in.
	});

	document.getElementById("add").addEventListener("click", () => {
		if (settings.steps.length >= MAX_STEPS) return;
		settings.steps.push(defaultStep("launch"));
		commit();
	});
}

function defaultStep(type) {
	switch (type) {
		case "launch":
			return { type: "launch", path: "", args: "" };
		case "key":
			return { type: "key", vk: 65, modifiers: 2 };
		case "wait":
			return { type: "wait", ms: 1000 };
		case "url":
			return { type: "url", url: "https://" };
		case "check":
			return { type: "check", kind: "process", value: "", expect: "running" };
		case "http":
			return { type: "http", method: "POST", url: "https://", body: "", onFail: "stop" };
		default:
			return { type: "wait", ms: 1000 };
	}
}

function el(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function select(options, value, onChange) {
	const node = el("select");
	for (const opt of options) {
		const option = el("option", null, opt.label);
		option.value = String(opt.value);
		node.appendChild(option);
	}
	node.value = String(value);
	node.addEventListener("change", (e) => onChange(e.target.value));
	return node;
}

function textInput(value, placeholder, onInput) {
	const node = el("input");
	node.type = "text";
	node.value = value ?? "";
	node.placeholder = placeholder;
	node.addEventListener("input", (e) => onInput(e.target.value));
	return node;
}

function render() {
	document.getElementById("name").value = settings.name ?? "";

	const list = document.getElementById("steps");
	list.textContent = "";

	settings.steps.forEach((step, index) => list.appendChild(renderStep(step, index)));

	const full = settings.steps.length >= MAX_STEPS;
	document.getElementById("add").disabled = full;
	document.getElementById("stepsHeading").textContent = `Steps (${settings.steps.length} of ${MAX_STEPS})`;
	document.getElementById("limitHint").textContent = full
		? `That is as many steps as one key holds${TIER === "lite" ? ". The paid version holds twenty five." : "."}`
		: "";
}

function renderStep(step, index) {
	const row = el("div", "step");

	// --- header: number, type, reorder, remove ---
	const head = el("div", "stepHead");
	head.appendChild(el("span", "stepNum", String(index + 1)));

	head.appendChild(
		select(
			STEP_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
			step.type,
			(value) => {
				// Switching type replaces the row wholesale: keeping the old fields around would
				// save a url on a wait step and quietly fail validation later.
				settings.steps[index] = defaultStep(value);
				commit();
			}
		)
	);

	const up = el("button", "iconBtn", "↑");
	up.type = "button";
	up.disabled = index === 0;
	up.title = "Move up";
	up.addEventListener("click", () => move(index, -1));
	head.appendChild(up);

	const down = el("button", "iconBtn", "↓");
	down.type = "button";
	down.disabled = index === settings.steps.length - 1;
	down.title = "Move down";
	down.addEventListener("click", () => move(index, 1));
	head.appendChild(down);

	const remove = el("button", "iconBtn danger", "✕");
	remove.type = "button";
	remove.title = "Remove";
	remove.addEventListener("click", () => {
		settings.steps.splice(index, 1);
		commit();
	});
	head.appendChild(remove);

	row.appendChild(head);
	row.appendChild(renderFields(step, index));
	return row;
}

function move(index, by) {
	const to = index + by;
	if (to < 0 || to >= settings.steps.length) return;
	const [step] = settings.steps.splice(index, 1);
	settings.steps.splice(to, 0, step);
	commit();
}

/** The part of a row that differs by step type. */
function renderFields(step, index) {
	const body = el("div", "stepBody");
	const set = (patch) => {
		Object.assign(settings.steps[index], patch);
		save(); // Field edits save without redrawing so typing is not interrupted.
	};

	switch (step.type) {
		case "launch": {
			body.appendChild(labelled("Program", textInput(step.path, "C:\\Program Files\\App\\app.exe", (v) => set({ path: v }))));
			body.appendChild(labelled("Extras", textInput(step.args, "optional, e.g. --fullscreen", (v) => set({ args: v }))));
			break;
		}
		case "key": {
			const isMac = navigator.platform.toLowerCase().includes("mac");
			const mods = el("div", "mods");
			for (const mod of MODIFIERS) {
				const wrap = el("label", "modOpt");
				const box = el("input");
				box.type = "checkbox";
				box.checked = ((step.modifiers ?? 0) & mod.bit) !== 0;
				box.addEventListener("change", (e) => {
					const current = settings.steps[index].modifiers ?? 0;
					set({ modifiers: e.target.checked ? current | mod.bit : current & ~mod.bit });
				});
				wrap.appendChild(box);
				wrap.appendChild(el("span", null, isMac ? mod.macLabel : mod.label));
				mods.appendChild(wrap);
			}
			body.appendChild(labelled("Hold", mods));
			body.appendChild(
				labelled("Key", select(KEYS.map((k) => ({ value: k.vk, label: k.name })), step.vk ?? 65, (v) => set({ vk: Number(v) })))
			);
			break;
		}
		case "wait": {
			body.appendChild(
				labelled(
					"For",
					select(WAITS.map((ms) => ({ value: ms, label: ms >= 1000 ? `${ms / 1000} seconds` : `${ms} ms` })), step.ms ?? 1000, (v) =>
						set({ ms: Number(v) })
					)
				)
			);
			break;
		}
		case "url": {
			body.appendChild(labelled("Link", textInput(step.url, "https://", (v) => set({ url: v }))));
			break;
		}
		case "check": {
			body.appendChild(
				labelled(
					"Program",
					select([{ value: "running", label: "is running" }, { value: "not-running", label: "is not running" }], step.expect ?? "running", (v) =>
						set({ expect: v })
					)
				)
			);
			body.appendChild(labelled("Called", textInput(step.value, "obs64.exe", (v) => set({ value: v }))));
			break;
		}
		case "http": {
			body.appendChild(
				labelled("Send", select([{ value: "POST", label: "POST" }, { value: "GET", label: "GET" }], step.method ?? "POST", (v) => set({ method: v })))
			);
			body.appendChild(labelled("To", textInput(step.url, "https://", (v) => set({ url: v }))));
			if ((step.method ?? "POST") === "POST") {
				body.appendChild(labelled("With", textInput(step.body, 'optional, e.g. {"live":true}', (v) => set({ body: v }))));
			}
			body.appendChild(
				labelled(
					"If it fails",
					select([{ value: "stop", label: "stop the routine" }, { value: "continue", label: "carry on anyway" }], step.onFail ?? "stop", (v) =>
						set({ onFail: v })
					)
				)
			);
			break;
		}
	}

	return body;
}

function labelled(label, control) {
	const row = el("div", "row");
	row.appendChild(el("label", "key", label));
	const field = el("div", "field");
	field.appendChild(control);
	row.appendChild(field);
	return row;
}
