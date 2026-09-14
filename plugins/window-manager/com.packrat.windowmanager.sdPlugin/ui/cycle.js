/**
 * Property inspector for the Cycle Windows action. Talks the Stream Deck PI websocket
 * directly, so the plugin ships no third-party UI code.
 */

let websocket = null;
let uuid = null;
let pluginUuid = null;
let settings = {};

// eslint-disable-next-line no-unused-vars
function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
	uuid = inUUID;
	try { pluginUuid = JSON.parse(inInfo)?.plugin?.uuid ?? null; } catch { pluginUuid = null; }
	try {
		settings = JSON.parse(inActionInfo).payload.settings ?? {};
	} catch {
		settings = {};
	}

	websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
	websocket.onopen = () => {
		websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
		build();
		render();
	};
	websocket.onmessage = (e) => {
		const msg = JSON.parse(e.data);
		if (msg.event === "didReceiveSettings") {
			settings = msg.payload.settings ?? {};
			render();
		}
	};
}

function save() {
	if (websocket?.readyState === WebSocket.OPEN) {
		websocket.send(JSON.stringify({ event: "setSettings", context: uuid, payload: settings }));
	}
}

function render() {
	document.getElementById("scope").value = settings.scope ?? "all";
}

function build() {
	document.getElementById("scope").addEventListener("change", (e) => {
		settings.scope = e.target.value;
		save();
	});
}
