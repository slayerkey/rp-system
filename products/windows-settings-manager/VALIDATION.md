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

**PENDING on the current Windows Control Center implementation head.**

Do not reuse the prior PC-Modes-oriented automated evidence as release evidence for this pivot. Older passing runs remain useful baseline history only.

Required fresh evidence:

- Windows Settings Manager CI
- Windows Settings Manager Portable CI
- RatPack Lightweight CI
- Lite Pro Portfolio Audit
- Rat Ship Marketplace Routing CI
- official Elgato validation/package
- dependency audit
- deterministic Rat Art

Once those runs complete, record exact current-head run/job/artifact IDs here.

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
