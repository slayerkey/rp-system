"""Local one-page helper for the api-spend cost-endpoint probe.

Serves http://127.0.0.1:8765 with direct links to both admin-key pages and two
paste boxes. Keys are used in-memory for the request only: never logged, never
written to disk, never sent anywhere except api.anthropic.com / api.openai.com.

The redacted verdict is written to plugins/api-spend/probe_result.json so it can
be read back without the keys ever appearing anywhere.

Run:  python plugins/api-spend/probe_server.py
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 8765
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "probe_result.json")

PAGE = """<!doctype html><meta charset=utf-8>
<title>api-spend probe</title>
<style>
 body{background:#0d1117;color:#e6edf3;font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px}
 h1{color:#2BE86A;font-size:20px} h2{font-size:15px;margin:26px 0 6px}
 a{color:#2BE86A} input{width:100%;padding:11px;margin:6px 0 2px;background:#161b22;
 border:1px solid #30363d;border-radius:6px;color:#e6edf3;font-family:ui-monospace,monospace}
 button{margin-top:20px;padding:12px 22px;background:#2BE86A;color:#0d1117;border:0;
 border-radius:6px;font-weight:700;font-size:15px;cursor:pointer}
 button:disabled{opacity:.5;cursor:default}
 pre{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:14px;
 white-space:pre-wrap;word-break:break-word;margin-top:20px}
 .n{color:#8b949e;font-size:13px} .ok{color:#2BE86A} .bad{color:#ff7b72}
</style>
<h1>api-spend cost endpoint probe</h1>
<p class=n>Keys are used for this one request and are never saved, logged, or sent
anywhere except the provider. Leave a box empty to skip that provider.</p>

<h2>1. OpenAI admin key <span class=n>(must start sk-admin, not sk-proj)</span></h2>
<a href="https://platform.openai.com/settings/organization/admin-keys" target=_blank>
Open OpenAI admin keys page</a>
<input id=oa type=password placeholder="sk-admin-...">

<h2>2. Anthropic admin key <span class=n>(must start sk-ant-admin)</span></h2>
<a href="https://console.anthropic.com/settings/admin-keys" target=_blank>
Open Anthropic admin keys page</a>
<input id=an type=password placeholder="sk-ant-admin...">

<button id=go onclick=run()>Run probe</button>
<pre id=out>Waiting.</pre>
<script>
async function run(){
 const b=document.getElementById('go'), o=document.getElementById('out');
 b.disabled=true; o.textContent='Probing, this takes a few seconds...';
 try{
  const r=await fetch('/probe',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({openai:document.getElementById('oa').value.trim(),
                        anthropic:document.getElementById('an').value.trim()})});
  const j=await r.json(); o.textContent=j.text;
 }catch(e){ o.textContent='Local error: '+e; }
 b.disabled=false;
}
</script>
"""


def call(url, headers, params):
    full = url + "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(full, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:700]
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def summarise(name, status, body, days):
    lines = [f"===== {name} =====", f"HTTP {status}"]
    verdict = "FAILED"
    if not isinstance(body, dict):
        lines += [f"error body: {body}",
                  "VERDICT: FAILED. Read the message above: auth problem, permission",
                  "         problem, or an Enterprise-only gate."]
    else:
        data = body.get("data") or []
        lines.append(f"top-level keys: {list(body.keys())}")
        lines.append(f"buckets returned: {len(data)}")
        total = 0.0
        for bucket in data:
            for item in bucket.get("results", []):
                v = item.get("amount", item.get("value"))
                if isinstance(v, dict):
                    v = v.get("value")
                if isinstance(v, (int, float)):
                    total += float(v)
        if data:
            lines.append(f"summed spend over last {days}d: {total:.4f}")
            lines.append("sample bucket:")
            lines.append(json.dumps(data[0], indent=2)[:700])
            verdict = "WORKS"
            lines.append("VERDICT: WORKS. Endpoint is reachable on this account and returns buckets.")
        else:
            verdict = "EMPTY"
            lines.append("VERDICT: AUTH OK, zero buckets. Either no spend in the window or")
            lines.append("         aggregation lags. Not a failure. Widen the window to confirm.")
    return "\n".join(lines), verdict


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass  # never log request bodies

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(PAGE.encode())

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(n) or b"{}")
        now, days = int(time.time()), 30
        start = now - days * 86400
        out, verdicts = [], {}

        ok = (body.get("openai") or "").strip()
        if ok:
            s, b = call("https://api.openai.com/v1/organization/costs",
                        {"Authorization": f"Bearer {ok}"},
                        {"start_time": start, "end_time": now,
                         "bucket_width": "1d", "limit": days})
            t, v = summarise("OPENAI /v1/organization/costs", s, b, days)
            out.append(t)
            verdicts["openai"] = {"http": s, "verdict": v}
        else:
            out.append("===== OPENAI: skipped, no key entered =====")

        an = (body.get("anthropic") or "").strip()
        if an:
            s, b = call("https://api.anthropic.com/v1/organizations/cost_report",
                        {"x-api-key": an, "anthropic-version": "2023-06-01"},
                        {"starting_at": time.strftime("%Y-%m-%dT00:00:00Z", time.gmtime(start)),
                         "ending_at": time.strftime("%Y-%m-%dT00:00:00Z", time.gmtime(now)),
                         "limit": 31})
            t, v = summarise("ANTHROPIC /v1/organizations/cost_report", s, b, days)
            out.append(t)
            verdicts["anthropic"] = {"http": s, "verdict": v}
        else:
            out.append("===== ANTHROPIC: skipped, no key entered =====")

        text = "\n\n".join(out)
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump({"checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                       "window_days": days, "results": verdicts, "text": text}, f, indent=2)
        payload = json.dumps({"text": text}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    print(f"api-spend probe UI: http://127.0.0.1:{PORT}")
    print(f"verdict will be written to: {OUT}")
    HTTPServer(("127.0.0.1", PORT), H).serve_forever()
