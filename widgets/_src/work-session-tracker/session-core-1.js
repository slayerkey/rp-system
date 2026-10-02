  'use strict';

  var SLOT_SPECS = [
    { id: 's-h', w: 840, h: 344 }, { id: 's-v', w: 696, h: 416 },
    { id: 'm-h', w: 840, h: 696 }, { id: 'm-v', w: 696, h: 840 },
    { id: 'l-h', w: 1688, h: 696 }, { id: 'l-v', w: 696, h: 1688 },
    { id: 'xl-h', w: 2536, h: 696 }, { id: 'xl-v', w: 696, h: 2536 }
  ];
  var PALETTE = ['#2BE86A', '#62A8FF', '#A879FF', '#FFB454', '#FF6B7A', '#45D6D1'];
  var EDITION = String(globalThis.WORK_SESSION_EDITION || 'lite').toLowerCase() === 'pro' ? 'pro' : 'lite';
  var IS_PRO = EDITION === 'pro';
  var PRO_UPGRADE_URL = 'https://marketplace.elgato.com/product/work-session-tracker-pro-f8e12d94-4354-41ca-b6da-beb2297fb9e2';
  var STORAGE_VERSION = 2;
  // Share running sessions between instances of the same edition, while retaining
  // the original per-widget key as a non-destructive migration fallback.
  var SHARED_STATE_KEY = 'packrat:work-session:' + EDITION + ':shared-state-v2';
  var RENDER_TIMER = null;
  var lastActionAt = -Infinity;
  var lastWall = Date.now();
  var lastMono = typeof performance !== 'undefined' ? performance.now() : 0;
  var testNow = null;
  var currentView = 'today';
  var selectedColor = 0;
  var state = loadState();

  function getIcueProperty(name, fallback) {
    try {
      var value = globalThis[name];
      if (typeof Node !== 'undefined' && value instanceof Node) return fallback;
      if (value === undefined || value === null) return fallback;
      return value;
    } catch (error) { return fallback; }
  }

  function instanceKey(name) {
    var id = 'packrat';
    try { if (typeof uniqueId !== 'undefined' && uniqueId) id = String(uniqueId); } catch (error) {}
    return id + ':work-session:' + EDITION + ':' + name;
  }

  function defaultState() {
    return {
      version: STORAGE_VERSION,
      active: null,
      sessions: [],
      projects: [],
      lastProjectName: '',
      sequence: 0,
      updatedAtMs: 0
    };
  }

  function normalizeSegment(segment) {
    if (!segment || !Number.isFinite(Number(segment.startMs))) return null;
    var start = Number(segment.startMs);
    var end = segment.endMs === null || segment.endMs === undefined ? null : Number(segment.endMs);
    if (end !== null && (!Number.isFinite(end) || end < start)) end = start;
    return { startMs: start, endMs: end };
  }

  function normalizeSession(session) {
    if (!session || !Array.isArray(session.segments)) return null;
    var segments = session.segments.map(normalizeSegment).filter(Boolean).map(function (segment) {
      if (segment.endMs === null) segment.endMs = segment.startMs;
      return segment;
    });
    if (!segments.length) return null;
    var started = Number.isFinite(Number(session.startedAtMs)) ? Number(session.startedAtMs) : segments[0].startMs;
    var ended = Number.isFinite(Number(session.endedAtMs)) ? Number(session.endedAtMs) : segments[segments.length - 1].endMs;
    return {
      id: String(session.id || 'legacy-' + started),
      name: String(session.name || (session.kind === 'break' ? 'Break' : 'Focus Session')).slice(0, 72),
      projectId: session.projectId ? String(session.projectId) : null,
      color: safeColor(session.color),
      kind: session.kind === 'break' ? 'break' : 'focus',
      startedAtMs: started,
      endedAtMs: Math.max(started, ended),
      segments: segments,
      manualAdjustmentMs: clampNumber(session.manualAdjustmentMs, -86400000, 86400000, 0)
    };
  }

  function normalizeActive(active) {
    if (!active || !Array.isArray(active.segments)) return null;
    var segments = active.segments.map(normalizeSegment).filter(Boolean);
    if (!segments.length) return null;
    var running = active.status !== 'paused';
    if (running) {
      for (var i = 0; i < segments.length - 1; i++) if (segments[i].endMs === null) segments[i].endMs = segments[i].startMs;
      if (segments[segments.length - 1].endMs !== null) running = false;
    } else {
      segments.forEach(function (segment) { if (segment.endMs === null) segment.endMs = segment.startMs; });
    }
    return {
      id: String(active.id || 'active'),
      name: String(active.name || (active.kind === 'break' ? 'Break' : 'Focus Session')).slice(0, 72),
      projectId: active.projectId ? String(active.projectId) : null,
      color: safeColor(active.color),
      kind: active.kind === 'break' ? 'break' : 'focus',
      startedAtMs: Number.isFinite(Number(active.startedAtMs)) ? Number(active.startedAtMs) : segments[0].startMs,
      status: running ? 'running' : 'paused',
      segments: segments
    };
  }

  function loadState() {
    var base = defaultState();
    try {
      var legacy = null;
      var shared = null;
      try { legacy = JSON.parse(localStorage.getItem(instanceKey('state')) || 'null'); } catch (error) {}
      try { shared = JSON.parse(localStorage.getItem(SHARED_STATE_KEY) || 'null'); } catch (error) {}
      var isState = function (value) { return value && typeof value === 'object' && !Array.isArray(value); };
      if (!isState(legacy)) legacy = null;
      if (!isState(shared)) shared = null;
      // An existing instance wins when its data is newer; new screen instances
      // without a legacy key recover the most recently saved shared state.
      var parsed = legacy;
      if (shared && (!legacy || Number(shared.updatedAtMs || 0) > Number(legacy.updatedAtMs || 0))) parsed = shared;
      if (!parsed) return seedFixture(base);
      base.active = normalizeActive(parsed.active);
      base.sessions = Array.isArray(parsed.sessions) ? parsed.sessions.map(normalizeSession).filter(Boolean) : [];
      base.projects = Array.isArray(parsed.projects) ? parsed.projects.slice(0, 30).map(function (project, index) {
        return { id: String(project.id || 'p-' + index), name: String(project.name || 'Project').slice(0, 72), color: safeColor(project.color) };
      }) : [];
      base.lastProjectName = String(parsed.lastProjectName || '').slice(0, 72);
      base.sequence = clampNumber(parsed.sequence, 0, 1000000000, 0);
      base.updatedAtMs = clampNumber(parsed.updatedAtMs, 0, Number.MAX_SAFE_INTEGER, 0);
    } catch (error) {}
    return seedFixture(base);
  }

  function seedFixture(base) {
    try {
      var fixture = globalThis.__workSessionFixture;
      if (!fixture || typeof fixture !== 'object') return base;
      var merged = defaultState();
      merged.active = normalizeActive(fixture.active);
      merged.sessions = Array.isArray(fixture.sessions) ? fixture.sessions.map(normalizeSession).filter(Boolean) : [];
      merged.projects = Array.isArray(fixture.projects) ? fixture.projects.map(function (p, i) {
        return { id: String(p.id || 'fixture-' + i), name: String(p.name || 'Project'), color: safeColor(p.color) };
      }) : [];
      merged.lastProjectName = String(fixture.lastProjectName || '');
      merged.sequence = Number(fixture.sequence || 20);
      return merged;
    } catch (error) { return base; }
  }

  function saveState() {
    pruneHistory();
    state.version = STORAGE_VERSION;
    state.updatedAtMs = nowMs();
    try {
      var serialized = JSON.stringify(state);
      localStorage.setItem(instanceKey('state'), serialized);
      localStorage.setItem(SHARED_STATE_KEY, serialized);
    } catch (error) {
      // In-memory tracking remains functional if iCUE storage is unavailable.
      console.warn('Work Session Tracker could not persist session state', error);
    }
  }

  function clampNumber(value, min, max, fallback) {
    var num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  function safeColor(value) {
    var text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text : '#2BE86A';
  }

  function rawNowMs() { return testNow === null ? Date.now() : Number(testNow); }
  function nowMs() { return rawNowMs(); }

  function watchClock() {
    if (testNow !== null || !state.active || state.active.status !== 'running') {
      lastWall = Date.now();
      lastMono = typeof performance !== 'undefined' ? performance.now() : lastMono;
      return;
    }
    var wall = Date.now();
    var mono = typeof performance !== 'undefined' ? performance.now() : lastMono + Math.max(0, wall - lastWall);
    var wallDelta = wall - lastWall;
    var monoDelta = mono - lastMono;
    var drift = wallDelta - monoDelta;
    if (monoDelta >= 0 && monoDelta < 15000 && Math.abs(drift) > 120000) {
      var open = openSegment(state.active);
      if (open) {
        open.startMs += drift;
        state.active.startedAtMs += drift;
        saveState();
      }
    }
    lastWall = wall;
    lastMono = mono;
  }

  function openSegment(active) {
    if (!active || !active.segments.length) return null;
    var segment = active.segments[active.segments.length - 1];
    return segment.endMs === null ? segment : null;
  }

  function nextId(prefix) {
    state.sequence = (Number(state.sequence) || 0) + 1;
    return prefix + '-' + nowMs().toString(36) + '-' + state.sequence.toString(36);
  }

  function actionAllowed() {
    var stamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (stamp - lastActionAt < 320) return false;
    lastActionAt = stamp;
    return true;
  }

