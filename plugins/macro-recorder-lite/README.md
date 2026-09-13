# Macro Recorder Lite

Free Windows Stream Deck macro recorder built around the workflow:

**RECORD -> DO IT -> STOP -> REPLAY**

Lite records short keyboard workflows and stores one macro on each configured Replay Macro action.

## Privacy

All macro contents stay local. There is no PackRat network upload path in the recorder or playback engine.

Do not deliberately record passwords. Windows secure-desktop input is outside the normal hook desktop, but ordinary application password fields cannot be identified reliably.

## Emergency stop

- Add the bundled **Stop Recording / Playback** action to the deck.
- **Ctrl + Shift + F12** is a helper-level emergency playback stop.

## Limits

- 30 seconds per recording\n- 60 keyboard events\n- keyboard only

## Build

The plugin expects the shared Windows input host to be published first:

```powershell
dotnet publish shared/windows-input/PackRat.InputHost/PackRat.InputHost.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o artifacts/input-host
cd plugins/macro-recorder-lite
npm ci
npm test
npm run build
npm run validate
npm run pack
```
