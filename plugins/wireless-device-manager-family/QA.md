# Wireless Device Manager QA

## Automated release gate

- [ ] npm ci from lockfile
- [ ] TypeScript no-emit check
- [ ] deterministic Standard / XL / Plus profile generation for Lite and Pro
- [ ] device identity/capability fixture tests
- [ ] low-battery alert transition tests
- [ ] duplicate-name and device-ID migration tests
- [ ] x64 self-contained Windows bridge publish
- [ ] arm64 self-contained Windows bridge publish
- [ ] bridge static snapshot command on Windows runner without requiring Bluetooth hardware
- [ ] official Elgato validation: Lite
- [ ] official Elgato validation: Pro
- [ ] official Elgato packaging: Lite
- [ ] official Elgato packaging: Pro
- [ ] package contains no external installer or cloud credential
- [ ] no Encoder controller / fake dial action

## Fixture matrix

Automated fixtures cover:
- Bluetooth headphones with battery + charging
- keyboard with battery but no control
- mouse with no battery telemetry
- controller with battery
- sleeping/present=false device
- disconnected device
- unpaired/removed device disappearance
- removed and re-paired device with changed endpoint ID but stable address/container identity
- duplicate friendly names
- Bluetooth adapter disabled
- bridge/service error
- several devices at once
- reboot/sleep-resume equivalent snapshot transitions

## Required real Windows smoke before READY_TO_SHIP

This cannot be honestly replaced by CI because GitHub runners do not provide paired Bluetooth hardware.

1. Headphones: verify paired, connected, present, battery if Windows exposes it, and audio connect/disconnect.
2. Keyboard: verify status; battery only if exposed; CONNECT/DISCONNECT hidden unless actually supported.
3. Mouse: same.
4. Xbox or other controller: same.
5. Battery-capable device and no-battery device side by side.
6. Sleeping device, power off/on, disconnect/reconnect.
7. Remove and re-pair device.
8. Two devices with the same friendly name.
9. Disable/enable Bluetooth adapter.
10. Restart Bluetooth service if safe on the host.
11. Reboot Windows.
12. Sleep/resume Windows.
13. Several devices simultaneously.
14. Confirm Stream Deck+ profile uses keys only and exposes no fake dial behavior.

Record exact device models and which capabilities Windows exposed. Any capability that fails this rule must be removed or narrowed before Marketplace submission.
