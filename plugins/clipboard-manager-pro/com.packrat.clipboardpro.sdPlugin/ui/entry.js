let websocket = null;
let uuid = null;
let settings = {};
let globalSettings = {};

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
	websocket.onmessage = (event) => {
		const message = JSON.parse(event.data);
		if (message.event === "didReceiveSettings") settings = message.payload.settings ?? {};
		if (message.event === "didReceiveGlobalSettings") globalSettings = message.payload.settings ?? {};
		render();
	};
}

function save() {
	if (websocket?.readyState === WebSocket.OPEN) {
		websocket.send(JSON.stringify({ event: "setSettings", context: uuid, payload: settings }));
	}
}

function render() {
	document.getElementById("source").value = settings.source ?? "recent";
	document.getElementById("slot").value = String(settings.slotIndex ?? 1);
	document.getElementById("name").value = settings.customName ?? "";
	document.getElementById("press").value = settings.pasteMode ?? "direct";
	document.getElementById("preview").value = String(settings.previewLength ?? 40);
	const count = settings.source === "pinned" ? globalSettings.pinned?.length ?? 0 : globalSettings.history?.length ?? 0;
	document.getElementById("count").textContent = `${count} ${settings.source === "pinned" ? "pinned" : "recent"} entries available.`;
}

function build() {
	const slot = document.getElementById("slot");
	for (let index = 1; index <= 20; index++) {
		const option = document.createElement("option");
		option.value = String(index);
		option.textContent = index === 1 ? "1, newest" : String(index);
		slot.append(option);
	}
	document.getElementById("source").addEventListener("change", (event) => {
		settings.source = event.target.value;
		save();
		render();
	});
	slot.addEventListener("change", (event) => {
		settings.slotIndex = Number(event.target.value);
		save();
	});
	document.getElementById("name").addEventListener("input", (event) => {
		settings.customName = event.target.value;
		save();
	});
	document.getElementById("press").addEventListener("change", (event) => {
		settings.pasteMode = event.target.value;
		save();
	});
	document.getElementById("preview").addEventListener("change", (event) => {
		settings.previewLength = Number(event.target.value);
		save();
	});
}
