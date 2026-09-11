# Smart Lighting Control for Hue & Govee — Plan

## Customer job

Control Philips Hue and Govee lights from XENEON Edge without requiring Home Assistant.

This product stays separate from Home Assistant Panel. Home Assistant Panel is for users who already run Home Assistant; this product owns discovery, pairing, capability normalization and lighting controls directly.

## Architecture decision

The shipping XENEON widget is a touch UI only. It never stores Philips Hue application credentials or a Govee API key.

A small Windows-only PackRat Lighting Companion binds only to 127.0.0.1 and exposes an authenticated localhost WebSocket to the widget.

Reasons:
- imported iCUE widgets run from file://
- Philips Hue local control requires readable local bridge HTTP(S) responses and local pairing
- Govee LAN control requires UDP multicast/unicast, which browser widgets cannot perform
- keeping credentials in the companion avoids putting secrets in widget source or repository fixtures

The widget receives normalized device/group/scene state and sends normalized control commands. A random local pairing token is required before the WebSocket sends state or accepts controls.

## Philips Hue

Local-first and cloud-free:
1. discover Hue Bridges on the LAN with mDNS, with manual bridge IP as a fallback
2. pair after the user presses the physical Hue Bridge link button
3. store the generated local Hue application key in Windows Credential Manager
4. use the Hue local API v2 for lights, rooms/zones, scenes and current state
5. controls: on/off, brightness, XY color, color temperature when exposed, scene recall

No PackRat cloud and no Hue account credentials.

## Govee

Local-first:
1. discover LAN-Control-capable Govee devices over the local Govee LAN Control UDP transport, with manual IPv4 fallback when multicast discovery is blocked
2. use LAN commands for on/off, brightness, RGB color and current status when supported
3. optionally accept a user-provided Govee Developer API key in the local companion for cloud-only capability discovery, color-temperature bounds, devices that do not expose LAN control, current state, and scenes
4. store the API key in Windows Credential Manager

The Govee cloud key is optional. LAN-only users can still control discovered LAN devices. Govee scenes require the Developer API because the LAN control protocol does not expose scene enumeration/recall.

## Product UX

- setup/offline screen points to the local companion setup page and asks for the companion pairing token
- provider filter: Favorites / All / Hue / Govee
- target cards show source, name, type, current on/off state and brightness
- Hue rooms/zones are first-class targets
- Govee groups are not invented when the API does not provide them
- selecting a light or room opens touch controls
- large power control, brightness slider, touch color pad, temperature slider when supported, scene chips
- favorites stored by the companion and synchronized to the widget
- capability-based UI: unavailable controls are hidden, not faked
- explicit states for companion offline, wrong token, no providers, provider offline and no devices

## Security

- loopback bind only
- reject non-loopback clients
- setup HTTP endpoints only accept same-origin localhost requests
- widget WebSocket accepts only file/null origin and requires a random companion pairing token
- no secrets in widget settings except the local companion pairing token
- Hue application key and optional Govee API key live in Windows Credential Manager
- no secrets in fixtures, screenshots, logs or CI

## QA / release gate

- deterministic fixture states for Hue-only, Govee-only, mixed, empty, disconnected and provider-error states
- all eight XENEON compositions
- touch-target / clipping / overflow / runtime assertions
- companion self-tests for normalization and command payloads
- packaged file:// widget -> real fixture companion localhost integration test
- official CORSAIR validate/package
- exact package integrity/extraction
- native iCUE style regression
- Corsair Labs Windows runner
- StreamSpell all eight presets
- deterministic Rat Art
- companion publish excludes source-revision metadata, and the immutable release gate requires the exact same v1.0.0 ZIP hash across unrelated commits
- Rat Ship SHIP_KIT plus Windows companion artifact

## Marketplace naming

Final marketplace name: **Smart Lighting Control for Hue & Govee**.

Use Philips Hue and Govee in descriptive compatibility copy and search terms. Do not use vendor logos or imply endorsement.