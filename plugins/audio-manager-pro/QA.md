# Audio Manager Pro QA

Product: Audio Manager Pro  
Slug: audio-manager-pro  
Branch: product/audio-manager-pro  
Version: 1.0.0.0  
Price: $9.99

## Automated release gate

Status: **PENDING CI**

The release workflow must pass all of the following before this file can be marked automated-pass:

- locked Node dependency install and high-severity dependency audit
- pure fixture tests for USB/headset, speakers, two microphones, Bluetooth-style endpoint recreation, Unicode names, missing devices, role separation, partial failure, and rapid repeated profile planning
- shared `PackRat.AudioCore` .NET build
- regression build of the existing XENEON `PackRat.AudioBridge` against that shared core
- Windows helper self-test
- real Windows helper snapshot process smoke on a GitHub-hosted Windows runner
- plugin bundle build
- official Elgato CLI validation
- official `.streamDeckPlugin` packaging
- deterministic Marketplace media render and dimension checks
- package-content checks proving the Windows helper is bundled

## Device resilience contract

Automatic matching order:

1. exact active endpoint ID
2. unique Windows device-instance ID
3. unique hardware container ID + exact normalized friendly name
4. otherwise stop and require explicit rebind

A friendly-name-only match is intentionally insufficient. Ambiguous or missing devices must never silently apply to another endpoint.

## Result contract

Every profile application returns:

- **SUCCESS** when every requested role/state operation succeeds
- **PARTIAL** when at least one requested operation succeeds and at least one requested operation fails or cannot be safely resolved
- **FAILED** when no requested operation succeeds

## Physical hardware boundary

Physical USB headset, speakers, two microphones, Bluetooth device, actual disconnect/reconnect, reboot, real endpoint recreation, and Stream Deck + dial operation cannot be honestly certified by GitHub Actions. The automated suite models those state transitions and the Windows runner executes the real Core Audio binary, but final physical-device smoke remains required before public submission.

Use the checklist in `REAL_WINDOWS_SMOKE.md`.
