# Macro Recorder Lite

Free Windows Stream Deck macro recorder built around:

**RECORD -> DO IT -> STOP -> REPLAY**

Lite records short keyboard workflows and stores one macro on each configured Replay Macro action.

## Privacy

All macro contents stay local. There is no PackRat network upload path in the recorder or playback engine.

Do not deliberately record passwords. Windows secure-desktop input is outside the normal hook desktop, but ordinary application password fields cannot be identified reliably.

## Emergency stop

- Add the bundled **Stop Recording / Playback** action to the deck.
- **Ctrl + Shift + F12** is an emergency playback stop and is only intercepted while playback is active.

## Limits

- 30 seconds per recording
- 60 keyboard events
- keyboard only

## Included profiles

Editable starter profiles are generated for standard/MK.2, Mini, XL, Plus, and Neo.

## Build

`npm run build` automatically publishes the exact current Windows input helper when its source hash changes, so no manual helper pre-build is required.

```powershell
cd plugins/macro-recorder-lite
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
