  function applyAppearance() {
    document.documentElement.style.setProperty('--text', String(getIcueProperty('textColor', '#F4F6F8')));
    document.documentElement.style.setProperty('--accent', String(getIcueProperty('accentColor', '#2BE86A')));
    document.documentElement.style.setProperty('--bg', String(getIcueProperty('backgroundColor', '#07090D')));
  }

  function render() {
    if (!document.body) return;
    watchClock();
    var slot = nearestSlot();
    document.body.dataset.slot = slot;
    document.body.dataset.edition = EDITION;
    document.body.dataset.sessionState = state.active ? state.active.status : 'idle';
    document.body.dataset.kind = state.active ? state.active.kind : 'focus';
    applyAppearance();
    renderCurrent(); renderToday(); renderTimeline(); if (IS_PRO) renderPro();
  }

  function renderCurrent() {
    var active = state.active;
    var input = byId('projectInput');
    var idle = byId('idleControls');
    var running = byId('activeControls');
    var label = byId('currentLabel');
    var name = byId('currentName');
    var timer = byId('elapsed');
    var pause = byId('pauseResume');
    if (!idle || !running) return;
    idle.hidden = !!active; running.hidden = !active;
    if (!active) {
      label.textContent = 'READY TO FOCUS';
      name.textContent = 'What are you working on?';
      timer.textContent = '00:00:00';
      if (input && document.activeElement !== input && !input.value) input.value = state.lastProjectName || '';
      return;
    }
    label.textContent = active.kind === 'break' ? 'CURRENT BREAK' : 'CURRENT PROJECT';
    name.textContent = active.name;
    name.style.setProperty('--project-color', active.color);
    timer.textContent = formatDuration(durationSegments(active.segments, nowMs()), false);
    pause.textContent = active.status === 'paused' ? 'RESUME' : 'PAUSE';
    pause.classList.toggle('is-resume', active.status === 'paused');
  }

  function renderToday() {
    var total = focusForDay(nowMs());
    var totalNode = byId('todayTotal'); if (totalNode) totalNode.textContent = formatDuration(total, true);
    var goalNode = byId('goalProgress');
    if (goalNode && IS_PRO) {
      var goal = clampNumber(getIcueProperty('dailyGoalMinutes', 240), 30, 720, 240) * 60000;
      var pct = Math.min(100, Math.round(total / goal * 100));
      goalNode.textContent = pct + '% OF ' + formatDuration(goal, true);
      document.documentElement.style.setProperty('--goal-progress', pct + '%');
    }
    var status = byId('todayStatus'); if (status) status.textContent = state.active ? (state.active.status === 'paused' ? 'PAUSED' : 'IN PROGRESS') : 'TODAY';
  }

  function renderTimeline() {
    var host = byId('timeline');
    var list = byId('sessionList');
    if (!host || !list) return;
    var now = nowMs(), bounds = dayBounds(now), sessions = sessionsForDay(now, true);
    var visible = sessions.filter(function (s) { return s.kind === 'focus'; });
    var earliest = visible.length ? Math.min.apply(null, visible.map(function (s) { return s.startedAtMs; })) : now;
    var start = Math.max(bounds.start, Math.min(earliest - 20 * 60000, new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate(), 8, 0, 0, 0).getTime()));
    var end = Math.min(bounds.end, Math.max(now + 20 * 60000, start + 2 * 3600000));
    if (end <= start) end = start + 1;
    var html = '<div class="track-line"></div>';
    visible.forEach(function (session) {
      session.segments.forEach(function (segment) {
        var segEnd = segment.endMs === null ? now : segment.endMs;
        var a = Math.max(start, segment.startMs), b = Math.min(end, segEnd);
        if (b <= a) return;
        var left = (a - start) / (end - start) * 100;
        var width = Math.max(0.6, (b - a) / (end - start) * 100);
        html += '<div class="timeline-block' + (session.active ? ' is-active' : '') + '" style="left:' + left.toFixed(3) + '%;width:' + width.toFixed(3) + '%;--block:' + safeColor(session.color) + '" title="' + escapeHtml(session.name) + '"><span>' + escapeHtml(session.name) + '</span></div>';
      });
    });
    html += '<div class="axis start">' + escapeHtml(formatTime(start)) + '</div><div class="axis end">' + (state.active ? 'NOW' : escapeHtml(formatTime(now))) + '</div>';
    host.innerHTML = html;

    var rows = sessions.slice().reverse().filter(function (s) { return s.kind === 'focus'; }).slice(0, 4);
    if (!rows.length) {
      list.innerHTML = '<div class="empty-row">No completed focus yet. Start one when you are ready.</div>';
    } else {
      list.innerHTML = rows.map(function (session) {
        var endText = session.active ? (session.status === 'paused' ? 'PAUSED' : 'NOW') : formatTime(session.endedAtMs);
        return '<div class="session-row"><span class="row-dot" style="background:' + safeColor(session.color) + '"></span><span class="row-time">' + escapeHtml(formatTime(session.startedAtMs)) + '–' + escapeHtml(endText) + '</span><strong>' + escapeHtml(session.name) + '</strong><span class="row-duration">' + escapeHtml(formatDuration(sessionDuration(session), true)) + '</span></div>';
      }).join('');
    }
  }

  function renderPro() {
    var projects = byId('savedProjects');
    if (projects) {
      projects.innerHTML = state.projects.length ? state.projects.slice(0, 10).map(function (project) {
        return '<button class="project-chip" data-project="' + escapeHtml(project.id) + '" style="--chip:' + safeColor(project.color) + '"><span></span>' + escapeHtml(project.name) + '</button>';
      }).join('') : '<div class="empty-row">Save a project once, then start it with one tap.</div>';
    }
    renderWeek(); renderProjectTotals(); renderHistory();
    var sections = document.querySelectorAll('[data-pro-view]');
    sections.forEach(function (section) { section.hidden = section.getAttribute('data-pro-view') !== currentView; });
    document.querySelectorAll('.view-tab').forEach(function (tab) { tab.classList.toggle('active', tab.dataset.view === currentView); });
  }

  function renderWeek() {
    var host = byId('weekBars'); if (!host) return;
    var now = nowMs();
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
      days.push({ ms: d.getTime(), total: focusForDay(d.getTime()) });
    }
    var max = Math.max.apply(null, days.map(function (d) { return d.total; }).concat([1]));
    host.innerHTML = days.map(function (day) {
      var pct = Math.max(3, Math.round(day.total / max * 100));
      return '<div class="day-bar"><span class="bar-value">' + escapeHtml(formatDuration(day.total, true)) + '</span><div class="bar-track"><i style="height:' + pct + '%"></i></div><strong>' + escapeHtml(formatDay(day.ms)) + '</strong></div>';
    }).join('');
    var weekTotal = days.reduce(function (sum, d) { return sum + d.total; }, 0);
    var node = byId('weekTotal'); if (node) node.textContent = formatDuration(weekTotal, true);
  }

  function renderProjectTotals() {
    var host = byId('projectTotals'); if (!host) return;
    var map = {};
    state.sessions.filter(function (s) { return s.kind === 'focus'; }).forEach(function (session) {
      var key = session.projectId || 'name:' + session.name.toLowerCase();
      if (!map[key]) map[key] = { name: session.name, color: session.color, total: 0, count: 0 };
      map[key].total += sessionDuration(session); map[key].count += 1;
    });
    if (state.active && state.active.kind === 'focus') {
      var akey = state.active.projectId || 'name:' + state.active.name.toLowerCase();
      if (!map[akey]) map[akey] = { name: state.active.name, color: state.active.color, total: 0, count: 0 };
      map[akey].total += durationSegments(state.active.segments, nowMs());
    }
    var rows = Object.keys(map).map(function (key) { return map[key]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 8);
    host.innerHTML = rows.length ? rows.map(function (row) {
      return '<div class="project-total"><span class="row-dot" style="background:' + safeColor(row.color) + '"></span><strong>' + escapeHtml(row.name) + '</strong><span>' + escapeHtml(formatDuration(row.total, true)) + '</span></div>';
    }).join('') : '<div class="empty-row">Project totals appear after your first focus session.</div>';
  }

  function renderHistory() {
    var host = byId('historyRows'); if (!host) return;
    var rows = state.sessions.slice().reverse().filter(function (s) { return s.kind === 'focus'; }).slice(0, 8);
    host.innerHTML = rows.length ? rows.map(function (session, index) {
      return '<div class="history-row"><span>' + escapeHtml(formatShortDate(session.endedAtMs)) + '</span><strong>' + escapeHtml(session.name) + '</strong><em>' + escapeHtml(formatDuration(sessionDuration(session), true)) + (session.manualAdjustmentMs ? ' • adjusted' : '') + '</em>' + (index === 0 ? '<div class="adjust"><button data-adjust="-5">−5</button><button data-adjust="5">+5</button></div>' : '') + '</div>';
    }).join('') : '<div class="empty-row">Completed sessions will be kept here for 120 days.</div>';
  }

  function openPro() {
    try {
      if (globalThis.plugins && globalThis.plugins.Linkprovider && globalThis.pluginLinkprovider_initialized !== false) {
        globalThis.plugins.Linkprovider.open(PRO_UPGRADE_URL);
        return true;
      }
    } catch (error) {}
    return false;
  }

  function bind() {
    var start = byId('startButton'); if (start) start.addEventListener('click', function () { startSession(byId('projectInput').value, 'focus', null); });
    var input = byId('projectInput'); if (input) input.addEventListener('keydown', function (event) { if (event.key === 'Enter') startSession(input.value, 'focus', null); });
    var pause = byId('pauseResume'); if (pause) pause.addEventListener('click', function () { state.active && state.active.status === 'paused' ? resumeSession() : pauseSession(); });
    var finish = byId('finishButton'); if (finish) finish.addEventListener('click', finishSession);
    var upgrade = byId('upgradeButton'); if (upgrade) upgrade.addEventListener('click', openPro);
    var save = byId('saveProject'); if (save) save.addEventListener('click', function () { saveProject(byId('projectInput').value); });
    var color = byId('colorButton'); if (color) color.addEventListener('click', cycleColor);
    var breakButton = byId('breakButton'); if (breakButton) breakButton.addEventListener('click', function () { startSession('Break', 'break', null); });
    var deleteButton = byId('deleteLast'); if (deleteButton) deleteButton.addEventListener('click', deleteLast);
    document.addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('[data-project]') : null;
      if (chip) {
        var project = state.projects.find(function (p) { return p.id === chip.dataset.project; });
        if (project) startSession(project.name, 'focus', project);
      }
      var tab = event.target.closest ? event.target.closest('[data-view]') : null;
      if (tab) { currentView = tab.dataset.view; render(); }
      var adjust = event.target.closest ? event.target.closest('[data-adjust]') : null;
      if (adjust) adjustLast(Number(adjust.dataset.adjust));
    });
    window.addEventListener('resize', render);
    // Other screens can update the same edition's shared state. Never write
    // back from a storage event or two widgets can produce a feedback loop.
    function refreshIfNewer() {
      try {
        var stored = JSON.parse(localStorage.getItem(SHARED_STATE_KEY) || 'null');
        if (stored && Number(stored.updatedAtMs || 0) > Number(state.updatedAtMs || 0)) {
          state = loadState();
          render();
        }
      } catch (error) { console.warn('Work Session Tracker shared-state refresh failed', error); }
    }
    window.addEventListener('storage', function (event) {
      if (event.key === SHARED_STATE_KEY) refreshIfNewer();
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { refreshIfNewer(); render(); }
    });
  }

  function init() {
    bind(); render();
    clearInterval(RENDER_TIMER);
    RENDER_TIMER = setInterval(render, 1000);
    globalThis.__workSessionReady = true;
  }

  globalThis.__workSessionTest = {
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    // Test the exact storage lookup a second iCUE widget instance performs.
    loadForInstance: function (id) {
      var previousId = globalThis.uniqueId;
      try { globalThis.uniqueId = id; return JSON.parse(JSON.stringify(loadState())); }
      finally { globalThis.uniqueId = previousId; }
    },
    setNow: function (value) { testNow = value === null ? null : Number(value); render(); },
    reset: function (value) { state = value ? seedFixture(value) : defaultState(); saveState(); render(); },
    start: function (name, kind) { lastActionAt = -Infinity; return startSession(name, kind || 'focus', null); },
    pause: function () { lastActionAt = -Infinity; return pauseSession(); },
    resume: function () { lastActionAt = -Infinity; return resumeSession(); },
    finish: function () { lastActionAt = -Infinity; return finishSession(); },
    adjustLast: function (minutes) { lastActionAt = -Infinity; return adjustLast(minutes); },
    focusForDay: focusForDay,
    durationSegments: durationSegments,
    dayBounds: dayBounds,
    prune: function () { pruneHistory(); saveState(); render(); },
    render: render,
    openPro: openPro
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
