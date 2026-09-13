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
- HDR: DisplayConfigGetDeviceInfo / DisplayConfigSetDeviceInfo through the RtlGetVersion-gated Windows 11 24H2 separated HDR path only; older ambiguous Advanced Color writes are intentionally not used
- Power and timeout: powercfg.exe
- Keep Awake: SetThreadExecutionState
- Lock: LockWorkStation

## Automated execution status

GitHub-hosted Actions are currently failing before runner assignment (runner_id 0, zero executed steps), including unrelated repository workflows. The PackRat self-hosted Windows gate is queued while that runner is offline. These infrastructure failures are not treated as product test results.

## Remaining validation boundary

The release remains blocked until the actual automated build/validator/package gates execute successfully and the real Windows 10/11 host, HDR, multi-monitor, laptop, sleep/resume, reboot, external-change, profile-navigation, and physical Stream Deck checks pass.
