# Windows Settings Manager Lite + Pro Plan

## Decision

GO, provided the product is built around saved PC Modes rather than a collection of unrelated Windows commands.

## Market boundary

Existing products already cover broad Windows utilities, hotkeys, display settings, and many one-off controls. PackRat does not compete by counting actions.

The customer job is:

> Change my PC into the mode I need with one key.

Lite proves the underlying individual controls. Pro adds the orchestration layer.

## Supported v1 controls

- HDR: live state plus On / Off / Toggle. PackRat feature-detects the HDR-specific Advanced Color Info 2 / HDR State device-info path introduced with Windows 11 24H2 and reads the actual active color mode when available. If Windows rejects that packet, the plugin falls back to the legacy Advanced Color path with readback and explicitly rejects the SDR WCG/automatic-color-management state via wideColorEnforced instead of treating it as HDR.
- Power Plan: live active plan, cycle, or select an exact installed plan.
- Display Topology: live Internal / Clone / Extend / External state plus control through SetDisplayConfig.
- Screen & Sleep: live timeouts plus configurable exact values; the default key cycles only the screen timeout.
- Keep Awake: plugin-owned idle sleep/display prevention through SetThreadExecutionState. It is cleared when the backend exits.
- Lock PC: LockWorkStation.
- System Status: read-only live summary.

## Intentionally excluded from v1

- Night Light: no stable general control API accepted for this release.
- Do Not Disturb / notifications: no supported arbitrary system toggle accepted for this release.
- Bluetooth and Wi-Fi: radio state changes can require user-consent flows and policy/hardware support. Do not disguise permission failures as reliable toggles.
- Global light/dark theme: no supported global control path accepted for this release.
- Audio routing or app volume: belongs to PackRat Audio Manager rather than this product.

No coordinate clicking, SendKeys, Quick Settings automation, or undocumented CloudStore writes are allowed.

## Lite / Pro

Lite:
- System Status
- HDR
- Power Plan
- Display Topology
- Screen & Sleep
- Keep Awake
- Lock PC
- one starter profile for Standard, Mini, XL, Plus, Neo, Galleon 100 SD, and Stream Deck + XL

Pro:
- all Lite controls
- Apply PC Mode
- Cycle PC Mode
- Current PC Mode
- Save Current Mode
- five editable default mode slots: GAMING, WORK, NIGHT, PRESENT, MOVIE
- two-page ready-made mode/settings profiles where device capacity permits

The five mode slots start empty. PackRat never silently decides what a gaming or work optimization should be. Only fields the user saves or configures are changed.

## Transaction semantics

A mode applies configured fields in this order:
1. display topology
2. HDR
3. power plan
4. screen/sleep timeout
5. Keep Awake

Every operation verifies the resulting Windows state.

- COMPLETE: every configured step confirmed.
- PARTIAL: at least one configured step confirmed and at least one failed.
- FAILED: no configured step confirmed, or the mode contains no settings.

Rollback is not included in v1 because display/HDR rollback can itself fail after a topology or hardware change. A misleading rollback promise is worse than an explicit PARTIAL result.

## External state detection

The plugin polls a fresh Windows snapshot every 2.5 seconds and after every write. Current Mode is derived from live state, not from the last PackRat command.


## Stream Deck compatibility floor

The plugin requires Stream Deck 7.3 or later. This deliberately trades older app compatibility for the current profile-device matrix and the profile-switching fixes shipped with the 7.3 generation. Bundled profiles cover Standard, Mini, XL, Stream Deck +, Neo, Galleon 100 SD, and Stream Deck + XL. Stream Deck Studio is not included because it does not use standard Stream Deck app profiles.
