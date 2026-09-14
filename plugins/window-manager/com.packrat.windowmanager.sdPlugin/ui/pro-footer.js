/** Shared Window Manager Lite footer: XENEON setup + quiet Pro cross-sell. */

const PRO_URL =
	"https://marketplace.elgato.com/product/window-manager-pro-f3ed6217-0282-419d-a71d-4b1548147b11";

let xeneonKey = "";

function send(message) {
	if (typeof websocket === "undefined" || websocket?.readyState !== WebSocket.OPEN) return false;
	websocket.send(JSON.stringify(message));
	return true;
}

function buildXeneonSetup() {
	const section = document.createElement("div");
	section.className = "xeneon-setup";
	section.innerHTML = `
		<h3>XENEON Edge setup</h3>
		<p>Window Manager Lite also powers the separate Window Manager for XENEON widget.</p>
		<div class="xeneon-key" id="xeneonKey">Loading local pairing key…</div>
		<div class="xeneon-buttons">
			<button type="button" class="small-button" id="copyXeneonKey" disabled>Copy key</button>
			<button type="button" class="small-button secondary" id="openXeneonSetup">Open setup page</button>
		</div>
	`;
	document.body.append(section);

	document.getElementById("copyXeneonKey").addEventListener("click", async () => {
		if (!xeneonKey) return;
		try {
			await navigator.clipboard.writeText(xeneonKey);
			document.getElementById("copyXeneonKey").textContent = "Copied";
			setTimeout(() => { document.getElementById("copyXeneonKey").textContent = "Copy key"; }, 1200);
		} catch {
			document.getElementById("xeneonKey").textContent = xeneonKey;
		}
	});

	document.getElementById("openXeneonSetup").addEventListener("click", () => {
		send({ event: "openUrl", payload: { url: "http://127.0.0.1:17487/" } });
	});

	const requestSettings = () => {
		const context = (typeof pluginUuid !== "undefined" && pluginUuid) || (typeof uuid !== "undefined" && uuid);
		if (context && send({ event: "getGlobalSettings", context })) return;
		setTimeout(requestSettings, 150);
	};

	const attachListener = () => {
		if (typeof websocket === "undefined" || !websocket) return setTimeout(attachListener, 100);
		websocket.addEventListener("message", (event) => {
			let msg;
			try { msg = JSON.parse(event.data); } catch { return; }
			if (msg.event !== "didReceiveGlobalSettings") return;
			const key = msg.payload?.settings?.windowManagerXeneonKey;
			if (typeof key !== "string" || !key.trim()) return;
			xeneonKey = key.trim();
			document.getElementById("xeneonKey").textContent = xeneonKey;
			document.getElementById("copyXeneonKey").disabled = false;
		});
	};
	attachListener();
	requestSettings();
}

function buildProFooter() {
	const footer = document.createElement("div");
	footer.className = "upsell";

	const line = document.createElement("p");
	line.textContent = "Pro adds saved layouts and pixel nudging.";

	const link = document.createElement("button");
	link.type = "button";
	link.className = "link";
	link.textContent = "Window Manager Pro";
	link.addEventListener("click", openPro);

	footer.append(line, link);
	document.body.append(footer);
}

function openPro() {
	send({ event: "openUrl", payload: { url: PRO_URL } });
}

document.addEventListener("DOMContentLoaded", () => {
	buildXeneonSetup();
	buildProFooter();
});
