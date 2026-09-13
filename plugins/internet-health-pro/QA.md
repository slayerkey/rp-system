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
