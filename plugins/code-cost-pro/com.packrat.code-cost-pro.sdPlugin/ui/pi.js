/**
 * Property inspector for every Pro action. One script, one field list per action kind, chosen
 * off `body[data-kind]`. Numeric fields are stored as numbers because the plugin compares them.
 */
let ws;
let uuid;
let settings = {};

const FIELDS = {
	cost: ["period", "scope", "budget"],
	value: ["plan", "scope"],
	breakdown: ["by", "period"],
	cache: ["period"],
	trend: ["days"]
};
const NUMERIC = new Set(["budget", "plan", "days"]);

function fieldsForPage() {
	return FIELDS[document.body.dataset.kind] || [];
}

function save() {
	ws.send(JSON.stringify({ event: "setSettings", context: uuid, payload: settings }));
}

function apply() {
	for (const id of fieldsForPage()) {
		const el = document.getElementById(id);
		if (el && settings[id] !== undefined && settings[id] !== null) el.value = settings[id];
	}
}

// eslint-disable-next-line no-unused-vars
function connectElgatoStreamDeckSocket(port, registerUUID, registerEvent, info, actionInfo) {
	uuid = registerUUID;
	try {
		settings = JSON.parse(actionInfo).payload.settings || {};
	} catch {
		settings = {};
	}
	ws = new WebSocket(`ws://127.0.0.1:${port}`);
	ws.onopen = () => {
		ws.send(JSON.stringify({ event: registerEvent, uuid: registerUUID }));
		apply();
	};
	ws.onmessage = (e) => {
		let msg;
		try {
			msg = JSON.parse(e.data);
		} catch {
			return;
		}
		if (msg.event === "didReceiveSettings") {
			settings = msg.payload.settings || {};
			apply();
		}
	};

	for (const id of fieldsForPage()) {
		const el = document.getElementById(id);
		if (!el) continue;
		el.addEventListener("change", () => {
			if (NUMERIC.has(id)) {
				const n = parseFloat(el.value);
				settings[id] = Number.isFinite(n) && n > 0 ? n : undefined;
			} else {
				settings[id] = el.value;
			}
			save();
		});
	}
}
