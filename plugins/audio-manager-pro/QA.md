# Audio Manager Pro QA

Product: Audio Manager Pro  
Slug: audio-manager-pro  
Branch: product/audio-manager-pro  
Version: 1.0.0.0  
Price: $9.99

## Current release state

Status: **TESTING**

The product implementation is complete enough for release-candidate testing, but it is **not READY_TO_SHIP** yet.

Current external blocker:

- GitHub Actions jobs are presently failing before runner allocation. The failed jobs report no executed steps (`steps = null`), so the corrected branch head has not yet completed the official Elgato validate/package gate.

Still required before READY_TO_SHIP:

- current-head locked dependency install/audit
- current-head automated fixture suite
- current-head shared AudioCore + XENEON regression build
- current-head bundled Windows helper build/self-test
- official Elgato CLI validation
- official `.streamDeckPlugin` packaging
- final physical Windows audio-device smoke
- physical Stream Deck + dial smoke
- real-hardware Marketplace demonstration video, if required by the live Maker Console/review flow

## Automated evidence already obtained

A prior Windows product run, GitHub Actions run **34739703004**, executed successfully through these gates before later catching a plugin syntax defect:

- checkout/setup
- shared `PackRat.AudioCore` .NET build
- regression build of the existing XENEON `PackRat.AudioBridge`
- locked npm install
- high-severity npm audit
- profile/device fixture tests
- win-x64 helper publish
- helper executable self-test returning `SUCCESS`

That run then caught a syntax error in the new Stream Deck + dial path during bundle build. The defect was fixed in commit `cd084c68e1bc8527322a27cc256ac3672144bd5f`.

After that fix, subsequent Windows and temporary Ubuntu workflow attempts began failing before any runner step started. This is treated as infrastructure evidence, not as a product pass.

## Off-runner implementation checks

The corrected source received an additional implementation-session preflight:

- current plugin source parses successfully
- current Property Inspector source parses successfully
- current profile logic source parses successfully
- current tests parse successfully
- the exact current pure source/test files were materialized from GitHub and executed with Node's built-in test runner after the final logic hardening: **37 tests passed, 0 failed**
- current branch pure logic executes successfully for settings normalization, role capture, endpoint recreation, safe rebinding, missing-device handling, Console/Multimedia drift detection, contradictory-state suppression, cycle recovery, exact-capture preflight, post-operation verification, backend-offline truthfulness, fail-closed status, Unicode rendering, and role-aware key labels
- Rat Art V2 Python source compiles
- Rat Art V2 renderer was exercised off-runner through all six required Marketplace outputs at the expected dimensions; exact canonical-logo release rendering still belongs to the official release gate
- Rat Art V2 generates the required 480×240, 320×160, and 240×120 thumbnail review sheet
- Marketplace cover/gallery outputs are distinct

The branch has also been merged forward to current `main` so its canonical Rat Art / Marketplace V2 standards are no longer stale.

The Windows CI definition now performs both the helper executable self-test and a real JSON `snapshot` request through the helper stdin/stdout protocol, then verifies that the packaged `.streamDeckPlugin` actually contains the native helper.

These checks do not replace the official Elgato CLI or physical Windows hardware gate.

## Device resilience contract

Automatic matching order:

1. exact active endpoint ID
2. unique Windows Device Instance ID
3. unique hardware Container ID + exact normalized friendly name
4. otherwise stop and require explicit rebind

A friendly-name-only match is intentionally insufficient. Ambiguous or missing devices must never silently apply to another endpoint.

## Audio Profile result contract

Every profile application returns:

- **SUCCESS** when every requested operation succeeds
- **PARTIAL** when at least one requested operation succeeds and at least one requested operation fails or cannot be safely resolved
- **FAILED** when no requested operation succeeds

The Audio Profile Status action is read-only. It refreshes current Windows audio state and reports whether the selected profile matches; it does not apply the profile.

If a profile requests saved volume or mute state and Windows cannot read that state, the profile does not count as active.

The user-facing Default role represents both Windows Console and Multimedia. A profile does not count as ACTIVE if either underlying role has drifted to a different endpoint.

If two roles target the same endpoint with contradictory saved volume or mute values, the conflicting state operation is omitted and surfaced as a profile failure rather than choosing one value.

## Rat Art V2 contract

The current deterministic renderer:

- uses the canonical repository PackRat mark
- has no silent bitmap-font fallback
- keeps the product/key cluster dominant
- uses restrained V2 hero chrome
- generates a thumbnail review sheet
- keeps the six-file Rat Ship Marketplace contract
- uses the listing sequence: hero → four-role value proof → saved-state proof → device resilience → Stream Deck + dial

## Physical hardware boundary

Final physical QA must cover:

- USB headset
- speakers
- two microphones
- Bluetooth device
- disconnect/reconnect
- Windows reboot
- real endpoint identity changes
- Default vs Communications role separation
- Console/Multimedia drift: move Multimedia away from the saved Default endpoint and confirm Status becomes INACTIVE
- profile containing a missing device
- rapid profile switching
- partially failed profile
- mute/volume restore
- Stream Deck restart
- long/Unicode device names
- Stream Deck + dial

Use `REAL_WINDOWS_SMOKE.md` as the canonical checklist. After it passes, record the real-hardware evidence in `DEMO_VIDEO.md` before Marketplace submission when the live review flow requires a demonstration video.
