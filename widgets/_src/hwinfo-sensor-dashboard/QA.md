# HWiNFO Sensor Dashboard QA

Release boundary: Windows + separately installed HWiNFO + Shared Memory Support + local PackRat HWiNFO Sensor Bridge + CORSAIR XENEON Edge.

Required gates:
- companion build and deterministic self-test
- mocked shared-memory parsing with 140 readings, duplicate names, UTF-8 extensions, true zero, NaN/unavailable, extreme values, malformed layout
- HWiNFO not running, running with Shared Memory missing, Shared Memory disappearing, DEAD mapping, stale polling, no readings, access/busy states
- exact units from HWiNFO; no fake unit conversion
- stable ID selection with fingerprint fallback when IDs differ on another machine
- bounded rolling history and no duplicate widget reconnect loops
- searchable arbitrary-sensor picker, thresholds, presets, per-layout slot selection
- all eight authored compositions with overflow/runtime assertions
- generated shipping source freshness
- official CORSAIR CLI validation and .icuewidget package
- exact package integrity
- lexical iCUE Custom Style regression and no-callback autosync
- exact-package fixture companion WebSocket integration
- companion kill/restart recovery
- Corsair Labs Windows runner
- StreamSpell all-eight exact-package verification
- deterministic Rat Art and Maker Console kit preflight
- stable public companion ZIP and SHA-256 verification
- customer install/update/uninstall lifecycle
- physical XENEON hardware remains the final unclaimed boundary if unavailable
