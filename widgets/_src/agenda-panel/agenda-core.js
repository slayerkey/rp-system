/* Calendar Panel for XENEON Edge.
 * ICS feeds only. No OAuth. URLs are read from iCUE properties and are never stored in localStorage.
 * The recurrence model mirrors the audited Calendar Sync behavior: RRULE/RDATE expansion, EXDATE
 * removal, RECURRENCE-ID overrides, cancellation handling, all-day exclusivity, and timezone-aware
 * wall-clock conversion. The original legacy parser is not present in the canonical repository yet.
 */

var SLOT_SPECS = [
  { id: "s-h", w: 840, h: 344 },
  { id: "s-v", w: 696, h: 416 },
  { id: "m-h", w: 840, h: 696 },
  { id: "m-v", w: 696, h: 840 },
  { id: "l-h", w: 1688, h: 696 },
  { id: "l-v", w: 696, h: 1688 },
  { id: "xl-h", w: 2536, h: 696 },
  { id: "xl-v", w: 696, h: 2536 }
];
var BRIDGE_URL = "http://127.0.0.1:38765/v1/ics?url=";
var CALENDAR_SYNC_PRO_MARKETPLACE_URL = "https://marketplace.elgato.com/product/calendar-sync-pro-d957868e-d1a0-4c3b-8fe4-8291951a5170";
var REFRESH_TIMER = null;
var CLOCK_TIMER = null;
var STATE = {
  mode: "today",
  events: [],
  updatedAt: 0,
  stale: false,
  sourceCount: 0,
  failedCount: 0,
  status: "unconfigured",
  message: "",
  selected: null
};

function getIcueProperty(name, fallback) {
  try {
    var value = globalThis[name];
    if (typeof Node !== "undefined" && value instanceof Node) return fallback;
    if (value === undefined || value === null) return fallback;
    return value;
  } catch (error) {
    return fallback;
  }
}

function openCalendarSyncPro() {
  try {
    if (globalThis.plugins && globalThis.plugins.Linkprovider && globalThis.pluginLinkprovider_initialized !== false) {
      globalThis.plugins.Linkprovider.open(CALENDAR_SYNC_PRO_MARKETPLACE_URL);
      return true;
    }
  } catch (error) {}
  return false;
}

function instanceKey(name) {
  var id = "packrat";
  try { if (typeof uniqueId !== "undefined" && uniqueId) id = String(uniqueId); } catch (error) {}
  return id + ":agenda-panel:" + name;
}

function cacheRead() {
  try {
    var raw = localStorage.getItem(instanceKey("cache"));
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.events)) return null;
    parsed.events = parsed.events.map(reviveEvent);
    return parsed;
  } catch (error) {
    return null;
  }
}

function cacheWrite(events, updatedAt) {
  try {
    var safe = events.map(function (event) {
      return {
        id: event.id,
        uid: event.uid,
        title: event.title,
        location: event.location,
        description: event.description,
        allDay: event.allDay,
        allDayStart: event.allDayStart || null,
        allDayEndExclusive: event.allDayEndExclusive || null,
        startMs: event.start ? event.start.getTime() : null,
        endMs: event.end ? event.end.getTime() : null,
        sourceIndex: event.sourceIndex,
        recurrenceKey: event.recurrenceKey || null
      };
    });
    localStorage.setItem(instanceKey("cache"), JSON.stringify({ events: safe, updatedAt: updatedAt }));
  } catch (error) {}
}

function reviveEvent(event) {
  return {
    id: event.id,
    uid: event.uid,
    title: event.title || "Untitled event",
    location: event.location || "",
    description: event.description || "",
    allDay: !!event.allDay,
    allDayStart: event.allDayStart || null,
    allDayEndExclusive: event.allDayEndExclusive || null,
    start: event.startMs === null || event.startMs === undefined ? null : new Date(event.startMs),
    end: event.endMs === null || event.endMs === undefined ? null : new Date(event.endMs),
    sourceIndex: Number(event.sourceIndex || 0),
    recurrenceKey: event.recurrenceKey || null
  };
}

function applyAppearance() {
  var text = String(getIcueProperty("textColor", "#F4F6F8") || "#F4F6F8");
  var accent = String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A");
  var bg = String(getIcueProperty("backgroundColor", "#07090D") || "#07090D");
  document.documentElement.style.setProperty("--text", text);
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--bg", bg);
}

async function t(key) {
  try {
    if (typeof tr === "function") {
      var value = await tr(key);
      if (value !== undefined && value !== null && String(value)) return String(value);
    }
  } catch (error) {}
  return key;
}

function setText(id, value) {
  var node = document.getElementById(id);
  if (node) node.textContent = value || "";
}

function nearestSlot() {
  var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
  var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
  var best = SLOT_SPECS[0];
  var score = Infinity;
  for (var i = 0; i < SLOT_SPECS.length; i++) {
    var item = SLOT_SPECS[i];
    var next = Math.abs(Math.log(w / item.w)) + Math.abs(Math.log(h / item.h));
    if (next < score) { score = next; best = item; }
  }
  return best.id;
}

function applySlot() {
  document.body.setAttribute("data-slot", nearestSlot());
  render();
}

function getUrls() {
  var values = [
    getIcueProperty("calendarUrl1", ""),
    getIcueProperty("calendarUrl2", ""),
    getIcueProperty("calendarUrl3", "")
  ];
  var seen = {};
  return values.map(function (value) { return String(value || "").trim(); }).filter(function (value) {
    if (!value || seen[value]) return false;
    if (!/^(https?|webcal):\/\//i.test(value)) return false;
    seen[value] = true;
    return true;
  });
}

function withTimeout(url, options, timeoutMs) {
  return new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; resolve(null); }
    }, timeoutMs || 8000);
    try {
      fetch(url, options || {}).then(function (response) {
        if (!response || !response.ok) return null;
        return response.text();
      }).then(function (text) {
        if (!done) { done = true; clearTimeout(timer); resolve(text || null); }
      }).catch(function () {
        if (!done) { done = true; clearTimeout(timer); resolve(null); }
      });
    } catch (error) {
      if (!done) { done = true; clearTimeout(timer); resolve(null); }
    }
  });
}

async function loadCalendarText(url, sourceIndex) {
  try {
    if (globalThis.__ratpackAgendaFixtures && globalThis.__ratpackAgendaFixtures[sourceIndex]) {
      return { text: String(globalThis.__ratpackAgendaFixtures[sourceIndex]), via: "fixture" };
    }
  } catch (error) {}

  var fetchUrl = url.replace(/^webcal:/i, "https:");
  var direct = await withTimeout(fetchUrl, { cache: "no-store" }, 8000);
  if (direct && /BEGIN:VCALENDAR/i.test(direct)) return { text: direct, via: "direct" };

  var bridged = await withTimeout(BRIDGE_URL + encodeURIComponent(fetchUrl), { cache: "no-store" }, 8000);
  if (bridged && /BEGIN:VCALENDAR/i.test(bridged)) return { text: bridged, via: "bridge" };
  return null;
}

function unfoldIcs(raw) {
  var input = String(raw || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  var lines = [];
  for (var i = 0; i < input.length; i++) {
    var line = input[i];
    if ((line.charAt(0) === " " || line.charAt(0) === "\t") && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function splitContentLine(line) {
  var quoted = false;
  var colon = -1;
  for (var i = 0; i < line.length; i++) {
    var ch = line.charAt(i);
    if (ch === '"') quoted = !quoted;
    if (ch === ":" && !quoted) { colon = i; break; }
  }
  if (colon < 0) return null;
  var left = line.slice(0, colon);
  var value = line.slice(colon + 1);
  var chunks = left.split(";");
  var name = String(chunks.shift() || "").toUpperCase();
  var params = {};
  chunks.forEach(function (chunk) {
    var eq = chunk.indexOf("=");
    if (eq < 0) return;
    var key = chunk.slice(0, eq).toUpperCase();
    var val = chunk.slice(eq + 1).replace(/^"|"$/g, "");
    params[key] = val;
  });
  return { name: name, params: params, value: value };
}

function unescapeText(value) {
  return String(value || "")
    .replace(/\\[nN]/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseComponents(raw) {
  var lines = unfoldIcs(raw);
  var stack = [];
  var root = { name: "ROOT", properties: [], children: [] };
  stack.push(root);
  for (var i = 0; i < lines.length; i++) {
    var parsed = splitContentLine(lines[i]);
    if (!parsed) continue;
    if (parsed.name === "BEGIN") {
      var comp = { name: parsed.value.toUpperCase(), properties: [], children: [] };
      stack[stack.length - 1].children.push(comp);
      stack.push(comp);
    } else if (parsed.name === "END") {
      if (stack.length > 1) stack.pop();
    } else {
      stack[stack.length - 1].properties.push(parsed);
    }
  }
  return root;
}

function props(component, name) {
  var target = String(name || "").toUpperCase();
  return component.properties.filter(function (item) { return item.name === target; });
}

function prop(component, name) {
  var items = props(component, name);
  return items.length ? items[0] : null;
}

function propText(component, name, fallback) {
  var item = prop(component, name);
  return item ? unescapeText(item.value) : (fallback || "");
}

function pad2(value) { return String(value).padStart(2, "0"); }
function dateKey(parts) { return parts.y + pad2(parts.m) + pad2(parts.d); }
function cloneParts(parts) { return { y: parts.y, m: parts.m, d: parts.d, h: parts.h || 0, min: parts.min || 0, s: parts.s || 0 }; }

function parseRawParts(raw) {
  var text = String(raw || "").trim();
  var match = text.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/i);
  if (!match) return null;
  return {
    y: Number(match[1]), m: Number(match[2]), d: Number(match[3]),
    h: Number(match[4] || 0), min: Number(match[5] || 0), s: Number(match[6] || 0),
    utc: !!match[7], hasTime: !!match[4]
  };
}

function validIanaZone(zone) {
  if (!zone) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date()); return true; }
  catch (error) { return false; }
}

function formatZoneParts(date, zone) {
  var format = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  var out = {};
  format.formatToParts(date).forEach(function (part) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  });
  return { y: out.year, m: out.month, d: out.day, h: out.hour, min: out.minute, s: out.second };
}

function zonedPartsToDate(parts, zone) {
  if (!validIanaZone(zone)) return null;
  var guess = Date.UTC(parts.y, parts.m - 1, parts.d, parts.h || 0, parts.min || 0, parts.s || 0);
  for (var i = 0; i < 3; i++) {
    var observed = formatZoneParts(new Date(guess), zone);
    var observedUtc = Date.UTC(observed.y, observed.m - 1, observed.d, observed.h, observed.min, observed.s);
    var desiredUtc = Date.UTC(parts.y, parts.m - 1, parts.d, parts.h || 0, parts.min || 0, parts.s || 0);
    var delta = desiredUtc - observedUtc;
    if (Math.abs(delta) < 500) break;
    guess += delta;
  }
  return new Date(guess);
}

function parseUtcOffset(value) {
  var match = String(value || "").trim().match(/^([+-])(\d{2})(\d{2})(?::?(\d{2}))?$/);
  if (!match) return null;
  var seconds = Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] || 0);
  return (match[1] === "-" ? -1 : 1) * seconds * 1000;
}

function buildVtimezone(component, id) {
  var rules = [];
  component.children.forEach(function (child) {
    if (child.name !== "STANDARD" && child.name !== "DAYLIGHT") return;
    var start = prop(child, "DTSTART");
    var startParts = start ? parseRawParts(start.value) : null;
    var offsetTo = parseUtcOffset(propText(child, "TZOFFSETTO", ""));
    var offsetFrom = parseUtcOffset(propText(child, "TZOFFSETFROM", ""));
    if (!startParts || offsetTo === null) return;
    rules.push({
      kind: child.name,
      startParts: startParts,
      offsetTo: offsetTo,
      offsetFrom: offsetFrom,
      rrule: propText(child, "RRULE", ""),
      rdates: props(child, "RDATE").map(function (item) { return item.value; })
    });
  });
  return rules.length ? { type: "vtimezone", id: id, rules: rules } : null;
}

function collectTimezoneAliases(root) {
  var aliases = {};
  function walk(component) {
    if (component.name === "VTIMEZONE") {
      var id = propText(component, "TZID", "");
      var location = propText(component, "X-LIC-LOCATION", "");
      if (id && location && validIanaZone(location)) aliases[id] = location;
      else if (id && validIanaZone(id)) aliases[id] = id;
      else if (id) {
        var embedded = buildVtimezone(component, id);
        if (embedded) aliases[id] = embedded;
      }
    }
    component.children.forEach(walk);
  }
  walk(root);
  return aliases;
}

function wallPartsNumber(parts) {
  return Date.UTC(parts.y, parts.m - 1, parts.d, parts.h || 0, parts.min || 0, parts.s || 0);
}

function transitionDatesForRule(rule, year) {
  var out = [];
  function push(parts) {
    if (!parts) return;
    out.push({ parts: parts, offsetTo: rule.offsetTo, offsetFrom: rule.offsetFrom });
  }
  if (rule.rrule && typeof parseRrule === "function" && typeof recurrenceDateMatches === "function") {
    var parsed = parseRrule(rule.rrule);
    for (var y = year - 2; y <= year + 1; y++) {
      var cursor = { y: y, m: 1, d: 1, h: rule.startParts.h || 0, min: rule.startParts.min || 0, s: rule.startParts.s || 0 };
      var end = { y: y + 1, m: 1, d: 1 };
      while (comparePlain(cursor, end) < 0) {
        if (recurrenceDateMatches(rule.startParts, cursor, parsed)) push(cloneParts(cursor));
        cursor = addPlainDays(cursor, 1);
      }
    }
  } else if (rule.startParts.y >= year - 2 && rule.startParts.y <= year + 1) {
    push(cloneParts(rule.startParts));
  }
  rule.rdates.forEach(function (rawList) {
    String(rawList || "").split(",").forEach(function (raw) {
      var p = parseRawParts(raw);
      if (p && p.y >= year - 2 && p.y <= year + 1) push(p);
    });
  });
  return out;
}

function vtimezonePartsToDate(parts, zone) {
  if (!zone || !zone.rules || !zone.rules.length) return null;
  var candidates = [];
  zone.rules.forEach(function (rule) { candidates = candidates.concat(transitionDatesForRule(rule, parts.y)); });
  candidates.sort(function (a, b) { return wallPartsNumber(a.parts) - wallPartsNumber(b.parts); });
  var target = wallPartsNumber(parts);
  var chosen = null;
  for (var i = 0; i < candidates.length; i++) {
    if (wallPartsNumber(candidates[i].parts) <= target) chosen = candidates[i];
    else break;
  }
  var offset = chosen ? chosen.offsetTo : null;
  if (offset === null || offset === undefined) {
    for (var j = 0; j < zone.rules.length; j++) {
      if (zone.rules[j].offsetFrom !== null && zone.rules[j].offsetFrom !== undefined) { offset = zone.rules[j].offsetFrom; break; }
    }
  }
  if (offset === null || offset === undefined) return null;
  return new Date(target - offset);
}

function parseDateValue(item, aliases) {
  if (!item) return null;
  var parts = parseRawParts(item.value);
  if (!parts) return null;
  var allDay = String(item.params.VALUE || "").toUpperCase() === "DATE" || !parts.hasTime;
  if (allDay) {
    return { allDay: true, dateParts: { y: parts.y, m: parts.m, d: parts.d }, raw: item.value };
  }
  if (parts.utc) {
    return { allDay: false, date: new Date(Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.min, parts.s)), parts: parts, zone: "UTC", raw: item.value };
  }
  var tzid = item.params.TZID || "";
  if (tzid) {
    var zone = aliases[tzid] || tzid;
    if (zone && typeof zone === "object" && zone.type === "vtimezone") {
      var embeddedDate = vtimezonePartsToDate(parts, zone);
      if (embeddedDate) return { allDay: false, date: embeddedDate, parts: parts, zone: zone, raw: item.value };
    } else {
      var zoned = zonedPartsToDate(parts, zone);
      if (zoned) return { allDay: false, date: zoned, parts: parts, zone: zone, raw: item.value };
    }
  }
  return { allDay: false, date: new Date(parts.y, parts.m - 1, parts.d, parts.h, parts.min, parts.s), parts: parts, zone: "floating", raw: item.value };
}
