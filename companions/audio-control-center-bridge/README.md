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
