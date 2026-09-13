# Macro Recorder Pro

Paid Windows Stream Deck macro recorder built around the workflow:

**RECORD -> DO IT -> STOP -> REPLAY**

Pro records keyboard and mouse input, stores reusable local macros, supports timeline editing, speed control and loop modes.

## Privacy

All macro contents stay local. There is no PackRat network upload path in the recorder or playback engine.

Do not deliberately record passwords. Windows secure-desktop input is outside the normal hook desktop, but ordinary application password fields cannot be identified reliably.

## Emergency stop

- Add the bundled **Stop Recording / Playback** action to the deck.
- **Ctrl + Shift + F12** is a helper-level emergency playback stop.

## Limits

- 10 minutes per recording
- 25,000 events
- 0.25x to 4x playback
- repeat count / while-held / toggle repeat

## Build

The plugin expects the shared Windows input host to be published first:

```powershell
dotnet publish shared/windows-input/PackRat.InputHost/PackRat.InputHost.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o artifacts/input-host
cd plugins/macro-recorder-pro
npm ci
npm test
npm run build
npm run validate
npm run pack
```
