# Calendar Sync Pro 1.2.0.0 — regression report

Base package supplied on 2026-09-15:

- Version: `1.1.1.0`
- SHA-256: `5b11556b64f8c125c6d866d589de07731bd1979276c4b9983b576d208e7941c1`
- This matches the exact v1.1.1.0 recovery hash already recorded in `docs/CALENDAR_PACKAGE_RECOVERY_2026-09-10.md`.

Candidate package:

- Version: `1.2.0.0`
- SHA-256: `61b5fa8d58044aad5caf3542f19911b3acec89d35b6de5e75d684b3cc1c8bfd1`

## Changes verified

- Removed the abandoned Calendar Panel localhost bridge from the supplied v1.1.1.0 package.
- Added all-day handling modes: `Timed meetings first`, `Ignore all-day events`, and `Include normally`.
- Default behavior is `Timed meetings first` when the setting is absent.
- Next Meeting and Join Meeting skip all-day events in `Timed meetings first` and `Ignore all-day events` modes.
- Agenda / Stream Deck+ keeps all-day events scrollable in `Timed meetings first`, but moves them behind timed events so the dial opens on the next useful countdown.
- `Ignore all-day events` removes all-day items from Agenda too.
- Added warning flash modes: `Off`, `Red only`, and `Amber + red`.
- Flashing uses the plugin's existing one-second repaint ticker instead of adding a second high-frequency timer.

## Automated checks

`plugins/calendar-pro/tests/test_calendar_pro_1_2.py` tests the packaged `.streamDeckPlugin` itself:

- exact artifact SHA-256;
- ZIP integrity;
- manifest UUID, version, and action UUIDs;
- presence of the new property-inspector settings;
- absence of the abandoned bridge;
- JavaScript syntax for packaged `plugin.js` and `pi.js` using Node 20;
- behavior of the exact embedded helper functions for all three all-day modes and both flash modes.

Local result before upload: **PASS**.

Hardware note: automated tests cannot prove the final visual cadence on a physical Stream Deck+ display. Install the candidate on a Stream Deck+ and do one visual smoke test before Marketplace submission: one all-day event plus one timed event, then temporarily set warning thresholds high enough to observe amber/red flashing.
