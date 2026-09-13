# Wireless Device Manager feasibility

## Decision

**GO, with capability-gated control and a required real-Windows smoke before release.**

The niche is not empty. Current products solve meaningful pieces:

- Bluetooth Device Connector by Chromus is a strong Windows Bluetooth **audio** switcher. It owns one-key connect/disconnect, A2DP/HFP handling, handoff behavior, live state, and Windows audio-endpoint routing.
- EasyBluetooth's Stream Deck integration is strong at battery/status presentation but reads from the separate EasyBluetooth local Data API/application.
- Bluetooth Monitor is an established Windows Marketplace product.
- BarRaider Win Tools includes global Bluetooth on/off among a much wider Windows utility set.
- Additional device-specific battery plugins confirm that battery monitoring is already a real category.

PackRat is differentiated only if it stays focused on the broader customer job:

> **What are my wireless devices doing, what telemetry does Windows actually expose for each one, and which controls are actually safe to offer?**

PackRat is **not** positioned as a better audio switcher than Chromus. Audio control is one capability inside a broader multi-class status, battery, alert, favorites, groups, and dashboard product.

## Windows capability boundary

The bundled bridge requests Windows Association Endpoint properties for paired Bluetooth devices:

- paired: `System.Devices.Aep.IsPaired`
- connected: `System.Devices.Aep.IsConnected`
- present/available: `System.Devices.Aep.IsPresent`
- friendly display name: `DeviceInformation.Name`
- identity: Bluetooth address first, then container ID, then endpoint ID fallback
- battery percentage: `System.Devices.BatteryLife` when exposed
- battery + charging: `System.Devices.BatteryPlusCharging` when exposed

`BatteryPlusCharging` is decoded according to the Windows property contract: 0-100 means not charging, 101-200 means charging with battery percentage equal to value minus 100, and 201 is unknown. Missing or unknown telemetry is never synthesized.

Every device independently advertises:

- `STATUS`
- `CONNECT`
- `DISCONNECT`
- `BATTERY`
- `CHARGING`

A missing capability stays unavailable in the Property Inspector and key behavior.

### Status and availability

Status is device-wide Windows Bluetooth state, not an audio-endpoint claim.

A paired device with `IsPresent=false` remains a paired sleeping/off device and renders as `SLEEP/OFF`.

A device that disappears from the paired enumeration is retained only as a stale selection record, marked `UNPAIRED`, with battery, charging, connect, and disconnect capabilities removed.

When the Bluetooth adapter is disabled or a bridge snapshot fails, the plugin preserves the last catalog instead of falsely converting every cached device into an unpaired device. Keys surface the adapter-off state separately.

`lastObservedAt` is PackRat's own last successful observation timestamp. It is not marketed as a universal Windows last-seen API.

## Connect / disconnect boundary

Windows does not expose one universal supported API that safely force-connects every paired Bluetooth headset, mouse, keyboard, controller, and BLE peripheral.

v0.1 therefore does **not** claim generic Bluetooth connection control.

Control is restricted to classic Bluetooth Audio/Video-class devices:

- `CONNECT` is advertised only when Windows positively reports the paired audio-class device as present.
- `DISCONNECT` is advertised only when the audio-class device is connected and Windows reports an installed A2DP or HFP service.
- mouse, keyboard, controller, and arbitrary BLE connect/disconnect are not claimed.

The bridge uses the Windows Bluetooth service-state API for A2DP/HFP only. Because Windows can report an audio service as already enabled while the remote device is no longer actively connected, CONNECT handles the already-enabled state by cycling the relevant audio service and retrying. A CONNECT operation is not reported as successful until Windows confirms the device-wide Bluetooth connection within a bounded verification window.

A2DP and HFP are handled independently so a device that exposes only one supported audio profile is not rejected merely because the other profile is absent.

DISCONNECT is defined as successfully disabling the exposed Bluetooth audio services. A multi-function device may still remain device-wide connected through another profile.

This behavior intentionally remains behind the real-hardware release gate. `BluetoothSetServiceState` is a Bluetooth service enable/disable primitive, not a universal connection guarantee, and PackRat will narrow or remove the control claim if physical testing does not prove it reliable enough.

PackRat does not automatically change the user's default Windows audio endpoint as part of this product.

## Architecture

The customer installs only the Stream Deck plugin.

A self-contained native Windows bridge is bundled inside each plugin package for:

- Windows x64
- Windows ARM64

There is no separately installed helper application, cloud account, external API, or persistent PackRat service.

The Stream Deck Node process polls the bundled bridge, maintains the device catalog, applies capability gating, drives alerts/groups/favorites, and renders the keys.

## Product split

### Wireless Device Manager — Free

- one shared selected Bluetooth device across the included MY DEVICE / BATTERY / CONNECT keys
- connection/presence status
- battery where Windows exposes it
- charging state where Windows exposes it
- audio connect/disconnect only where the device advertises the supported capability
- one configurable Stream Deck action type
- Standard / XL / Stream Deck+ key-only profiles

### Wireless Device Manager Pro — $7.99

Everything in Lite, plus:

- multiple selected wireless devices
- dedicated key per device
- Device Dashboard / multi-device status
- favorites
- Cycle Device
- device groups such as GAMING / WORK / TRAVEL
- per-device low-battery thresholds
- low-battery transition alerts
- charging state where exposed
- supported audio connect/disconnect
- Standard / XL / Stream Deck+ multi-device profiles

Pro thresholds are stored per device and drive both the device alert and the Dashboard LOW count.

Profiles organize and summarize devices. They do not bulk-connect a group, and Stream Deck+ exposes no fake dial action.
