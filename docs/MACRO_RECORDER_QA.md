# Macro Recorder Family QA

Date: 2026-09-13

## Automated synchronized release evidence

The Macro Recorder family passed both release jobs on the current-main-synchronized product branch on 2026-09-13:

- workflow run: `34777832830`
- tested head: `b91ed6e14e5b90ed97af2bed69b0dc0c39a7860f`
- source-contract job: **PASS**
- Windows release job: **PASS**
- current-main plugin release metadata preflight: **PASS**
- Lite tests: **19/19 passed**
- Pro tests: **37/37 passed**
- both production dependency audits: **PASS**
- native `PackRat.InputHost` win-x64 build + self-test + daemon ping: **PASS**
- native source hash prefix: `4d76365103b5`
- both official Elgato validations and packages: **PASS**
- five bundled profiles per edition (standard/MK.2, Mini, XL, Plus, Neo): **PASS**
- exact-package helper / Property Inspector / runtime notices / profile teardown: **PASS**
- deterministic source media + six-file Rat Ship media adapters: **PASS**
- Lite package SHA-256: `75F8ABD1829E72866B98D5FDC22DC9B5F65E1EBE5283D312D8F2A333C3D63965`
- Pro package SHA-256: `29DE0D65292ED42785BA5BB5EDEDD9577B2B07E2694B0DA997F6318FFF429051`
- release-evidence artifact: `10323523216`
- artifact digest: `sha256:350e2ff485add52a6591be0cf86ac14ef3755d65adc0bcc234647acbf864adf1`

The product branch was synchronized with current `main` before this run, so this evidence includes the current Rat Ship release-state guard and plugin release metadata preflight.

The family remains **TESTING** only because low-level input behavior still needs the real Windows / physical Stream Deck acceptance matrix in `docs/MACRO_RECORDER_NATIVE_GATE.json`. Lite also cannot launch publicly until the real Macro Recorder Pro Marketplace URL exists and is injected through the canonical Lite-to-Pro catalog.

## Final release-candidate command

After the native gate is truthfully marked ready and the native smoke matrix has passed:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1 -ReleaseCandidate
```

This mode refuses release-candidate status while any native gate remains false.
