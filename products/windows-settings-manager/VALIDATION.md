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

Canonical automated gates pass on implementation/artifact commit `8cf4b0ac38d7383fbc1ecb98a60878a0f20d1939`. Commits after that point only update validation/catalog evidence and do not change plugin runtime, profile generation, Marketplace art, packaging, or shipping behavior.

### Hosted Windows evidence

- Workflow: Windows Settings Manager CI
- Run: `34785418162`
- Job: `103799897210`
- Result: PASS
- Locked dependency install: PASS
- Strict TypeScript build / Lite + Pro assembly: PASS
- Policy suite: PASS
- Native Windows backend smoke: PASS
- Official Elgato CLI validation: PASS for Lite and Pro
- Production dependency audit: PASS, 0 vulnerabilities
- Official Lite package: PASS
- Official Pro package: PASS
- Uploaded package artifact: `10325769771`
- Artifact digest: `sha256:4db9c02a66c1c3dd40f8c3bf5c8b98e2e2b2322c45ae5781365936890e86480a`

The backend smoke executes under Windows and covers embedded C# compilation, JSON transport, ping, snapshot, Windows build/HDR API selection, power-plan read, and Keep Awake on/off.

### Portable release evidence

- Workflow: Windows Settings Manager Portable CI
- Run: `34785418201`
- Job: `103799896918`
- Result: PASS
- Locked dependency install: PASS
- Strict TypeScript build / Lite + Pro assembly: PASS
- Policy suite: PASS
- Official Elgato CLI validation: PASS for Lite and Pro
- Production dependency audit: PASS, 0 vulnerabilities
- Official Lite + Pro packaging: PASS
- Lite + Pro deterministic Rat Art: PASS
- Marketplace media dimension verification: PASS
- Uploaded release-evidence artifact: `10326347964`
- Artifact digest: `sha256:b39fa27e0d92877d1a63a7181c6c1a7f4352ea6b2ed0cf1c46d05f74c600d7f8`

### Human Marketplace media review

PASS on the current portable artifact.

- Lite icon, cover, and four gallery images reviewed.
- Pro icon, cover, and four gallery images reviewed.
- An earlier Pro cover exposed a real clipped third key row.
- The cover renderer was changed to fit the key grid inside explicit safe bounds and fail closed if geometry exceeds them.
- The regenerated current-head Pro cover was reopened at full 1920x960 resolution and visually confirmed with all three rows fully inside frame.
- Current Lite/Pro galleries are readable, internally consistent, and free of visible clipping.

### Repository / commercial release gates

All relevant repository-level gates also pass on `8cf4b0ac38d7383fbc1ecb98a60878a0f20d1939`:

- Lite Pro Portfolio Audit: PASS
  - Run: `34785417411`
  - Job: `103799893940`
- Rat Ship Marketplace Routing CI: PASS
  - Run: `34785417400`
  - Job: `103799893701`
- RatPack Lightweight CI: PASS
  - Run: `34785417398`
  - Job: `103799893665`

The separate PackRat self-hosted Windows gate remains optional additional confidence. It is not required to establish an executable Windows backend signal because the hosted Windows gate successfully compiles and exercises the backend.

## Remaining validation boundary

Automated build, test, native Windows smoke, official Elgato validation/package, dependency audit, bundled-profile structural checks, and deterministic Marketplace media generation are complete.

The release remains blocked only on the physical QA boundary: real HDR-capable/unsupported/multi-monitor hardware, laptop AC/battery behavior, sleep/resume/reboot, outside-Windows changes, and physical Stream Deck profile install/page navigation. Lite also remains commercially blocked until Pro is published and the verified direct Lite/Pro Marketplace URLs/IDs pass the strict routing audit.
