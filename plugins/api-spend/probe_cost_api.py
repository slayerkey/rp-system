"""Probe the Anthropic and OpenAI cost endpoints to settle the one open question
in plugins/api-spend/VALIDATION.md: do these return usable data for a normal
solo-developer account, or are they gated to Enterprise organisations?

Reads keys from the environment so nothing secret is ever typed into a chat:

    setx ANTHROPIC_ADMIN_KEY "sk-ant-admin..."     (then reopen the terminal)
    setx OPENAI_ADMIN_KEY    "sk-admin..."

Run:  python plugins/api-spend/probe_cost_api.py

Prints status, response shape and a redacted sample. Never prints the key.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request


def call(url, headers, params):
    full = url + "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(full, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def report(name, status, body):
    print(f"\n===== {name} =====")
    print(f"HTTP {status}")
    if not isinstance(body, dict):
        print("BODY (truncated):", body)
        print("VERDICT: FAILED. The message above says whether this is an auth problem,")
        print("         a permissions problem, or an Enterprise-only gate.")
        return
    print("top-level keys:", list(body.keys()))
    data = body.get("data") or []
    print(f"buckets returned: {len(data)}")
    if data:
        print("first bucket:")
        print(json.dumps(data[0], indent=2)[:900])
    total = 0.0
    for bucket in data:
        for item in bucket.get("results", []):
            for field in ("amount", "value"):
                v = item.get(field)
                if isinstance(v, dict):
                    v = v.get("value")
                if isinstance(v, (int, float)):
                    total += float(v)
                    break
    print(f"summed spend across window: {total:.4f}")
    print("VERDICT: WORKS." if data else
          "VERDICT: AUTH OK but zero buckets. Either no spend in the window, or daily")
    if not data:
        print("         aggregation lags. Re-run with a wider window before concluding.")


def main():
    now = int(time.time())
    week = now - 7 * 86400

    ak = os.environ.get("ANTHROPIC_ADMIN_KEY")
    if ak:
        status, body = call(
            "https://api.anthropic.com/v1/organizations/cost_report",
            {"x-api-key": ak, "anthropic-version": "2023-06-01"},
            {"starting_at": time.strftime("%Y-%m-%dT00:00:00Z", time.gmtime(week)),
             "ending_at": time.strftime("%Y-%m-%dT00:00:00Z", time.gmtime(now)),
             "limit": 31},
        )
        report("ANTHROPIC /v1/organizations/cost_report", status, body)
    else:
        print("\n===== ANTHROPIC: skipped, ANTHROPIC_ADMIN_KEY not set =====")

    ok = os.environ.get("OPENAI_ADMIN_KEY")
    if ok:
        status, body = call(
            "https://api.openai.com/v1/organization/costs",
            {"Authorization": f"Bearer {ok}"},
            {"start_time": week, "end_time": now, "bucket_width": "1d", "limit": 7},
        )
        report("OPENAI /v1/organization/costs", status, body)
    else:
        print("\n===== OPENAI: skipped, OPENAI_ADMIN_KEY not set =====")

    if not ak and not ok:
        print("\nNo keys set. Nothing probed.")


if __name__ == "__main__":
    main()
