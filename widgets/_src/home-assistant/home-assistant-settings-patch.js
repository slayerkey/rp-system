(function () {
  'use strict';

  var testApi = globalThis.__homeAssistantPanelTest;
  var events = globalThis.icueEvents;
  if (!testApi || !events || events.__homeAssistantSettingsPatch) return;

  function read(name) {
    try {
      if (typeof globalThis.__ratpackIcueRead === 'function') {
        var value = globalThis.__ratpackIcueRead(name);
        if (value !== undefined && value !== null) return value;
      }
    } catch (error) {}
    try { return globalThis[name]; } catch (error) { return undefined; }
  }

  function applyStyle() {
    var root = document.documentElement;
    var map = { textColor:'--text', accentColor:'--accent', backgroundColor:'--bg' };
    Object.keys(map).forEach(function (name) {
      var value = read(name);
      if (value) root.style.setProperty(map[name], String(value));
    });
  }

  function connectionSignature() {
    var cfg = testApi.config();
    return JSON.stringify({
      base: cfg.base,
      token: cfg.token,
      wanted: cfg.wanted,
      refresh: cfg.refresh,
      showUnavailable: cfg.showUnavailable
    });
  }

  var previous = connectionSignature();
  var originalInit = events.onICUEInitialized;
  var originalUpdate = events.onDataUpdated;

  events.onICUEInitialized = function () {
    previous = connectionSignature();
    applyStyle();
    if (typeof originalInit === 'function') return originalInit.apply(this, arguments);
  };

  events.onDataUpdated = function () {
    applyStyle();
    var next = connectionSignature();
    if (next === previous) return;
    previous = next;
    if (typeof originalUpdate === 'function') return originalUpdate.apply(this, arguments);
  };

  events.__homeAssistantSettingsPatch = true;
  applyStyle();
})();
