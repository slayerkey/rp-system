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

Canonical automated gates pass on the exact current candidate commit `af2e7d4e8f0ff68a1c0dbe196cf92321dace0725`.

### Hosted Windows evidence

- Workflow: Windows Settings Manager CI
- Run: `34778323686`
- Job: `103780511518`
- Result: PASS
- Runner: Windows Server 2025, build 26100
- Node runtime under test: 20.20.2
- Locked dependency install: PASS
- Strict TypeScript `tsc --noEmit`: PASS
- Lite + Pro assembly / Rollup build: PASS
- Policy suite: PASS, 40/40 tests
- Native Windows backend smoke under Windows PowerShell 5.1: PASS
  - embedded C# Add-Type compile
  - JSON-line transport
  - ping
  - live snapshot
  - real Windows build read
  - HDR separated-state API selected on build 26100
  - power-plan read
  - Keep Awake on/off
- Official Elgato CLI validation: PASS for Lite and Pro
- Production dependency audit: PASS, 0 vulnerabilities
- Official Lite package: PASS
- Official Pro package: PASS
- Uploaded package artifact: `10323244689`
- Artifact digest: `sha256:badb69cfd206697b3fb618886be581b0b87b3a82acb6f0bfca1ab6dcf730cc4f`

### Portable release evidence

- Workflow: Windows Settings Manager Portable CI
- Run: `34778323587`
- Job: `103780511173`
- Result: PASS
- Locked dependency install: PASS
- Strict TypeScript build / Lite + Pro assembly: PASS
- Policy suite: PASS, 40/40 tests
- Official Elgato CLI validation: PASS for Lite and Pro
- Production dependency audit: PASS, 0 vulnerabilities
- Official Lite + Pro packaging: PASS
- Lite + Pro deterministic Rat Art: PASS
- Marketplace media dimension verification: PASS
- Uploaded release-evidence artifact: `10323859244`
- Artifact digest: `sha256:20f4109405217d34476ae67408f5653bbfa7b2a354e194273e03041b3bf277d1`

### Repository / commercial release gates

All relevant repository-level gates also pass on `af2e7d4e8f0ff68a1c0dbe196cf92321dace0725`:

- Lite Pro Portfolio Audit: PASS
  - Run: `34778323618`
  - Job: `103780511203`
- Rat Ship Marketplace Routing CI: PASS
  - Run: `34778323793`
  - Job: `103780511827`
- RatPack Lightweight CI: PASS
  - Run: `34778323662`
  - Job: `103780511205`
  - canonical context: PASS
  - JSON validation: PASS
  - plugin release metadata: PASS
  - Maker Console runtime patch: PASS
  - local PowerShell syntax: PASS
  - Rat Dev / Rat Audit lifecycle checks: PASS

The separate PackRat self-hosted Windows gate remains optional additional confidence. It is not required to establish an executable Windows backend signal because the hosted Windows gate above successfully compiled and exercised the backend on Windows build 26100.

## Remaining validation boundary

Automated build, test, native Windows smoke, official Elgato validation/package, dependency audit, bundled-profile structural checks, and deterministic Marketplace media generation are complete.

The release remains blocked only on the physical QA boundary: real HDR-capable/unsupported/multi-monitor hardware, laptop AC/battery behavior, sleep/resume/reboot, outside-Windows changes, physical Stream Deck profile install/page navigation, and final human Marketplace media review. Lite also remains commercially blocked until Pro is published and the verified direct Lite/Pro Marketplace URLs/IDs pass the strict routing audit.
