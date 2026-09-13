# Macro Recorder Pro

Paid Windows Stream Deck macro recorder built around:

**RECORD -> DO IT -> STOP -> REPLAY**

Pro records keyboard and mouse input, stores reusable local macros, supports timeline editing, speed control and loop modes.

## Privacy

All macro contents stay local. There is no PackRat network upload path in the recorder or playback engine.

Do not deliberately record passwords. Windows secure-desktop input is outside the normal hook desktop, but ordinary application password fields cannot be identified reliably.

## Emergency stop

- Add the bundled **Stop Recording / Playback** action to the deck.
- **Ctrl + Shift + F12** is an emergency playback stop and is only intercepted while playback is active.

## Limits

- 10 minutes per recording
- 25,000 events
- keyboard + mouse
- 0.25x to 4x playback
- repeat count / while-held / toggle repeat

## Included profiles

Editable starter profiles are generated for standard/MK.2, Mini, XL, Plus, and Neo.

## Build

`npm run build` automatically publishes the exact current Windows input helper when its source hash changes, so no manual helper pre-build is required.

```powershell
cd plugins/macro-recorder-pro
npm ci
npm test
npm run build
npm run validate
npm run pack
```

Family release QA:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1
```
