/** A quiet Pro footnote for Claude & Codex Cost Lite. */

const PRO_URL =
	"https://marketplace.elgato.com/product/claude-codex-cost-pro-16445ae9-3baf-4967-bc0a-f142ae6894d3";

function buildProFooter() {
	const footer = document.createElement("div");
	footer.className = "upsell";

	const line = document.createElement("p");
	line.textContent = "Pro adds a per model breakdown, cache savings and spend trends.";

	const link = document.createElement("button");
	link.type = "button";
	link.className = "link";
	link.textContent = "Claude & Codex Cost Pro";
	link.addEventListener("click", openPro);

	footer.append(line, link);
	document.body.append(footer);
}

function openPro() {
	if (typeof ws === "undefined" || ws?.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ event: "openUrl", payload: { url: PRO_URL } }));
}

document.addEventListener("DOMContentLoaded", buildProFooter);
