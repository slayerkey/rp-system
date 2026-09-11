async function refreshCalendars(force) {
  applyAppearance();
  var urls = getUrls();
  if (!urls.length) {
    STATE.status = "unconfigured";
    STATE.message = "Paste an ICS feed URL in widget settings.";
    STATE.sourceCount = 0;
    STATE.failedCount = 0;
    render();
    scheduleRefresh();
    return;
  }

  if (!force && STATE.status === "loading") return;
  STATE.status = "loading";
  renderStatus();
  if (typeof calendarParserReady === "function") await calendarParserReady();

  var results = await Promise.all(urls.map(function (url, sourceIndex) {
    return loadCalendarText(url, sourceIndex).then(function (loaded) {
      if (!loaded) return { ok: false, transport: true, events: [] };
      try {
        return { ok: true, transport: false, events: parseCalendar(loaded.text, sourceIndex) };
      } catch (error) {
        return { ok: false, transport: false, events: [] };
      }
    });
  }));

  var merged = [];
  var failed = 0;
  var transportFailures = 0;
  results.forEach(function (result) {
    if (!result.ok) {
      failed++;
      if (result.transport) transportFailures++;
    } else merged = merged.concat(result.events);
  });

  if (merged.length || failed < urls.length) {
    merged.sort(compareEvents);
    STATE.events = merged;
    STATE.updatedAt = Date.now();
    STATE.stale = failed > 0;
    STATE.sourceCount = urls.length;
    STATE.failedCount = failed;
    STATE.status = failed ? "stale" : "fresh";
    STATE.message = failed ? "Some calendars could not refresh." : "";
    cacheWrite(STATE.events, STATE.updatedAt);
  } else {
    var cached = cacheRead();
    if (cached && cached.events.length) {
      STATE.events = cached.events;
      STATE.updatedAt = cached.updatedAt || 0;
      STATE.stale = true;
      STATE.sourceCount = urls.length;
      STATE.failedCount = failed;
      STATE.status = "stale";
      STATE.message = "Showing the last successful agenda.";
    } else {
      STATE.events = [];
      STATE.updatedAt = 0;
      STATE.stale = true;
      STATE.sourceCount = urls.length;
      STATE.failedCount = failed;
      STATE.status = "error";
      STATE.message = transportFailures === urls.length
        ? "Calendar feed unavailable. Check the URL or your connection."
        : "Calendar feed unavailable.";
    }
  }
  render();
  scheduleRefresh();
}

function scheduleRefresh() {
  if (REFRESH_TIMER) clearTimeout(REFRESH_TIMER);
  var minutes = Math.max(1, Math.min(60, Number(getIcueProperty("refreshMinutes", 15)) || 15));
  REFRESH_TIMER = setTimeout(function () { refreshCalendars(false); }, minutes * 60000);
}

function dayStart(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function nextDayStart(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1); }
function displayDayKey(date) { return date.getFullYear() + pad2(date.getMonth() + 1) + pad2(date.getDate()); }
function allDayActiveOn(event, date) {
  var key = displayDayKey(date);
  return event.allDay && event.allDayStart <= key && event.allDayEndExclusive > key;
}
function timedIntersectsDay(event, date) {
  var start = dayStart(date).getTime();
  var end = nextDayStart(date).getTime();
  return !event.allDay && event.end.getTime() > start && event.start.getTime() < end;
}

function formatTime(date) {
  var use24 = getIcueProperty("use24Hour", false) === true;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12: !use24 }).format(date);
}
function formatDayLong(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(date);
}
function formatDayShort(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
}
function formatRange(event) {
  if (event.allDay) return "All day";
  return formatTime(event.start) + " to " + formatTime(event.end);
}
function formatDuration(event) {
  if (event.allDay) return "All day";
  var minutes = Math.max(1, Math.round((event.end.getTime() - event.start.getTime()) / 60000));
  if (minutes < 60) return minutes + " min";
  var hours = Math.floor(minutes / 60);
  var rest = minutes % 60;
  return hours + "h" + (rest ? " " + rest + "m" : "");
}

function nextRelevantEvent(now) {
  var today = dayStart(now);
  var future = STATE.events.filter(function (event) {
    if (event.allDay) return allDayActiveOn(event, today) || event.allDayStart > displayDayKey(today);
    return event.end.getTime() > now.getTime();
  });
  future.sort(compareEventsForHero);
  return future.length ? future[0] : null;
}

function compareEventsForHero(a, b) {
  var now = new Date();
  var today = dayStart(now);
  var aTodayAll = a.allDay && allDayActiveOn(a, today);
  var bTodayAll = b.allDay && allDayActiveOn(b, today);
  if (aTodayAll !== bTodayAll) return aTodayAll ? 1 : -1;
  var av = a.allDay ? new Date(Number(a.allDayStart.slice(0,4)), Number(a.allDayStart.slice(4,6)) - 1, Number(a.allDayStart.slice(6,8))).getTime() : a.start.getTime();
  var bv = b.allDay ? new Date(Number(b.allDayStart.slice(0,4)), Number(b.allDayStart.slice(4,6)) - 1, Number(b.allDayStart.slice(6,8))).getTime() : b.start.getTime();
  return av - bv;
}

function countdownText(event, now) {
  if (!event) return "";
  if (event.allDay) {
    if (allDayActiveOn(event, dayStart(now))) return "TODAY • ALL DAY";
    var startParts = dateKeyToParts(event.allDayStart);
    var day = new Date(startParts.y, startParts.m - 1, startParts.d);
    var days = Math.max(1, Math.ceil((day.getTime() - dayStart(now).getTime()) / 86400000));
    return days === 1 ? "TOMORROW • ALL DAY" : "IN " + days + " DAYS • ALL DAY";
  }
  if (event.start.getTime() <= now.getTime() && event.end.getTime() > now.getTime()) return "HAPPENING NOW";
  var ms = event.start.getTime() - now.getTime();
  var min = Math.max(0, Math.ceil(ms / 60000));
  if (min < 60) return "IN " + min + " MIN";
  var hours = Math.floor(min / 60);
  var rest = min % 60;
  if (hours < 24) return "IN " + hours + "H" + (rest ? " " + rest + "M" : "");
  var days = Math.floor(hours / 24);
  return "IN " + days + "D " + (hours % 24) + "H";
}

function setStatus(state, message) {
  document.body.setAttribute("data-state", state);
  var label = document.getElementById("freshnessLabel");
  if (!label) return;
  var text = "";
  var tone = "";
  if (state === "fresh") { text = STATE.updatedAt ? "UPDATED " + ago(Date.now() - STATE.updatedAt) : "LIVE"; tone = "fresh"; }
  else if (state === "stale") { text = STATE.updatedAt ? "STALE • " + ago(Date.now() - STATE.updatedAt) : "STALE"; tone = "stale"; }
  else if (state === "loading") { text = "REFRESHING"; tone = ""; }
  else if (state === "error") { text = "FEED ERROR"; tone = "error"; }
  else { text = "NOT CONFIGURED"; tone = ""; }
  label.textContent = text;
  label.setAttribute("data-tone", tone);
  label.title = message || "";
}

function ago(ms) {
  if (ms < 60000) return "NOW";
  var minutes = Math.floor(ms / 60000);
  if (minutes < 60) return minutes + "M AGO";
  return Math.floor(minutes / 60) + "H AGO";
}

function renderStatus() { setStatus(STATE.status, STATE.message); }
