/** Shared Window Manager Lite chrome: PackRat brand, top Pro CTA, and XENEON setup. */

const PRO_URL =
  "https://marketplace.elgato.com/product/window-manager-pro-f3ed6217-0282-419d-a71d-4b1548147b11";
const PACKRAT_MAKER_URL = "https://marketplace.elgato.com/maker/packrat";

let xeneonKey = "";

function send(message) {
  if (typeof websocket === "undefined" || websocket?.readyState !== WebSocket.OPEN) return false;
  websocket.send(JSON.stringify(message));
  return true;
}

function openUrl(url) {
  return send({ event: "openUrl", payload: { url } });
}

function buildPackRatTopbar() {
  if (document.querySelector(".packrat-topbar")) return;

  const topbar = document.createElement("div");
  topbar.className = "packrat-topbar";

  const brand = document.createElement("button");
  brand.type = "button";
  brand.className = "packrat-brand";
  brand.setAttribute("aria-label", "Open the PackRat maker page");
  brand.innerHTML =
    '<img class="packrat-logo" src="../imgs/plugin/packrat-logo.png" alt="" aria-hidden="true"><span>PackRat ↗</span>';
  brand.addEventListener("click", () => openUrl(PACKRAT_MAKER_URL));

  const upgrade = document.createElement("button");
  upgrade.type = "button";
  upgrade.className = "primary packrat-upgrade";
  upgrade.id = "openWindowManagerPro";
  upgrade.textContent = "Upgrade to Pro ↗";
  upgrade.addEventListener("click", () => openUrl(PRO_URL));

  topbar.append(brand, upgrade);
  document.body.prepend(topbar);
}


function buildProFooter() {
  if (document.querySelector(".upsell")) return;

  const footer = document.createElement("div");
  footer.className = "upsell";
  footer.innerHTML = `
    <div class="upsell-eyebrow">WINDOW MANAGER PRO</div>
    <h3>Save layouts. Nudge precisely.</h3>
    <p>Lite gives you Snap + Cycle. Pro adds the two controls that turn it into a fuller window-management setup.</p>
    <ul class="upsell-list">
      <li><strong>Window Layout</strong> — hold to save a complete arrangement, then press once to restore it.</li>
      <li><strong>Nudge Window</strong> — move or resize in small steps, including Stream Deck + dial control.</li>
    </ul>
    <button type="button" class="primary pro-button" id="openWindowManagerProBottom">Open Window Manager Pro ↗</button>
  `;

  document.body.append(footer);
  document.getElementById("openWindowManagerProBottom").addEventListener("click", () => openUrl(PRO_URL));
}

function buildXeneonSetup() {
  const section = document.createElement("div");
  section.className = "xeneon-setup";
  section.innerHTML = `
    <h3>XENEON Edge</h3>
    <p>Window Manager Lite also powers the separate Window Manager for XENEON widget.</p>
    <div class="xeneon-key" id="xeneonKey">Loading local pairing key…</div>
    <div class="xeneon-buttons">
      <button type="button" id="copyXeneonKey" disabled>Copy key</button>
      <button type="button" id="openXeneonSetup">Open setup page</button>
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
    openUrl("http://127.0.0.1:17487/");
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

document.addEventListener("DOMContentLoaded", () => {
  buildPackRatTopbar();
  buildXeneonSetup();
  buildProFooter();
});
