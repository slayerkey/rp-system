# Windows Settings Manager Validation

## Current direction

The product has been pivoted from a PC-Modes-first concept to a premium **Windows Control Center**.

Primary Pro value is the exact 15-key standard profile:

- Lock
- Sleep
- Hibernate
- Restart
- Shutdown
- Wi-Fi
- Bluetooth
- Power Plan
- Keep Awake
- Light / Dark Theme
- Previous Desktop
- Next Desktop
- New Desktop
- Close Desktop
- Current Desktop

Lite is a six-action starter set.

PC Modes remain optional advanced functionality only.

## Technical principles

- live state is read from Windows where available
- writes are followed by readback where Windows exposes a readable result
- uncertainty fails closed
- no coordinate clicking
- no Quick Settings automation
- destructive actions are protected by default
- another PackRat product keeps ownership when it already provides the deeper specialist workflow

## Current technical surfaces

- Lock: LockWorkStation
- Sleep / Hibernate: SetSuspendState
- Restart / Shutdown: Windows shutdown executable behind default two-press confirmation
- Wi-Fi / Bluetooth: Windows.Devices.Radios Radio API with RequestAccessAsync / SetStateAsync and readback
- Power Plan: powercfg.exe
- Keep Awake: SetThreadExecutionState
- Theme: current-user Personalize values with settings-change broadcast and readback
- Virtual desktops: Windows shell virtual-desktop commands plus independent registry-state confirmation
- Existing advanced HDR: RtlGetVersion-gated Windows 11 24H2 DisplayConfig HDR packets
- Existing advanced display topology: QueryDisplayConfig / SetDisplayConfig
- Existing advanced timeout controls: powercfg.exe

The virtual-desktop registry surface is explicitly treated as compatibility-sensitive. It is isolated behind capability checks and must pass real Windows physical QA before release.

## Fresh automation status

The Windows Control Center implementation candidate is:

`f1fade4db8ea8b11e2e359c914b38e30a2b626f7`

Fresh candidate evidence passes:

### Windows Settings Manager CI

- Run: `34866699986`
- Job: `104052669806`
- Result: PASS
- locked install: PASS
- strict TypeScript build: PASS
- policy tests: 48 / 48 PASS
- native Windows backend smoke: PASS on Windows build 26100
- HDR API boundary: `hdr-state`
- hosted-runner radio observations: Wi-Fi unknown, Bluetooth unknown
- hosted-runner theme observation: light
- hosted-runner virtual desktop state: unavailable
- official Elgato validation: PASS
- production dependency audit: PASS
- Lite + Pro package: PASS
- package artifact: `10357755664`
- digest: `sha256:d8bbddd8c35d2f039de2f62bdb3e2d1c530357abc1c656f47d66e28743766e7d`

The hosted runner proves that the backend compiles, starts, preserves the existing HDR boundary, returns the new snapshot shape, and tolerates radio/desktop capability absence. It does not substitute for physical radio or virtual-desktop control QA.

### Windows Settings Manager Portable CI

- Run: `34866700149`
- Job: `104052366202`
- Result: PASS
- build/tests: PASS
- official Elgato validation/package: PASS
- production dependency audit: PASS
- deterministic Lite + Pro Rat Art: PASS
- Marketplace media dimensions: PASS
- portable artifact: `10357795262`
- digest: `sha256:9f28b772a76dd56612134899d7faf17eb46fd5eb51201d6fdaf6fab4d171f3c5`

### Repository / commercial gates

- RatPack Lightweight CI: PASS
  - Run: `34866700093`
  - Job: `104052208632`
- Lite Pro Portfolio Audit: PASS
  - Run: `34866700037`
  - Job: `104052207846`
- Rat Ship Marketplace Routing CI: PASS
  - Run: `34866700002`
  - Job: `104052209306`

The product-record and validation commits after the candidate only record evidence/status and do not change plugin runtime, profile assembly, backend behavior, or Marketplace media generation.

The new Control Center Marketplace media still requires human visual review before release.

## Physical validation boundary

Even after hosted CI passes, both products remain BLOCKED until real Windows + Stream Deck testing covers:

- Sleep / Hibernate
- protected Restart / Shutdown
- Wi-Fi radio state/control and permission failures
- Bluetooth radio state/control and unavailable hardware
- external power-plan changes
- Keep Awake lifecycle
- Light / Dark theme and external changes
- virtual desktop Previous / Next / New / Close / Current behavior
- Windows reboot and Stream Deck restart
- profile installation
- physical title readability / no overflow
- backend-offline behavior
- Rat Dev rebuild of a currently linked development plugin

Existing advanced HDR/display/timeout/PC-Mode safety behavior also remains subject to its prior physical matrix where applicable.

## Release state

Lite and Pro stay `workflow_state: BLOCKED`.

Pro publishes first after physical QA. Lite remains blocked until exact verified direct Marketplace URLs/IDs are recorded and strict Lite-to-Pro shipping audit passes.
