# Audio Manager Pro — Product and Architecture Plan

Decision: **BUILD**

Price: **$9.99**  
Platform: **Elgato Stream Deck / Windows**

## Customer job

**Switch your entire audio setup with one key.**

The product is built around user-created Audio Profiles such as:

- HEADSET
- SPEAKERS
- MEETING
- STREAMING
- VR

An Audio Profile can change Windows Default output, Communications output, Default input, Communications input, and optionally restore saved endpoint volume and mute state.

## Competitor comparison

### Elgato Volume Controller

Volume Controller is already a strong free solution for individual application/device volume control and Stream Deck + volume workflows.

Audio Manager Pro does **not** compete on per-app volume as its headline.

Different customer job:

- Volume Controller: "control the volume of this app/device"
- Audio Manager Pro: "change my whole Windows audio configuration to this saved setup"

That distinction is the commercial reason this product exists.

### Audio Switcher

Audio Switcher already handles straightforward input/output device switching.

Audio Manager Pro goes further by treating the setup as one state:

- Default output
- Communications output
- Default input
- Communications input
- optional endpoint volume
- optional endpoint mute

The profile is the product, not the individual switch action.

### Current Marketplace audio utilities

The Audio category is active and not empty. Current Marketplace products include Elgato Volume Controller, Audio Switcher, Wave Link integrations, and newer audio-control utilities.

PackRat should not claim generic audio control is underserved. The narrower opportunity is complete Windows audio-state presets.

## Wave Link boundary

Wave Link-specific control remains with Elgato's supported Wave Link surfaces.

Audio Manager Pro does not use private Wave Link internals and does not fake unsupported routing.

Where a Wave Link setup follows Windows Default Output, a Windows Audio Profile can naturally change the Windows side of that setup. Wave-specific submix/channel routing is outside v1 unless Elgato exposes a supported public API for it.

## Architecture decision

Chosen architecture: **shared PackRat Windows audio core + thin product hosts**.

Shared implementation:

`companions/packrat-audio-core/src/PackRat.AudioCore/`

Consumers:

- XENEON Audio Control Center bridge
- Audio Manager Pro bundled Windows helper

Why:

1. PackRat already had working MMDevice/Core Audio code.
2. Reimplementing Core Audio independently inside Node would create two Windows-audio stacks.
3. A bundled local helper keeps the Stream Deck application layer simple while preserving the proven C# Core Audio implementation.
4. Shared role/device fixes benefit both products.
5. The Stream Deck package remains self-contained for the customer.

The existing XENEON bridge remains a thin adapter and preserves its original behavior of moving Windows roles together.

Audio Manager Pro exposes Default and Communications roles separately.

## Device resilience decision

Do not trust one opaque endpoint ID forever.

Saved device identity includes, where Windows exposes it:

- endpoint ID
- friendly name
- Device Instance ID
- hardware Container ID

Automatic resolution order:

1. exact active endpoint ID
2. unique Device Instance ID
3. unique Container ID + normalized friendly name
4. stop and require explicit rebind

A friendly-name-only match is not sufficient for automatic rebinding.

## Apply result contract

Every Audio Profile application resolves to:

- **SUCCESS** — every requested operation succeeded
- **PARTIAL** — at least one operation succeeded and at least one failed or could not be resolved safely
- **FAILED** — no requested operation succeeded

Missing devices are visible and never silently replaced by another endpoint.

## v1 action set

1. Apply Audio Profile
2. Set Output Device
3. Set Input Device
4. Cycle Audio Profile
5. Audio Profile Status
6. Mute Default Mic
7. Profile Output Volume for Stream Deck +

The Status action is read-only. Pressing it refreshes and checks the selected profile; it does not mutate Windows audio state.

## Explicitly out of scope for v1

- per-application volume as a headline feature
- unsupported/private Wave Link routing
- friendly-name-only silent rebinding
- cloud account or service
- a second independent Windows Core Audio implementation
