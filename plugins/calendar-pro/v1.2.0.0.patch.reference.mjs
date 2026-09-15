/* Packrat Calendar Sync Pro v1.2.0.0 recovery patch.
 * Built on the exact recovered Marketplace v1.1.1.0 package.
 * - All-day handling: timed meetings first / hide / include.
 * - Optional amber/red warning flash, driven by the existing 1s repaint ticker.
 * - The abandoned Calendar Panel localhost bridge is intentionally not present.
 */
const __packratSetupView = Object.freeze({
  kind: "setup", title: "ADD CALENDAR", primary: "ADD CALENDAR", secondary: "in settings",
  urgency: "normal", allDay: false, stale: false, staleAge: "", joinUrl: null, position: ""
});
function __packratAllDayMode(settings) {
  const mode = settings?.allDayMode;
  return mode === "include" || mode === "hide" || mode === "agendaOnly" ? mode : "agendaOnly";
}
function __packratNextEvents(events, settings) {
  return __packratAllDayMode(settings) === "include" ? events : events.filter((event) => !event.allDay);
}
function __packratAgendaEvents(events, settings, nowMs) {
  const remaining = is(events, nowMs);
  const mode = __packratAllDayMode(settings);
  if (mode === "include") return remaining;
  const timed = remaining.filter((event) => !event.allDay);
  if (mode === "hide") return timed;
  return [...timed, ...remaining.filter((event) => event.allDay)];
}
function __packratFlashMode(settings) {
  const mode = settings?.flashMode;
  return mode === "redOnly" || mode === "amberRed" ? mode : "off";
}
function __packratBlinkView(view, settings, nowMs = Date.now()) {
  if (!view || view.kind !== "event") return view;
  const mode = __packratFlashMode(settings);
  const active = mode === "amberRed"
    ? view.urgency === "warn" || view.urgency === "imminent"
    : mode === "redOnly" && view.urgency === "imminent";
  if (!active || Math.floor(nowMs / 1000) % 2 === 0) return view;
  return { ...view, urgency: "normal" };
}
function __packratViewContext(settings, fetchedAt, nowMs = Date.now()) {
  return {
    nowMs,
    fetchedAt,
    tier: Es(),
    clock: settings.clock === "12h" ? "12h" : "24h",
    thresholds: Sn(settings.warnMins, settings.imminentMins)
  };
}
function __packratAgendaLimit(settings) {
  const value = Number(settings.limit ?? 5);
  return Number.isFinite(value) && value >= 1 ? Math.min(Math.floor(value), 20) : 5;
}

// Next Meeting: all-day items no longer hijack the timed countdown unless explicitly included.
er.prototype.paintPro = async function(action, settings) {
  const feeds = Zs(settings);
  if (feeds.length === 0) return void await action.setImage(Ps($s(__packratSetupView)));
  const merged = xs(feeds);
  const context = __packratViewContext(settings, merged.fetchedAt);
  const view = Fs(__packratNextEvents(merged.events, settings), context);
  await action.setImage(Ps($s(__packratBlinkView(view, settings, context.nowMs))));
};

// Join Meeting follows the exact same next-timed-event selection as Next Meeting.
Xs.prototype.viewFor = function(settings) {
  const feeds = Zs(settings);
  if (feeds.length === 0) return null;
  const merged = xs(feeds);
  return Fs(__packratNextEvents(merged.events, settings), __packratViewContext(settings, merged.fetchedAt));
};
Xs.prototype.paint = async function(action, settings) {
  const view = this.viewFor(settings) ?? __packratSetupView;
  await action.setImage(Ps($s(__packratBlinkView(view, settings))));
};

// Agenda / Stream Deck+ dial: "Timed meetings first" keeps all-day items scrollable,
// but moves them behind timed meetings so the dial opens on the useful countdown.
Js.prototype.paintOne = async function(action, settings) {
  const feeds = Zs(settings);
  let view;
  if (feeds.length === 0) {
    view = __packratSetupView;
  } else {
    const merged = xs(feeds);
    const context = __packratViewContext(settings, merged.fetchedAt);
    const events = __packratAgendaEvents(merged.events, settings, context.nowMs).slice(0, __packratAgendaLimit(settings));
    if (events.length === 0) {
      view = Hs(context, "ALL DONE", "for today");
    } else {
      const cursor = this.cursors.get(action.id) ?? 0;
      const index = (cursor % events.length + events.length) % events.length;
      view = Vs(events[index], context, events.length > 1 ? `${index + 1}/${events.length}` : "");
    }
  }
  const painted = __packratBlinkView(view, settings);
  const image = Ps($s(painted));
  if (action.isKey()) await action.setImage(image);
  else await action.setFeedback({ icon: image, title: painted.title, value: painted.primary });
};
