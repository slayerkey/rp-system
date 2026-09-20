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

function entries() {
	const pinned = globalSettings.pinned ?? [];
	const pinnedText = new Set(pinned.map((entry) => entry.text));
	return [...pinned, ...(globalSettings.history ?? []).filter((entry) => !pinnedText.has(entry.text))];
}

function matches() {
	const terms = (settings.query ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	return entries().filter((entry) => {
		const text = entry.text.toLocaleLowerCase();
		return terms.every((term) => text.includes(term));
	});
}

function render() {
	document.getElementById("query").value = settings.query ?? "";
	document.getElementById("name").value = settings.customName ?? "";
	document.getElementById("press").value = settings.pasteMode ?? "direct";
	document.getElementById("preview").value = String(settings.previewLength ?? 40);

	const found = matches();
	const results = document.getElementById("results");
	results.replaceChildren();
	if (found.length === 0) {
		const option = document.createElement("option");
		option.textContent = "No matches";
		option.value = "";
		results.append(option);
	} else {
		for (const item of found) {
			const option = document.createElement("option");
			option.value = String(item.copiedAt);
			option.textContent = item.text.replace(/\s+/g, " ").slice(0, 90);
			results.append(option);
		}
		const selected = found.some((item) => item.copiedAt === settings.selectedCopiedAt)
			? settings.selectedCopiedAt
			: found[0].copiedAt;
		results.value = String(selected);
	}
	document.getElementById("match-count").textContent = `${found.length} matching entries.`;
}

function selectFirstMatch() {
	const first = matches()[0];
	settings.selectedCopiedAt = first?.copiedAt;
}

function build() {
	document.getElementById("query").addEventListener("input", (event) => {
		settings.query = event.target.value;
		selectFirstMatch();
		save();
		render();
	});
	document.getElementById("results").addEventListener("change", (event) => {
		settings.selectedCopiedAt = event.target.value ? Number(event.target.value) : undefined;
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
