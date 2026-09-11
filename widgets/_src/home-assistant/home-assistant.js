(function () {
  'use strict';

  var cacheKey = 'packrat-ha-state-v2';
  try { if (typeof uniqueId !== 'undefined' && uniqueId) cacheKey = String(uniqueId) + ':' + cacheKey; } catch (error) {}

  var runtime = {
    socket: null,
    reconnectTimer: null,
    resyncTimer: null,
    generation: 0,
    requestId: 1,
    authenticated: false,
    subscribed: false,
    wanted: [],
    byId: Object.create(null),
    lastError: '',
    connection: 'unconfigured',
    manualClose: false
  };

  function read(name, fallback) {
    try {
      if (typeof globalThis.__ratpackIcueRead === 'function') {
        var value = globalThis.__ratpackIcueRead(name);
        if (value !== undefined && value !== null) return value;
      }
    } catch (error) {}
    try {
      var globalValue = globalThis[name];
      if (globalValue !== undefined && globalValue !== null) return globalValue;
    } catch (error) {}
    return fallback;
  }

  function parseWanted(value) {
    var seen = Object.create(null);
    return String(value || '').split(/[,\n]+/).map(function (s) { return s.trim(); }).filter(function (id) {
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  function config() {
    var base = String(read('baseUrl', 'http://homeassistant.local:8123') || '').trim().replace(/\/+$/, '');
    var wanted = parseWanted(read('entities', ''));
    return {
      base: base,
      token: String(read('token', '') || '').trim(),
      wanted: wanted,
      refresh: Math.max(1, Math.min(30, Number(read('refreshMinutes', 1)) || 1)),
      showUnavailable: read('showUnavailable', false) === true
    };
  }

  function applyPersonalization() {
    var root = document.documentElement;
    var map = { textColor:'--text', accentColor:'--accent', backgroundColor:'--bg' };
    Object.keys(map).forEach(function (key) {
      var value = read(key, '');
      if (value) root.style.setProperty(map[key], String(value));
    });
  }

  function wsUrl(base) {
    return String(base || '').replace(/^http:/i,'ws:').replace(/^https:/i,'wss:') + '/api/websocket';
  }

  function saveCache() {
    try {
      var safe = {};
      runtime.wanted.forEach(function (id) { if (runtime.byId[id]) safe[id] = runtime.byId[id]; });
      localStorage.setItem(cacheKey, JSON.stringify({ at:Date.now(), states:safe }));
    } catch (error) {}
  }

  function loadCache() {
    try {
      var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (!cached || !cached.states || typeof cached.states !== 'object') return;
      Object.keys(cached.states).forEach(function (id) { runtime.byId[id] = cached.states[id]; });
    } catch (error) {}
  }

  function setConnection(state, detail) {
    runtime.connection = state;
    runtime.lastError = detail || '';
    document.body.setAttribute('data-connection', state);
    render();
  }

  function isUnavailable(entity) {
    return entity && (entity.state === 'unavailable' || entity.state === 'unknown');
  }

  var toggleDomains = { light:1, switch:1, binary_sensor:1, input_boolean:1, fan:1, lock:1, cover:1 };
  function isOn(entity) {
    if (!entity) return false;
    var domain = String(entity.entity_id || '').split('.')[0];
    if (domain === 'lock') return entity.state === 'locked';
    if (domain === 'cover') return entity.state === 'open';
    return entity.state === 'on' || entity.state === 'home' || entity.state === 'open';
  }

  function row(entity) {
    var attr = entity.attributes || {};
    var id = String(entity.entity_id || '');
    return {
      id:id,
      name:attr.friendly_name || id,
      state:String(entity.state == null ? '' : entity.state),
      unit:String(attr.unit_of_measurement || ''),
      domain:id.split('.')[0],
      on:isOn(entity),
      unavailable:isUnavailable(entity)
    };
  }

  function valueText(r) {
    if (r.unavailable) return 'n/a';
    if (toggleDomains[r.domain]) return r.on ? 'ON' : 'OFF';
    var number = Number(r.state);
    if (Number.isFinite(number) && r.state !== '') return (Math.round(number * 10) / 10) + r.unit;
    return String(r.state).replace(/_/g,' ');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; });
  }

  function visibleRows() {
    var cfg = config();
    var rows = [];
    runtime.wanted.forEach(function (id) {
      var entity = runtime.byId[id];
      if (!entity) return;
      var r = row(entity);
      if (r.unavailable && !cfg.showUnavailable) return;
      rows.push(r);
    });
    return rows;
  }

  function render() {
    applyPersonalization();
    var cfg = config();
    var host = document.getElementById('tiles');
    var status = document.getElementById('status');
    if (!host || !status) return;

    var statusText = '';
    var statusClass = 'status';
    if (runtime.connection === 'live') { statusText = 'CONNECTED · ' + cfg.wanted.length + (cfg.wanted.length === 1 ? ' ENTITY' : ' ENTITIES'); statusClass += ' live'; }
    else if (runtime.connection === 'connecting') { statusText = 'CONNECTING'; statusClass += ' connecting'; }
    else if (runtime.connection === 'auth_error') { statusText = 'TOKEN REJECTED'; statusClass += ' error'; }
    else if (runtime.connection === 'offline') { statusText = 'OFFLINE'; statusClass += ' error'; }
    else if (runtime.connection === 'reconnecting') { statusText = 'RECONNECTING'; statusClass += ' connecting'; }
    status.textContent = statusText;
    status.className = statusClass;

    if (!cfg.base || !cfg.token) {
      host.innerHTML = '<div class="empty">Add your Home Assistant address and a Long-Lived Access Token in settings.</div>';
      return;
    }
    if (!cfg.wanted.length) {
      host.innerHTML = '<div class="empty">List the entities you want to show, one per line. Copy exact IDs from Developer Tools &gt; States.</div>';
      return;
    }

    var rows = visibleRows();
    var missing = runtime.connection === 'live'
      ? runtime.wanted.filter(function (id) { return !runtime.byId[id]; })
      : [];

    if (!rows.length && !missing.length) {
      if (runtime.connection === 'auth_error') host.innerHTML = '<div class="empty">Home Assistant rejected the access token. Create a fresh Long-Lived Access Token and try again.</div>';
      else if ((runtime.connection === 'offline' || runtime.connection === 'reconnecting') && Object.keys(runtime.byId).length === 0) host.innerHTML = '<div class="empty">Cannot reach Home Assistant at this address. Check the server URL, port, and local network.</div>';
      else host.innerHTML = '<div class="empty">Connected. Matching entities are currently unavailable or hidden by the Show Unavailable setting.</div>';
      return;
    }

    var tiles = rows.map(function (r) {
      return '<div class="tile ' + (r.on ? 'on' : 'off') + (r.unavailable ? ' dead' : '') + '">' +
        '<span class="tile-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="tile-value">' + escapeHtml(valueText(r)) + '</span>' +
        '<span class="tile-domain">' + escapeHtml(r.domain.replace(/_/g,' ')) + '</span>' +
      '</div>';
    });

    tiles = tiles.concat(missing.map(function (id) {
      var domain = String(id).split('.')[0] || 'entity';
      return '<div class="tile dead missing">' +
        '<span class="tile-name">' + escapeHtml(id) + '</span>' +
        '<span class="tile-value">NOT FOUND</span>' +
        '<span class="tile-domain">' + escapeHtml(domain.replace(/_/g,' ')) + '</span>' +
      '</div>';
    }));

    host.innerHTML = tiles.join('');
  }

  function clearTimers() {
    if (runtime.reconnectTimer) { clearTimeout(runtime.reconnectTimer); runtime.reconnectTimer = null; }
    if (runtime.resyncTimer) { clearInterval(runtime.resyncTimer); runtime.resyncTimer = null; }
  }

  function closeSocket(manual) {
    runtime.manualClose = !!manual;
    try {
      if (runtime.socket) {
        runtime.socket.onopen = runtime.socket.onmessage = runtime.socket.onerror = runtime.socket.onclose = null;
        runtime.socket.close();
      }
    } catch (error) {}
    runtime.socket = null;
    runtime.authenticated = false;
    runtime.subscribed = false;
  }

  function send(message) {
    if (!runtime.socket || runtime.socket.readyState !== WebSocket.OPEN) return false;
    try { runtime.socket.send(JSON.stringify(message)); return true; } catch (error) { return false; }
  }

  function requestStates() {
    if (!runtime.authenticated) return;
    send({ id:runtime.requestId++, type:'get_states' });
  }

  function subscribeStates() {
    if (!runtime.authenticated || runtime.subscribed) return;
    runtime.subscribed = true;
    send({ id:runtime.requestId++, type:'subscribe_events', event_type:'state_changed' });
  }

  function acceptSnapshot(states) {
    if (!Array.isArray(states)) return;
    states.forEach(function (entity) {
      if (entity && entity.entity_id) runtime.byId[String(entity.entity_id)] = entity;
    });
    saveCache();
    setConnection('live');
  }

  function acceptStateChange(event) {
    var data = event && event.data;
    if (!data || !data.entity_id) return;
    var id = String(data.entity_id);
    if (data.new_state) runtime.byId[id] = data.new_state;
    else delete runtime.byId[id];
    saveCache();
    render();
  }

  function scheduleReconnect(generation) {
    if (generation !== runtime.generation || runtime.manualClose) return;
    if (runtime.reconnectTimer) return;
    setConnection('reconnecting');
    runtime.reconnectTimer = setTimeout(function () {
      runtime.reconnectTimer = null;
      if (generation === runtime.generation) connect();
    }, 2500);
  }

  function connect() {
    clearTimers();
    closeSocket(true);
    runtime.manualClose = false;
    runtime.generation += 1;
    var generation = runtime.generation;
    var cfg = config();
    runtime.wanted = cfg.wanted.slice();

    if (!cfg.base || !cfg.token || !cfg.wanted.length) {
      setConnection('unconfigured');
      return;
    }

    setConnection('connecting');
    var socket;
    try { socket = new WebSocket(wsUrl(cfg.base)); }
    catch (error) { setConnection('offline', String(error && error.message || error)); scheduleReconnect(generation); return; }
    runtime.socket = socket;

    socket.onmessage = function (event) {
      if (generation !== runtime.generation) return;
      var message;
      try { message = JSON.parse(event.data); } catch (error) { return; }
      if (message.type === 'auth_required') {
        send({ type:'auth', access_token:cfg.token });
        return;
      }
      if (message.type === 'auth_invalid') {
        runtime.manualClose = true;
        setConnection('auth_error', message.message || 'Invalid access token');
        closeSocket(true);
        return;
      }
      if (message.type === 'auth_ok') {
        runtime.authenticated = true;
        requestStates();
        subscribeStates();
        runtime.resyncTimer = setInterval(requestStates, cfg.refresh * 60000);
        return;
      }
      if (message.type === 'result' && Array.isArray(message.result)) {
        acceptSnapshot(message.result);
        return;
      }
      if (message.type === 'event' && message.event && message.event.event_type === 'state_changed') {
        acceptStateChange(message.event);
      }
    };

    socket.onerror = function () {
      if (generation !== runtime.generation || runtime.manualClose) return;
      setConnection('offline');
    };
    socket.onclose = function () {
      if (generation !== runtime.generation || runtime.manualClose) return;
      runtime.socket = null;
      runtime.authenticated = false;
      runtime.subscribed = false;
      scheduleReconnect(generation);
    };
  }

  var restartTimer = null;
  function restartSoon() {
    render();
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(connect, 250);
  }

  loadCache();
  globalThis.icueEvents = {
    onICUEInitialized: restartSoon,
    onDataUpdated: restartSoon
  };
  globalThis.__homeAssistantPanelTest = {
    config:config,
    connect:connect,
    requestStates:requestStates,
    visibleRows:visibleRows,
    state:runtime,
    wsUrl:wsUrl
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restartSoon, { once:true });
  else restartSoon();
})();
