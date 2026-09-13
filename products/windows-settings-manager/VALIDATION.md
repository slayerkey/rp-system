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

## Supplemental local static evidence

These checks were executed in an isolated local harness and are useful regression evidence, but they do **not** replace the canonical locked dependency build, Elgato validator, Windows backend smoke, or physical QA:

- JavaScript-side Property Inspector, profile assembler, validator, and policy-test syntax checks were run during branch hardening and passed at the snapshots tested.
- A strict TypeScript source-shape harness with minimal Node / Stream Deck declarations passed on an earlier hardened branch snapshot. Later edits remain subject to the canonical locked-dependency typecheck.
- Pure PC Mode logic checks passed for HDR matching, prerequisite skips, and COMPLETE / PARTIAL / FAILED aggregation at the snapshots tested.
- ModeStore sanitization checks passed for defaults, valid timeouts, name cleanup, and rejection of blank/null/boolean/fractional/out-of-range timeout values at the snapshots tested.

## Automated execution status

Canonical automated gates now pass on candidate commit `abd14d228b086d6e5af32f083ddb908d8e60b1bd`.

### Hosted Windows evidence

- Workflow: Windows Settings Manager CI
- Run: `34777753557`
- Job: `103778871284`
- Result: PASS
- Locked dependency install: PASS
- Strict TypeScript build / Lite + Pro assembly: PASS
- Policy suite: PASS
- Native Windows backend smoke: PASS
  - embedded C# Add-Type compile
  - ping
  - live snapshot
  - Windows build read
  - HDR API boundary read
  - Keep Awake on/off
- Official Elgato CLI validation: PASS
- Production dependency audit: PASS
- Official Lite package: PASS
- Official Pro package: PASS
- Uploaded package artifact: `10323468252`
- Artifact digest: `sha256:094778e9c834d12b812e4a301a53c5c647c0fa43d12e85a72b63bc70fcf564e8`

### Portable release evidence

- Workflow: Windows Settings Manager Portable CI
- Run: `34777753573`
- Job: `103778871410`
- Result: PASS
- Locked dependency install: PASS
- Strict TypeScript build / Lite + Pro assembly: PASS
- Policy suite: PASS
- Official Elgato CLI validation: PASS
- Production dependency audit: PASS
- Official Lite + Pro packaging: PASS
- Lite + Pro deterministic Rat Art: PASS
- Marketplace media dimension verification: PASS
- Uploaded release-evidence artifact: `10324277249`
- Artifact digest: `sha256:44c6bf5c60cbb4a490cd43cfb0be392d331c607aa6428655b338b9bd497b53db`

The separate PackRat self-hosted Windows workflow may still be used for additional confidence, but it is no longer the only executable Windows evidence: the hosted Windows gate above exercised the native backend successfully.

## Remaining validation boundary

Automated build, test, native Windows smoke, official Elgato validation/package, dependency audit, bundled-profile structural checks, and deterministic Marketplace media generation are complete.

The release remains blocked only on the physical QA boundary: real HDR-capable/unsupported/multi-monitor hardware, laptop AC/battery behavior, sleep/resume/reboot, outside-Windows changes, physical Stream Deck profile install/page navigation, and final human Marketplace media review. Lite also remains commercially blocked until Pro is published and the verified direct Lite/Pro Marketplace URLs/IDs pass the strict routing audit.
