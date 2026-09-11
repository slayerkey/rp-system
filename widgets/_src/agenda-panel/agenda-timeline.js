function renderHero(now) {
  var event = nextRelevantEvent(now);
  var title = document.getElementById("heroTitle");
  var time = document.getElementById("heroTime");
  var countdown = document.getElementById("heroCountdown");
  var location = document.getElementById("heroLocation");
  var heroCard = document.getElementById("heroCard");
  var bridgeNeeded = STATE.status === "bridge" && !STATE.events.length;
  countdown.setAttribute("data-tone", "");

  if (STATE.status === "unconfigured") {
    title.textContent = "Add your calendar";
    time.textContent = "Paste an ICS feed URL in settings";
    countdown.textContent = "";
    location.textContent = "";
  } else if (bridgeNeeded) {
    title.textContent = "Calendar companion unavailable";
    time.textContent = "Calendar Sync Pro bridge is required for feeds blocked by browser CORS";
    countdown.textContent = "GET CALENDAR SYNC PRO →";
    location.textContent = "";
  } else if (STATE.status === "error" && !STATE.events.length) {
    title.textContent = "Calendar feed unavailable";
    time.textContent = "Check the ICS URL and try refresh";
    countdown.textContent = "";
    location.textContent = "";
  } else if (!event) {
    title.textContent = "Your day is clear";
    time.textContent = STATE.stale ? "Showing the last successful agenda" : "No upcoming events";
    countdown.textContent = "";
    location.textContent = "";
  } else {
    title.textContent = event.title;
    time.textContent = event.allDay ? formatDayShort(allDayStartDate(event)) + " • ALL DAY" : formatTime(event.start) + " • " + formatDuration(event);
    var count = countdownText(event, now);
    countdown.textContent = count;
    var minutes = event.allDay ? Infinity : (event.start.getTime() - now.getTime()) / 60000;
    countdown.setAttribute("data-tone", minutes <= 10 ? "urgent" : (minutes <= 30 ? "soon" : ""));
    location.textContent = event.location || "";
  }

  if (bridgeNeeded) {
    setText("heroToggle", "TAP TO OPEN MARKETPLACE");
    heroCard.setAttribute("aria-label", "Open Calendar Sync Pro on Marketplace");
    heroCard.onclick = function () { openCalendarSyncPro(); };
  } else {
    setText("heroToggle", STATE.mode === "today" ? "TAP FOR NEXT 3 DAYS" : "TAP FOR TODAY");
    heroCard.setAttribute("aria-label", "Switch calendar range");
    heroCard.onclick = function () {
      STATE.mode = STATE.mode === "today" ? "four" : "today";
      document.body.setAttribute("data-mode", STATE.mode);
      render();
    };
  }
}

function allDayStartDate(event) {
  var p = dateKeyToParts(event.allDayStart);
  return new Date(p.y, p.m - 1, p.d);
}

function visibleDays(now) {
  var start = dayStart(now);
  var count = STATE.mode === "today" ? 1 : 4;
  var days = [];
  for (var i = 0; i < count; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  return days;
}

function timelinePercent(date, day) {
  var start = dayStart(day).getTime();
  var end = nextDayStart(day).getTime();
  return Math.max(0, Math.min(100, ((date.getTime() - start) / (end - start)) * 100));
}

function dayDurationMs(day) {
  return nextDayStart(day).getTime() - dayStart(day).getTime();
}

function localHourDate(day, hour) {
  if (hour === 24) return nextDayStart(day);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
}

function localHourPercent(day, hour) {
  return timelinePercent(localHourDate(day, hour), day);
}

function hourLabelText(hour, use24) {
  var h = hour === 24 ? 0 : hour;
  return use24 ? pad2(h) + ":00" : (h === 0 ? "12A" : h < 12 ? h + "A" : h === 12 ? "12P" : (h - 12) + "P");
}

function daysShareDuration(days) {
  if (!days.length) return true;
  var duration = dayDurationMs(days[0]);
  return days.every(function (day) { return dayDurationMs(day) === duration; });
}

function addRowAxis(row, day) {
  var use24 = getIcueProperty("use24Hour", false) === true;
  [6, 12, 18].forEach(function (hour) {
    var pct = localHourPercent(day, hour);
    var line = document.createElement("span");
    line.className = "rowAxisLine";
    line.style.left = pct + "%";
    row.appendChild(line);
    var label = document.createElement("span");
    label.className = "rowAxisLabel";
    label.style.left = pct + "%";
    label.textContent = hourLabelText(hour, use24);
    row.appendChild(label);
  });
}

function buildAxis(days) {
  var labels = document.getElementById("axisLabels");
  var lines = document.getElementById("gridLines");
  labels.innerHTML = "";
  lines.innerHTML = "";
  var use24 = getIcueProperty("use24Hour", false) === true;
  var shared = daysShareDuration(days);
  document.body.setAttribute("data-mixed-day-lengths", shared ? "false" : "true");
  if (!shared && days.length > 1) {
    var notice = document.createElement("span");
    notice.className = "axisLabel axisNotice";
    notice.style.left = "50%";
    notice.textContent = "LOCAL TIME";
    labels.appendChild(notice);
    return false;
  }
  var reference = days.length ? days[0] : new Date();
  for (var hour = 0; hour <= 24; hour += 3) {
    var pct = localHourPercent(reference, hour);
    var label = document.createElement("span");
    label.className = "axisLabel";
    label.style.left = pct + "%";
    label.textContent = hourLabelText(hour, use24);
    labels.appendChild(label);
    var line = document.createElement("span");
    line.className = "gridLine";
    line.style.left = pct + "%";
    lines.appendChild(line);
  }
  return true;
}

function layoutLanes(segments) {
  segments.sort(function (a, b) { return a.left - b.left || a.right - b.right; });
  var laneEnds = [];
  segments.forEach(function (segment) {
    var lane = 0;
    while (lane < laneEnds.length && segment.left < laneEnds[lane] - 0.05) lane++;
    if (lane === laneEnds.length) laneEnds.push(segment.right);
    else laneEnds[lane] = segment.right;
    segment.lane = lane;
  });
  return laneEnds.length;
}

function createEventButton(event, segment, topPct, rowHeightPct, laneCount, now) {
  var button = document.createElement("button");
  button.type = "button";
  button.className = "eventBlock interactive" + ((!event.allDay && event.end.getTime() <= now.getTime()) ? " past" : "");
  button.style.left = segment.left + "%";
  button.style.width = Math.max(2.4, segment.right - segment.left) + "%";
  var laneHeight = Math.max(44, (document.getElementById("timelineViewport").clientHeight * rowHeightPct / 100 - 18) / Math.max(1, laneCount));
  button.style.top = "calc(" + topPct + "% + " + (8 + segment.lane * laneHeight) + "px)";
  button.style.height = Math.max(44, laneHeight - 5) + "px";
  var title = document.createElement("span");
  title.className = "eventTitle";
  title.textContent = event.title;
  var meta = document.createElement("span");
  meta.className = "eventMeta";
  meta.textContent = formatRange(event) + (event.location ? " • " + event.location : "");
  button.appendChild(title);
  button.appendChild(meta);
  button.onclick = function () { openDetail(event); };
  return button;
}

function renderTimeline(now, days) {
  var allDay = [];
  days.forEach(function (day) {
    STATE.events.filter(function (event) { return allDayActiveOn(event, day); }).forEach(function (event) {
      if (!allDay.some(function (item) { return item.id === event.id; })) allDay.push(event);
    });
  });
  renderAllDay(allDay);
  var sharedAxis = buildAxis(days);
  var rows = document.getElementById("eventRows");
  rows.innerHTML = "";
  var rowHeight = 100 / days.length;
  var totalVisible = 0;
  days.forEach(function (day, index) {
    var row = document.createElement("div");
    row.className = "dayRow";
    row.style.top = (index * rowHeight) + "%";
    row.style.height = rowHeight + "%";
    var rowLabel = document.createElement("span");
    rowLabel.className = "dayRowLabel";
    rowLabel.textContent = STATE.mode === "four" ? formatDayShort(day).toUpperCase() : "";
    row.appendChild(rowLabel);
    if (!sharedAxis && days.length > 1) addRowAxis(row, day);
    rows.appendChild(row);

    var start = dayStart(day);
    var end = nextDayStart(day);
    var segments = [];
    STATE.events.filter(function (event) { return timedIntersectsDay(event, day); }).forEach(function (event) {
      var segStart = new Date(Math.max(event.start.getTime(), start.getTime()));
      var segEnd = new Date(Math.min(event.end.getTime(), end.getTime()));
      var left = timelinePercent(segStart, day);
      var right = timelinePercent(segEnd, day);
      segments.push({ event: event, left: left, right: Math.max(left + 0.5, right), lane: 0 });
    });
    totalVisible += segments.length;
    var laneCount = layoutLanes(segments);
    var rowPixels = document.getElementById("timelineViewport").clientHeight * rowHeight / 100;
    var laneCapacity = Math.max(1, Math.floor(Math.max(0, rowPixels - 18) / 49));
    var maxLanes = Math.min(STATE.mode === "four" ? 2 : 4, laneCapacity);
    var hidden = 0;
    segments.forEach(function (segment) {
      if (segment.lane >= maxLanes) { hidden++; return; }
      rows.appendChild(createEventButton(segment.event, segment, index * rowHeight, rowHeight, Math.min(maxLanes, laneCount), now));
    });
    if (hidden) {
      var more = document.createElement("button");
      more.type = "button";
      more.className = "overflowButton interactive";
      more.textContent = "+" + hidden;
      more.style.bottom = "calc(" + ((days.length - index - 1) * rowHeight) + "% + 7px)";
      more.onclick = function () { openDaySummary(day); };
      rows.appendChild(more);
    }
  });

  var today = days[0];
  var marker = document.getElementById("nowMarker");
  if (now >= dayStart(today) && now < nextDayStart(today)) {
    marker.style.display = "block";
    marker.style.left = timelinePercent(now, today) + "%";
    marker.style.top = "0";
    marker.style.height = rowHeight + "%";
  } else marker.style.display = "none";

  var empty = document.getElementById("emptyState");
  empty.style.display = totalVisible === 0 && allDay.length === 0 && STATE.status !== "unconfigured" && STATE.status !== "bridge" && STATE.status !== "error" ? "flex" : "none";
}

function renderAllDay(events) {
  var wrap = document.getElementById("allDayItems");
  wrap.innerHTML = "";
  events.slice(0, 5).forEach(function (event) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "allDayChip interactive";
    button.textContent = event.title;
    button.onclick = function () { openDetail(event); };
    wrap.appendChild(button);
  });
  if (events.length > 5) {
    var more = document.createElement("button");
    more.type = "button";
    more.className = "allDayChip interactive";
    more.textContent = "+" + (events.length - 5);
    more.onclick = function () { openAllDaySummary(events); };
    wrap.appendChild(more);
  }
}
