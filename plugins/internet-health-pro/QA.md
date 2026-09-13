# QA plan — Internet Health Pro

Automated coverage must include:

- healthy connection
- latency spike and very slow connection
- jitter spike
- observed probe loss
- single target outage without whole-internet outage
- confirmed whole-network outage
- repeated DNS failure
- recovery / reconnect
- sleep-resume gap not counted as an outage
- VPN-style latency / route change without false outage
- unavailable target
- HTTP rate-limit response still proving reachability
- IPv4 / IPv6 target family forwarding
- Stream Deck/plugin restart with local history reload
- simulated 24-hour run with bounded storage growth
- multiple keys/targets sharing one monitoring engine
- speed test is manual only and transfer cap stays at 8 MB down + 2 MB up
- manifest / action / asset structure
- Elgato CLI validation and package creation on clean CI

Final confidence boundary: install the exact packaged `.streamDeckPlugin` into Stream Deck and observe a healthy network, a temporary disconnect/reconnect, and one manual speed test. Automated QA should discover ordinary code, package, or manifest failures before that point.

## Current automated gate status

Candidate `925899d40ed6f894896ad6932205a6dd3829130a` triggered Internet Health Pro CI run `34761798011`.

Both hosted test jobs failed before runner assignment:

- `windows-latest`: runner_id 0, zero executed steps
- `macos-latest`: runner_id 0, zero executed steps
- Elgato validate/package job: skipped because the test matrix never started

Other repository workflows on the same commit failed at the same pre-runner boundary. This is recorded as an infrastructure/runner allocation blocker, not as a product QA failure. Do not mark the plugin qa_passed until the deterministic test/build/live-smoke/Elgato validate/package gate actually executes and passes.

