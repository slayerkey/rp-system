# PackRat Window Bridge

Local Windows companion for **Window Manager for XENEON**.

## Why it exists

A normal CORSAIR iCUE/XENEON web widget cannot enumerate arbitrary native Windows windows or call Win32 focus/placement APIs. Window Manager therefore keeps the XENEON surface as UI only and delegates the minimum native desktop operations to this local companion.

## Architecture

`XENEON widget -> ws://127.0.0.1:17487/widget -> PackRat Window Bridge -> Win32`

The bridge provides:

- top-level visible application windows
- app/process name and useful window title
- locally extracted app icon when accessible
- foreground/active state
- detected monitor/work-area state
- focus
- minimize
- maximize/restore
- snap left/right
- move to any detected monitor
- close via WM_CLOSE

The XENEON widget owns the safe-close confirmation and pinned-app UI.

## Update model

The production backend uses Windows `SetWinEventHook` notifications on a dedicated message-loop thread. Native changes are debounced for 150 ms and pushed to connected widgets. A five-second reconciliation pass catches missed events.

The widget does not enumerate the desktop and does not continuously poll Windows.

## Security boundary

- binds only to `127.0.0.1:17487`
- only local/file origins are accepted
- first WebSocket message must contain protocol version and the random local pairing key
- pairing comparison is constant-time after SHA-256 normalization
- commands are restricted to windows and monitors present in the bridge's current normalized snapshot
- no shell, PowerShell, DLL injection, remote API, PackRat cloud, telemetry or analytics
- window titles, process paths/names, icons and commands stay on the PC
- pairing key is generated locally in `%LOCALAPPDATA%\PackRat\WindowBridge\bridge-key.txt`

## Install

The release ZIP includes `Install.cmd`, `Install.ps1`, the self-contained executable and `Uninstall.ps1`.

Running `Install.cmd`:

1. copies the bridge to `%LOCALAPPDATA%\PackRat\WindowBridge`
2. creates a per-user Startup shortcut
3. launches the bridge and its localhost pairing page

No administrator rights are required.

## Known real-Windows boundary

Windows may refuse `SetForegroundWindow` when foreground-lock rules apply. A non-elevated bridge also cannot guarantee control of elevated/admin windows. These cases return an explicit action error instead of pretending the focus succeeded.
