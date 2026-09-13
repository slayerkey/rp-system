# Wireless Device Manager feasibility

## Decision

**GO, with capability-gated control.**

The niche is not empty. Current products solve meaningful pieces:

- Bluetooth Device Connector by Chromus is strong at one-key Windows Bluetooth audio connect/disconnect, per-key device selection, A2DP/HFP profile handling, and audio routing.
- EasyBluetooth's Stream Deck plugin is strong at battery/status presentation but reads from the separate EasyBluetooth local Data API.
- Bluetooth Monitor is an established older Windows Marketplace plugin.
- BarRaider Win Tools includes global Bluetooth on/off among a much wider Windows utility set.
- Additional device-specific battery plugins exist, which confirms battery monitoring is already a real category rather than an empty niche.

PackRat is differentiated only if it stays focused on the combined job: **what are my wireless devices doing, which telemetry does Windows actually expose for each one, and which controls are actually available?**

## Windows capability boundary

The bridge requests Windows Association Endpoint properties for paired Bluetooth devices:

- paired: `System.Devices.Aep.IsPaired`
- connected: `System.Devices.Aep.IsConnected`
- present/available: `System.Devices.Aep.IsPresent`
- friendly display name: DeviceInformation name
- address/container identity: AEP address/container properties
- battery percentage: `System.Devices.BatteryLife` when exposed
- charging: `System.Devices.BatteryPlusCharging` when exposed

Battery and charging are never synthesized. Missing properties mean missing capabilities.

Connect/disconnect in v0.1 is intentionally limited to classic Bluetooth audio devices where Windows exposes controllable Bluetooth audio services. Mouse, keyboard, controller and arbitrary BLE control is not claimed. Unsupported devices still receive status and battery/charging capabilities when Windows exposes them.

`lastObservedAt` is PackRat's own last successful observation timestamp, not a claim that Windows exposes a universal last-seen timestamp.

## Architecture

The customer installs only the Stream Deck plugin. A small self-contained Windows bridge is bundled inside the package for x64 and arm64. There is no separately installed helper application, account, cloud service, or persistent background service.

The Node plugin polls the bundled bridge, caches device identity by container/address where possible, advertises capabilities per detected device, and never turns a missing capability into a clickable promise.

## Product split

Lite:
- one selected device
- status / battery / control views through one configurable action type
- battery and charging only when exposed
- control only when exposed

Pro:
- many device keys
- dashboard
- favorites and Cycle Device
- groups such as GAMING / WORK / TRAVEL
- low-battery thresholds and alert transition
- charging status when exposed
- supported connect/disconnect
- bundled multi-device profiles

Profiles organize/status devices and do not auto-connect a group.
