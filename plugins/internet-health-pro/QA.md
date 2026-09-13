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

Candidate `dc9a53e7a9dd01ea569facbdc072158414f58c64` passed Internet Health Pro CI run `34770102676` after the repository was made public and GitHub-hosted runners could execute normally.

- Windows job `103758022787`: deterministic tests, build, and live network smoke passed
- macOS job `103758023052`: deterministic tests, build, and live network smoke passed
- release job `103758125462`: npm audit/check, official Elgato validation, official package creation, deterministic Rat Art, package/media verification, and artifact upload passed
- release artifact `10321692257`: `internet-health-pro-release-qa`
- artifact ZIP digest: `sha256:265f7b80015b060eb14c44a6a4f401f8cf2e6c601077ec4e1da81fdf7d20c1d0`
- packaged plugin SHA256: `B7E9DEDA74D1316583A05B634E3B778B8B88AE0DCCD0E3F3B51986C219C47039`

During the first real hosted run, CI exposed a deterministic-clock bug: `HistoryStore.flush()` pruned using wall-clock time while monitor tests used an injected clock. That was fixed by passing the monitor clock into history flushes. The corrected candidate then passed on both supported operating systems.

Automated QA is passed. The remaining human confidence boundary is installing the exact packaged `.streamDeckPlugin` in Stream Deck and physically observing healthy rendering, a temporary disconnect/reconnect, and one manual speed test before Marketplace submission.
