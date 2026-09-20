/** A quiet Pro footnote for Clipboard Manager. */

const PRO_URL =
	"https://marketplace.elgato.com/product/clipboard-manager-pro-da242369-a59b-4cb5-b841-6d1ccb4dd2d0";

function buildProFooter() {
	const footer = document.createElement("div");
	footer.className = "upsell";

	const line = document.createElement("p");
	line.textContent = "Pro adds a scrolling clipboard history and a pick-any-entry picker.";

	const link = document.createElement("button");
	link.type = "button";
	link.className = "link";
	link.textContent = "Clipboard Manager Pro";
	link.addEventListener("click", openPro);

	footer.append(line, link);
	document.body.append(footer);
}

function openPro() {
	if (typeof websocket === "undefined" || websocket?.readyState !== WebSocket.OPEN) return;
	websocket.send(JSON.stringify({ event: "openUrl", payload: { url: PRO_URL } }));
}

document.addEventListener("DOMContentLoaded", buildProFooter);
