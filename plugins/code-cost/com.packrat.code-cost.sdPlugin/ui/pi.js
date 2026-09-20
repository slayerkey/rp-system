/**
 * Property inspector for the Cost action. Two selects, no probe: everything this key needs is
 * already in its own settings, so there is no round trip to the plugin the way the sport
 * trackers need for their team lists.
 */
let ws;
let uuid;
let settings = {};

const FIELDS = ["period", "scope"];

function save() {
	ws.send(JSON.stringify({ event: "setSettings", context: uuid, payload: settings }));
}

function apply() {
	for (const id of FIELDS) {
		const el = document.getElementById(id);
		if (el && settings[id]) el.value = settings[id];
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

	for (const id of FIELDS) {
		const el = document.getElementById(id);
		if (!el) continue;
		el.addEventListener("change", () => {
			settings[id] = el.value;
			save();
		});
	}
}
