# Monitor Manager Pro

Windows monitor and display control for Stream Deck.

## Product thesis

Control my whole monitor setup from Stream Deck.

Pro combines Windows display configuration with capability-aware monitor hardware control and saved Monitor Profiles. It is intentionally not another brightness-only plugin.

## Actions

- Monitor Brightness, Contrast, Volume
- Monitor Power
- Input Source
- Refresh Rate
- Resolution
- Windows HDR
- Display Mode: Extend, Duplicate, PC Screen Only, Second Screen Only
- Set Primary Display
- Orientation
- Save Monitor Profile
- Apply Monitor Profile
- Current Display Status

Stream Deck+ encoder actions are limited to brightness, contrast and volume. Discrete choices such as HDMI / DisplayPort / USB-C input remain key actions.

## Monitor Profiles

Profiles capture only state Windows or the current monitor can read safely. Application order is topology, Windows display state, HDR, then DDC/CI controls. Unsupported state is skipped and produces PARTIAL. A write failure produces FAILED and triggers best-effort rollback of the readable state captured immediately before application.

Saved-profile JSON is never silently overwritten if parsing or schema validation fails.

## DDC/CI policy

Monitor hardware varies. VCP codes are never assumed.

- 0x60 input source: only when advertised; requested value must be advertised.
- 0x62 monitor volume: only when advertised; current maximum is queried.
- 0xD6 monitor power: only when advertised; requested values must be advertised.
- Brightness / contrast use Windows high-level monitor configuration APIs.
- Laptop internal brightness uses the Windows WMI brightness path.

Capability UI reports SUPPORTED, NOT SUPPORTED or UNKNOWN.

## Known technical limits

- DDC/CI may be disabled in the monitor OSD, blocked by docks/KVMs/adapters, unavailable over some USB-C paths, or implemented incorrectly by monitor firmware.
- Two identical physical displays can still be ambiguous if Windows cannot expose a stable unique identity through the active display path.
- HDR depends on Windows advanced-color support on the active path.
- Windows may reject a mode/topology change because of GPU, driver, cable, scaling or bandwidth limits even when a nearby configuration works.
- Primary-display and topology changes require physical multi-monitor QA before Marketplace release.
- Night Light is not included in v1 because the build does not use undocumented toggles.

## Host QA

Run the canonical PackRat gates plus the real-host audit before Marketplace submission.
