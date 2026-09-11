# PackRat Audio Bridge

Local Windows companion for **Audio Control Center** on CORSAIR XENEON Edge.

## Architecture

`Audio Control Center -> ws://127.0.0.1:17484/ws -> PackRat Audio Bridge -> Windows Core Audio`

Public Windows Core Audio MMDevice and EndpointVolume APIs provide:

- active output and input endpoint enumeration
- friendly endpoint names
- current Windows default output and input discovery
- endpoint master volume
- endpoint mute

Windows does not expose a documented public setter for the global default endpoint. Default switching is therefore isolated behind a runtime-probed Windows `IPolicyConfig` policy interface. If that capability cannot be activated or Windows rejects a switch, the bridge fails closed for switching while volume and mute remain independent.

The bridge does not bundle a third-party audio-switcher executable.

## Local-only contract

The server binds explicitly to `127.0.0.1:17484`.

It rejects non-loopback clients and permits only local/file origins used by iCUE and the deterministic PackRat test harness.

There is:

- no PackRat cloud service
- no account
- no telemetry
- no analytics
- no credential or token storage
- no shell / PowerShell execution

## Commands

- `refresh`
- `set-default-output`
- `set-default-input`
- `set-output-volume`
- `set-input-volume`
- `set-output-mute`
- `set-input-mute`

## Build

```powershell
dotnet run --project src/PackRat.AudioBridge/PackRat.AudioBridge.csproj -c Release -- --self-test
dotnet publish src/PackRat.AudioBridge/PackRat.AudioBridge.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

## Protocol and compatibility

The local contract is versioned independently from the Marketplace widget.

- current bridge version: `1.0.0`
- current protocol: `1`
- `/health` reports the bridge version, protocol, port and current capabilities
- every snapshot includes the protocol and bridge version
- Audio Control Center rejects an incompatible protocol with an explicit update-required state instead of sending commands blindly
- bridge restart/loss is recoverable; the widget reconnects automatically without accumulating duplicate sockets

## Install and download

Customer download:

https://github.com/slayerkey/rp-system/releases/download/audio-control-center-bridge-v1.0.0/PackRat-Audio-Bridge-1.0.0-win-x64.zip

The release gate publishes `PackRat-Audio-Bridge-1.0.0-win-x64.zip` from the same self-contained `PackRat.AudioBridge.exe` exercised by the integration test.

Recommended setup:

1. Extract the ZIP.
2. Run `INSTALL_STARTUP.cmd`.
3. Audio Control Center reconnects automatically.

The installer is per-user only. It copies the bridge to `%LOCALAPPDATA%\PackRat\AudioBridge`, places its removable uninstaller at `%LOCALAPPDATA%\PackRat\UNINSTALL_AUDIO_BRIDGE.cmd`, and creates a user Startup entry. It does not require administrator access and does not install a Windows service.

`START_AUDIO_BRIDGE.cmd` is the portable/manual option. `UNINSTALL_STARTUP.cmd` removes the Startup entry and installed copy.

The bundle also contains setup/security documentation and a SHA-256 checksum. Customers do not need to build the bridge themselves.
