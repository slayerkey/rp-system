/* Network Dashboard font choice reconciliation.
 * Mirrors Performance Grapher's font set and, like the other Network recovery
 * settings, reads iCUE's live document-level binding so page changes are not needed. */
(function () {
  "use strict";

  var WATCH_MS = 140;
  var timer = null;
  var lastFont = "";
  var allowed = {
    system: true,
    bahnschriftSemi: true,
    bahnschrift: true,
    segoe: true,
    arial: true,
    consolas: true
  };

  function usable(value) {
    return value !== undefined && value !== null && value !== ""
      && !(typeof Node !== "undefined" && value instanceof Node);
  }

  function readFontBinding() {
    try {
      if (typeof globalThis.__ratpackIcueRead === "function") {
        var bridged = globalThis.__ratpackIcueRead("fontChoice");
        if (usable(bridged)) return bridged;
      }
    } catch (error) { }
    try {
      if (typeof fontChoice !== "undefined" && usable(fontChoice)) return fontChoice;
    } catch (error) { }
    try {
      if (usable(globalThis.fontChoice)) return globalThis.fontChoice;
    } catch (error) { }
    return "system";
  }

  function normalize(value) {
    var choice = String(value == null ? "system" : value).trim();
    return allowed[choice] ? choice : "system";
  }

  function applyFont() {
    if (typeof document === "undefined" || !document.body) return "system";
    var choice = normalize(readFontBinding());
    if (choice !== lastFont || document.body.getAttribute("data-font") !== choice) {
      document.body.setAttribute("data-font", choice);
      lastFont = choice;
      void document.body.offsetHeight;
    }
    return choice;
  }

  function start() {
    applyFont();
    clearInterval(timer);
    timer = setInterval(applyFont, WATCH_MS);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) applyFont();
    });
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pageshow", applyFont);
  }

  globalThis.__netDashboardFontTest = {
    apply: applyFont,
    read: readFontBinding,
    normalize: normalize
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})();
