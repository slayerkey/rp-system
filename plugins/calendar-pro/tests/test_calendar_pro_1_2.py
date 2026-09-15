#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, subprocess, tempfile, zipfile

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "artifacts" / "com.packrat.calendarsyncpro-v1.2.0.0.streamDeckPlugin"
EXPECTED_SHA256 = "61b5fa8d58044aad5caf3542f19911b3acec89d35b6de5e75d684b3cc1c8bfd1"
PREFIX = "com.packrat.calendarsyncpro.sdPlugin/"

assert ARTIFACT.exists(), f"missing artifact: {ARTIFACT}"
assert hashlib.sha256(ARTIFACT.read_bytes()).hexdigest() == EXPECTED_SHA256

with zipfile.ZipFile(ARTIFACT) as z:
    assert z.testzip() is None
    manifest = json.loads(z.read(PREFIX + "manifest.json"))
    assert manifest["UUID"] == "com.packrat.calendarsyncpro"
    assert manifest["Version"] == "1.2.0.0"
    assert {a["UUID"] for a in manifest["Actions"]} == {
        "com.packrat.calendarsyncpro.next",
        "com.packrat.calendarsyncpro.agenda",
        "com.packrat.calendarsyncpro.join",
    }
    plugin = z.read(PREFIX + "bin/plugin.js").decode("utf-8")
    pi = z.read(PREFIX + "ui/pi.js").decode("utf-8")
    html = {name: z.read(PREFIX + "ui/" + name).decode("utf-8") for name in ("next.html", "agenda.html", "join.html")}

assert "Packrat Calendar Panel companion bridge" not in plugin
for token in ("__packratAllDayMode","__packratNextEvents","__packratAgendaEvents","__packratBlinkView","er.prototype.paintPro","Xs.prototype.viewFor","Js.prototype.paintOne"):
    assert token in plugin, token
for token in ("settings.allDayMode", "settings.flashMode", '"agendaOnly"', '"amberRed"'):
    assert token in pi, token
for name, text in html.items():
    assert 'id="allDayMode"' in text, name
    assert 'id="flashMode"' in text, name

with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    with zipfile.ZipFile(ARTIFACT) as z:
        z.extractall(td)
    plugin_path = td / PREFIX / "bin/plugin.js"
    pi_path = td / PREFIX / "ui/pi.js"
    subprocess.run(["node", "--check", str(plugin_path)], check=True)
    subprocess.run(["node", "--check", str(pi_path)], check=True)

    source = plugin_path.read_text()
    start = source.index("const __packratSetupView")
    end = source.index("// Next Meeting:", start)
    helpers = source[start:end]
    harness = r'''
function is(events, nowMs) {
  const end = new Date(nowMs); end.setHours(23,59,59,999);
  return [...events].filter(e => e.endMs > nowMs && e.startMs <= end.getTime())
    .sort((a,b) => a.startMs-b.startMs || a.title.localeCompare(b.title));
}
''' + helpers + r'''
const now = new Date(2026,8,15,8,0,0,0).getTime();
const events = [
 {title:'All Day', allDay:true, startMs:new Date(2026,8,15,0,0).getTime(), endMs:new Date(2026,8,16,0,0).getTime()},
 {title:'Standup', allDay:false, startMs:new Date(2026,8,15,9,0).getTime(), endMs:new Date(2026,8,15,9,30).getTime()},
 {title:'Review', allDay:false, startMs:new Date(2026,8,15,10,0).getTime(), endMs:new Date(2026,8,15,11,0).getTime()}
];
function eq(a,b,msg){ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(msg+' got='+JSON.stringify(a)); }
eq(__packratNextEvents(events,{allDayMode:'agendaOnly'}).map(e=>e.title), ['Standup','Review'], 'agendaOnly next');
eq(__packratNextEvents(events,{allDayMode:'hide'}).map(e=>e.title), ['Standup','Review'], 'hide next');
eq(__packratNextEvents(events,{allDayMode:'include'}).map(e=>e.title), ['All Day','Standup','Review'], 'include next');
eq(__packratAgendaEvents(events,{allDayMode:'agendaOnly'},now).map(e=>e.title), ['Standup','Review','All Day'], 'agendaOnly agenda ordering');
eq(__packratAgendaEvents(events,{allDayMode:'hide'},now).map(e=>e.title), ['Standup','Review'], 'hide agenda');
eq(__packratAgendaEvents(events,{allDayMode:'include'},now).map(e=>e.title), ['All Day','Standup','Review'], 'include agenda');
if(__packratAllDayMode({})!=='agendaOnly') throw new Error('default all-day mode');
const amber={kind:'event',urgency:'warn'};
const red={kind:'event',urgency:'imminent'};
if(__packratBlinkView(amber,{flashMode:'redOnly'},1001).urgency!=='warn') throw new Error('redOnly flashed amber');
if(__packratBlinkView(red,{flashMode:'redOnly'},1001).urgency!=='normal') throw new Error('redOnly did not blink red off');
if(__packratBlinkView(amber,{flashMode:'amberRed'},1001).urgency!=='normal') throw new Error('amberRed did not blink amber off');
if(__packratBlinkView(red,{flashMode:'amberRed'},2000).urgency!=='imminent') throw new Error('even phase should show alert colour');
console.log('Calendar Sync Pro 1.2 helper behavior OK');
'''
    harness_path = td / "helper-regression.mjs"
    harness_path.write_text(harness)
    subprocess.run(["node", str(harness_path)], check=True)

print("Calendar Sync Pro 1.2.0.0 package regression: PASS")
