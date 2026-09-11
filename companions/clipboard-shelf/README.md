# PackRat Clipboard Shelf Bridge

Small Windows-only localhost companion for the paid Clipboard Shelf XENEON Edge widget.

## Why it exists

Continuous clipboard history cannot be implemented reliably by assuming a local file-origin widget can continuously call the browser Async Clipboard API. The bridge owns native Windows text clipboard monitoring and exposes only the narrow state/actions the XENEON widget needs.

## Download

Stable release-candidate download:

`https://github.com/slayerkey/rp-system/releases/download/clipboard-shelf-bridge-v1.0.0/PackRat-Clipboard-Shelf-Bridge-1.0.0-win-x64.zip`

## Setup

1. Run `PackRat.ClipboardShelfBridge.exe` once.
2. The bridge copies itself to `%LOCALAPPDATA%\PackRat\ClipboardShelf\` and registers itself to start with the current Windows user.
3. Find the PackRat Clipboard Shelf Bridge tray icon and choose **Copy Pairing Code**.
4. In iCUE, open Clipboard Shelf settings and paste the code into **Bridge Pairing Code**.
5. The XENEON panel will connect automatically.

The pairing code is generated locally, stored inside the bridge's DPAPI-protected state, and never returned by `/health`. Copying the code from the tray is deliberately suppressed from clipboard history.

## Runtime

- native `WM_CLIPBOARDUPDATE` monitoring
- Unicode text only
- loopback Kestrel endpoint on `127.0.0.1:17485`
- WebSocket path `/ws`
- fixed application WebSocket subprotocol plus per-user pairing-code authentication
- exact localhost/file-origin validation
- sanitized `/health` path
- no cloud, account, telemetry, or PackRat server
- no clipboard text or pairing token in console/request logs
- local state encrypted for the current Windows user with DPAPI
- Private Mode pauses capture
- non-text clipboard changes clear the CURRENT marker instead of leaving stale state
- long clipboard values preserve the full local text while the XENEON transport uses a bounded preview
- tray controls for Private Mode, Copy Pairing Code, confirmed Clear History, and Exit

The health endpoint reports only bridge version, readiness, entry count, history limit, and Private Mode state. It never returns clipboard contents or the pairing code.

## Development

Self-test without touching the real clipboard:

```powershell
dotnet run --project companions/clipboard-shelf/ClipboardShelfBridge.csproj -- --self-test
```

Publish one Windows x64 executable:

```powershell
dotnet publish companions/clipboard-shelf/ClipboardShelfBridge.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

The engineering release artifact is produced by the Clipboard Shelf GitHub workflow and copied into the Rat Ship kit under `companion/`.
