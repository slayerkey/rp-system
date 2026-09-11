# PackRat Clipboard Shelf Bridge

Small Windows-only localhost companion for the paid Clipboard Shelf XENEON Edge widget.

## Why it exists

Continuous clipboard history cannot be implemented reliably by assuming a local file-origin widget can continuously call the browser Async Clipboard API. The bridge owns native Windows text clipboard monitoring and exposes only the narrow state/actions the XENEON widget needs.

## Runtime

- native WM_CLIPBOARDUPDATE monitoring
- Unicode text only
- loopback Kestrel endpoint on 127.0.0.1:17485
- WebSocket path /ws
- sanitized health path /health
- fixed application WebSocket subprotocol required
- no cloud, account, telemetry, or PackRat server
- no clipboard text in console/request logs
- local state encrypted for the current Windows user with DPAPI
- Private Mode pauses capture
- tray controls for Private Mode, Clear History, and Exit

The health endpoint reports only bridge version, readiness, entry count, history limit, and Private Mode state. It never returns clipboard contents.

## Development

Self-test without touching the real clipboard:

```powershell
dotnet run --project companions/clipboard-shelf/ClipboardShelfBridge.csproj -- --self-test
```

Publish one Windows x64 executable:

```powershell
dotnet publish companions/clipboard-shelf/ClipboardShelfBridge.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

The engineering release artifact is produced by the Clipboard Shelf GitHub workflow and copied into the Rat Ship kit under companion/.
