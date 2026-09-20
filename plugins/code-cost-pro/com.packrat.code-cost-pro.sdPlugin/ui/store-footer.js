/**
 * The Packrat footnote every property inspector ends with.
 *
 * Injected from one file rather than pasted into each page so the copy and the link cannot
 * drift apart. Same approach as better-hotkeys-mouse/ui/pro-footer.js.
 *
 * The link rides the socket pi.js already opened: `ws` is a top-level `let` in a classic
 * script, which is a global binding every other classic script on the page can see. It has to
 * go through the SDK's openUrl event. A plain <a target="_blank"> frequently does nothing at
 * all in the embedded webview, which would look like a dead link.
 */

const STORE_URL = "https://marketplace.elgato.com/@packrat";

function buildStoreFooter() {
	const footer = document.createElement("div");
	footer.className = "upsell";

	const line = document.createElement("p");
	line.textContent = "More Stream Deck plugins, profiles and icon packs from Packrat.";

	const link = document.createElement("button");
	link.id = "store-link";
	link.type = "button";
	link.className = "link";
	link.textContent = "Browse Packrat";
	link.addEventListener("click", openStore);

	footer.append(line, link);
	document.body.append(footer);
}

function openStore() {
	// Read lazily: the socket is opened by connectElgatoStreamDeckSocket, which the Stream Deck
	// app calls after this file has already been evaluated.
	if (typeof ws === "undefined" || ws?.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ event: "openUrl", payload: { url: STORE_URL } }));
}

document.addEventListener("DOMContentLoaded", buildStoreFooter);
