# Calendar Sync Pro

Calendar Sync Pro is a standalone Stream Deck product. It is not a required companion for the XENEON Calendar Panel.

## Recovered source of truth

The exact most recent package supplied on 2026-09-15 is `1.1.1.0` with SHA-256:

`5b11556b64f8c125c6d866d589de07731bd1979276c4b9983b576d208e7941c1`

That hash exactly matches the v1.1.1.0 package previously recorded during the 2026-09-10 recovery, confirming the supplied file is the same recovered build. The package did still contain the abandoned localhost Calendar Panel bridge experiment, so the bridge must not be carried forward.

## 1.2.0.0 candidate

The recovered package was updated to `1.2.0.0` with:

- all-day handling: **Timed meetings first**, **Ignore all-day events**, or **Include normally**;
- Next Meeting and Join Meeting skipping all-day events unless `Include normally` is selected;
- Stream Deck+ Agenda putting timed meetings before all-day items while keeping all-day items scrollable in the default mode;
- optional warning flash: **Off**, **Red only**, or **Amber + red**;
- the abandoned Calendar Panel localhost bridge removed.

Candidate artifact:

`artifacts/com.packrat.calendarsyncpro-v1.2.0.0.streamDeckPlugin`

SHA-256:

`61b5fa8d58044aad5caf3542f19911b3acec89d35b6de5e75d684b3cc1c8bfd1`

Automated package regression is in `tests/test_calendar_pro_1_2.py`, with CI in `.github/workflows/calendar-sync-pro-ci.yml`. See `TEST_REPORT_1.2.0.0.md` for the verification scope and physical Stream Deck+ smoke-test note.
