/**
 * The Pro footnote that every property inspector ends with.
 *
 * Injected from one file rather than pasted into four pages so the copy and the link
 * can't drift apart.
 *
 * The link rides the socket keys.js / mouse.js already opened: `websocket` is a
 * top-level `let` in a classic script, which is a global binding every other classic
 * script on the page can see. It has to go through the SDK's openUrl event -- a plain
 * <a target="_blank"> frequently does nothing at all in the embedded webview, which
 * would look like a dead link.
 */

const PRO_URL =
	"https://marketplace.elgato.com/product/better-hotkeys-mouse-pro-d1c3b3f3-1589-4884-b729-6d5eaa457c24";

function buildProFooter() {
	const footer = document.createElement("div");
	footer.className = "upsell";

	const line = document.createElement("p");
	line.textContent = "Pro adds radial menus, auto-repeat, scroll, mouse drag, push to talk and dial control.";

	const link = document.createElement("button");
	link.id = "pro-link";
	link.type = "button";
	link.className = "link";
	link.textContent = "Better Hotkeys & Mouse Pro";
	link.addEventListener("click", openPro);

	footer.append(line, link);
	document.body.append(footer);
}

function openPro() {
	// Read lazily: the socket is opened by connectElgatoStreamDeckSocket, which the
	// Stream Deck app calls after this file has already been evaluated.
	if (typeof websocket === "undefined" || websocket?.readyState !== WebSocket.OPEN) return;
	websocket.send(JSON.stringify({ event: "openUrl", payload: { url: PRO_URL } }));
}

document.addEventListener("DOMContentLoaded", buildProFooter);
