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
- speed test is manual only and remains bounded at the warmed adaptive multi-stream cap
- Property Inspector live state, save/reopen persistence, accent persistence, and command-button transport
- physical key typography regression checks and dedicated 30-second visual graph window
- deterministic major-model profile generation for DeviceTypes 0 / 2 / 7 / 9
- profile archives are declared in the manifest, auto-install, do not force-switch, and are valid ZIP-style .streamDeckProfile files
- manifest / action / asset structure
- Elgato CLI validation and package creation on clean CI

Final confidence boundary: install the exact packaged `.streamDeckPlugin` into Stream Deck and verify readable keys, the five-second live cadence, the 30-second graph, Property Inspector persistence/buttons/accent behavior, one manual speed test, a temporary disconnect/reconnect, and the expected bundled dashboard for the connected Stream Deck model. Automated QA should discover ordinary code, package, profile, or manifest failures before that point.

## Current automated gate status

The canonical automated evidence is tracked in `products/internet-health-pro.json` and GitHub Actions. This QA file describes the required gate rather than freezing an older candidate hash. A release candidate is not `READY_TO_SHIP` until the current source, bundled profiles, Elgato package, Marketplace media, and final hardware pass all agree.
