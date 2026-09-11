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
- individual delete
- clear history
- Private Mode pause/hide behavior
- bridge offline and automatic reconnect
- all eight official XENEON layouts

Privacy assertions:
- no clipboard text in /health
- no clipboard text written to console logs
- no cloud endpoint
- loopback bind only
- WebSocket subprotocol required
- persisted state protected with Windows DPAPI
- deterministic fixtures only in CI

Release gate:
1. companion Windows build + self-test
2. widget pure-function verify
3. inline build and stale check
4. all-eight deterministic Rat Art capture assertions
5. official CORSAIR validate
6. official CORSAIR package
7. exact ZIP/package integrity and root file checks
8. lexical iCUE settings smoke
9. Corsair Labs Windows runner smoke
10. packaged loopback transport smoke
11. StreamSpell packaged verification
12. deterministic Rat Art
13. Rat Ship marketplace kit
