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
- distinct huge entries with identical bounded previews remain distinct
- corrupt and unsupported-version persistence recovery
- bridge protocol mismatch/update-required state and recovery
- pagehide cleanup plus single reconnect on pageshow
- HTML-looking text, Unicode, emoji, and descender-heavy glyph fixtures render as plain text
- 40 px minimum tested touch targets across compact layouts
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
1. companion Windows build + source and published-executable self-tests
2. published customer EXE first-run self-install/startup/health smoke
3. second-launch upgrade smoke proving the running installed bridge is replaced and relaunched
4. shipped ZIP uninstall smoke proving process, HKCU startup entry, and local app-data directory cleanup
5. widget pure-function verify
6. inline build, translation sync, and stale check
7. all-eight deterministic Rat Art capture assertions
8. official CORSAIR validate
9. official CORSAIR package
10. exact ZIP/package integrity and root file checks
11. lexical iCUE settings smoke
12. no-callback iCUE settings autosync smoke
13. Corsair Labs Windows runner smoke
14. packaged loopback pairing/reconnect smoke
15. StreamSpell packaged verification
16. deterministic Rat Art
17. Rat Ship marketplace kit
18. complete companion ZIP integrity check, including security and uninstall files
19. versioned companion GitHub Release published only after the preceding gates pass
