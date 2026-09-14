# Windows Settings Manager Lite + Pro Plan

## Decision

GO as a focused **Windows Control Center for Stream Deck**.

The product is no longer positioned around PC Modes. The primary customer job is:

> Put the Windows controls I actually reach for on physical keys, show the real state, and behave predictably.

PackRat does not compete by counting actions. The quality bar is a small set of high-value controls with clear labels, live Windows state, verification after writes, and fail-closed behavior.

## Default Pro control surface

The standard 5x3 Pro profile is the core product:

1. Lock PC
2. Sleep
3. Hibernate
4. Restart
5. Shutdown
6. Wi-Fi
7. Bluetooth
8. Power Plan
9. Keep Awake
10. Light / Dark Theme
11. Previous Desktop
12. Next Desktop
13. New Desktop
14. Close Desktop
15. Current Desktop

Restart and Shutdown require a second press within three seconds by default.

## Lite

Lite is a useful free starter set:

- Lock PC
- Sleep
- Power Plan
- Keep Awake
- Previous Desktop
- Next Desktop

Lite demonstrates the product without giving away the complete Pro control surface.

## Live-state policy

Stateful controls re-read Windows instead of trusting the last PackRat command.

- Wi-Fi and Bluetooth show the effective radio state where Windows exposes it.
- Power Plan shows the active installed plan.
- Keep Awake shows STAY AWAKE or SLEEP NORMAL.
- Theme shows LIGHT, DARK, MIXED, or N/A.
- Current Desktop shows the active desktop index and count when reliable state is available.
- Unavailable capability shows N/A.
- Backend loss shows OFFLINE.
- State-changing controls verify readback when Windows exposes a readable result.

PackRat must not report fake success.

## Control surfaces

- Lock: LockWorkStation.
- Sleep / Hibernate: SetSuspendState. Hibernate fails closed when Windows reports hibernation unavailable.
- Restart / Shutdown: Windows shutdown executable, protected by action-layer confirmation.
- Wi-Fi / Bluetooth: Windows.Devices.Radios Radio API, including permission request and post-write readback.
- Power Plan: powercfg.exe.
- Keep Awake: SetThreadExecutionState.
- Light / Dark Theme: current-user Windows personalization values with a settings-change broadcast and readback.
- Virtual desktops: shell desktop commands isolated behind the backend, with Windows virtual-desktop registry state used to confirm current index/count and changes.

Virtual desktop registry/state behavior is not treated as a stable public Windows API. It is isolated, capability-checked, verified after each action, and must pass physical Windows QA before release.

## Catalog boundaries

Do not duplicate other PackRat products.

- Monitor Manager owns monitor brightness, contrast, input, resolution, refresh rate, deep HDR, and monitor profiles.
- Window Manager owns application placement, resize, snap, restore, and layouts.
- Audio Manager owns audio routing, volume, and mute.
- Wireless Device Manager owns individual Bluetooth peripherals, battery, charging, and per-device connection.
- Internet Health owns connection diagnostics.
- Better Hotkeys owns generic keyboard/mouse macros.
- Clipboard products own clipboard workflows.
- Performance Grapher owns PC performance telemetry.
- PC Power Meter owns energy/power measurement.

Windows Settings Manager may control the **global Bluetooth radio** because that is Windows system state, not an individual device.

## Existing advanced controls

Existing reliable backend work is retained as optional advanced functionality:

- HDR
- Display Topology
- Screen & Sleep timeouts
- System Status
- empty user-configured PC Modes

These controls do not own the default profile or Marketplace positioning. PC Modes remain empty by default and change only explicitly configured settings.

## No brittle UI automation

Forbidden:

- coordinate clicking
- hidden mouse movement
- Quick Settings clicking
- SendKeys-style UI automation for Windows Settings panels
- pretending a settings-page launcher is a real toggle

A shell shortcut may be used only when it is the Windows-defined command surface and the resulting system state is independently read and verified.

## Compatibility

- Windows 10 / 11 subject to capability and physical QA.
- Stream Deck 7.3+.
- Profiles: Stream Deck, Mini, XL, Stream Deck +, Neo, Galleon 100 SD, Stream Deck + XL.
- Stream Deck Studio is not included because it does not use standard Stream Deck app profiles.

## Release state

Both products remain BLOCKED until fresh exact-head automation and the physical Windows/Stream Deck matrix pass. Pro publishes first. Lite only ships after the exact verified Pro/Lite Marketplace URLs and IDs are recorded and the strict Lite-to-Pro shipping audit passes.
