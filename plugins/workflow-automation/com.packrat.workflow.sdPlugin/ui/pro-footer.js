/** A quiet cross-sell footnote for Workflow Automation Lite. */

const PRO_URL =
	"https://marketplace.elgato.com/product/workflow-automation-pro-4da0b55c-edaa-4da3-a109-3f809bd48101";

function buildProFooter() {
	const footer = document.createElement("div");
	footer.className = "upsell";

	const line = document.createElement("p");
	line.textContent = "Pro runs twenty five steps and adds conditions and web requests.";

	const link = document.createElement("button");
	link.type = "button";
	link.className = "link";
	link.textContent = "Workflow Automation Pro";
	link.addEventListener("click", openPro);

	footer.append(line, link);
	document.body.append(footer);
}

function openPro() {
	if (typeof websocket === "undefined" || websocket?.readyState !== WebSocket.OPEN) return;
	websocket.send(JSON.stringify({ event: "openUrl", payload: { url: PRO_URL } }));
}

document.addEventListener("DOMContentLoaded", buildProFooter);
