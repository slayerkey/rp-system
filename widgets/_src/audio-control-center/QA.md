# Audio Control Center QA

Product: Audio Control Center
Slug: audio-control-center
Branch: product/audio-control-center
Version: 1.0.0
Price: $9.99

Physical XENEON hardware test: **not performed**. This file records the hardware-free release gate only.

## Troubleshooting playbook coverage

- canonical authored source and generated shipping HTML are checked for freshness
- official package is validated and downstream gates consume the exact package rather than a rebuilt copy
- all eight XENEON layouts are exercised
- touch targets, device switching, volume, mute/unmute and rapid repeated mute taps are exercised
- long friendly names, Unicode, emoji and literal HTML-looking device names are exercised
- crowded device lists are verified to scroll internally without document overflow
- device disappearance, no outputs, no inputs and microphone-volume-unavailable states are exercised
- bridge offline, restart and reconnect are exercised
- bridge protocol mismatch produces an explicit update-required state and recovers after a compatible bridge returns
- Windows/Core Audio snapshot errors produce an explicit audio-error state rather than an empty widget
- bridge command errors are surfaced and controls return to the last confirmed snapshot
- the connection watchdog is checked for a single healthy WebSocket rather than accumulating duplicate sockets
- pagehide cleanup stops watchdog/reconnect timers and closes the active socket
- the real self-contained Windows bridge process is tested against the generated shipping widget
- /health protocol/version/port are asserted before and after bridge restart
- loopback/file origins are allowed while remote and localhost-lookalike origins are rejected
- command schema rejects invalid volume, unknown commands, unknown endpoints and overlong endpoint IDs
- fake bridge mode remains test-only and requires both the fixture flag and test environment variable
- the customer startup installer is executed on the Windows runner and must create the LocalAppData bridge copy plus per-user Startup entry; the uninstaller must remove both
- no iCUE Media provider is used for Windows audio routing
- no localStorage/persistence exists in v1, so persistence-corruption testing is not applicable
- no iCUE property bindings/providers are declared, so iCUE settings callback/autosync testing is not applicable
- official CORSAIR validation/package verification, Corsair Labs Windows runner, StreamSpell, Rat Art and Rat Ship remain required final gates

## Distribution boundary

The product gate also builds `PackRat-Audio-Bridge-1.0.0-win-x64.zip` from the exact tested self-contained bridge executable and includes launcher/setup/security/checksum files.

The release gate publishes that tested bundle as a versioned PackRat GitHub prerelease at:

https://github.com/slayerkey/rp-system/releases/download/audio-control-center-bridge-v1.0.0/PackRat-Audio-Bridge-1.0.0-win-x64.zip

The ZIP contains portable launch plus per-user startup install/uninstall helpers. The install path is under the current user's `%LOCALAPPDATA%`; no administrator access or Windows service is required.

Per-app audio is intentionally not part of v1. Global default-device switching uses a capability-probed Windows policy interface and fails closed when unavailable.
