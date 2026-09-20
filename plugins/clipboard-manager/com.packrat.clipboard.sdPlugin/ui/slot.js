/**
 * Property inspector for the Clipboard Slot action. Talks the Stream Deck PI websocket
 * directly, so the plugin ships no third-party UI code.
 */

let websocket = null;
let uuid = null;
let settings = {};
let historyCount = 0;

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
		websocket.send(JSON.stringify({ event: "getGlobalSettings", context: inUUID }));
		build();
		render();
	};
	websocket.onmessage = (e) => {
		const msg = JSON.parse(e.data);
		if (msg.event === "didReceiveSettings") {
			settings = msg.payload.settings ?? {};
			render();
		}
		if (msg.event === "didReceiveGlobalSettings") {
			historyCount = msg.payload.settings?.history?.length ?? 0;
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
	document.getElementById("slot").value = settings.slotIndex ? String(settings.slotIndex) : "";
	document.getElementById("press").value = settings.pasteMode ?? "direct";
	document.getElementById("preview").value = String(settings.previewLength ?? 40);
	document.getElementById("history-limit-hint").hidden = historyCount < 4;
}

function build() {
	document.getElementById("slot").addEventListener("change", (e) => {
		settings.slotIndex = e.target.value ? Number(e.target.value) : undefined;
		save();
	});

	document.getElementById("press").addEventListener("change", (e) => {
		settings.pasteMode = e.target.value;
		save();
	});

	document.getElementById("preview").addEventListener("change", (e) => {
		settings.previewLength = Number(e.target.value);
		save();
	});
}
