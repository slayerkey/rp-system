# Windows Settings Manager Validation

## GO criteria met

- Product job is PC mode switching, not a generic Windows toolbox.
- Lite provides a small set of stateful individual controls.
- Pro adds a saved multi-setting transaction layer.
- No unsupported Night Light, DND, theme, Bluetooth, or Wi-Fi claim is made.
- No coordinate/UI automation path exists.
- Mode defaults contain names only and do not impose configuration.
- Writes are followed by Windows readback.
- External Windows changes are polled.
- Partial mode results are surfaced explicitly.

## Technical surfaces

- Display topology: QueryDisplayConfig / SetDisplayConfig
- HDR: DisplayConfigGetDeviceInfo / DisplayConfigSetDeviceInfo
- Power and timeout: powercfg.exe
- Keep Awake: SetThreadExecutionState
- Lock: LockWorkStation

## Remaining validation boundary

The release remains blocked until real Windows 10/11 host, HDR, multi-monitor, laptop, sleep/resume, reboot, external-change, and physical Stream Deck tests pass.
