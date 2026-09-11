# Clipboard Shelf QA

Hardware-free target: release candidate. Physical XENEON validation is not claimed.

Required deterministic cases:
- short text
- very long text and unbroken tokens
- multiline text
- URLs
- duplicate entries
- rapid sequential ingestion in bridge self-test
- pinned items and favorites
- configured history limits with pins preserved
- individual delete with deliberate two-tap confirmation
- clear history with deliberate confirmation
- Private Mode pause/hide behavior
- bridge offline and automatic reconnect
- missing and rejected pairing codes
- non-text clipboard changes clear stale CURRENT state
- long text preserves full local copy data while limiting display transport size
- corrupt persistence recovery
- all eight official XENEON layouts

Privacy assertions:
- no clipboard text or pairing token in /health
- no clipboard text or pairing token written to console logs
- per-user pairing required before any snapshot is sent
- no cloud endpoint
- loopback bind only
- WebSocket subprotocol required
- persisted state protected with Windows DPAPI
- deterministic fixtures only in CI

Release gate:
1. companion Windows build + self-test
2. widget pure-function verify
3. inline build, translation sync, and stale check
4. all-eight deterministic Rat Art capture assertions
5. official CORSAIR validate
6. official CORSAIR package
7. exact ZIP/package integrity and root file checks
8. lexical iCUE settings smoke
9. no-callback iCUE settings autosync smoke
10. Corsair Labs Windows runner smoke
11. packaged loopback pairing/reconnect smoke
12. StreamSpell packaged verification
13. deterministic Rat Art
14. Rat Ship marketplace kit
15. versioned companion GitHub Release published only after the preceding gates pass
