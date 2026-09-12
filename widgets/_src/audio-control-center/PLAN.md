# Audio Control Center plan

## Customer job
Control Windows audio routing and endpoint volume from XENEON Edge without opening Windows Sound settings.

## API ceiling
The documented iCUE Widget API exposes Sensors, Media, Link, Stream Deck, FPS and Device Action plugins. It does not expose Windows endpoint enumeration, default-device routing, endpoint volume, microphone state or per-app routing, so this product declares no iCUE provider and does not misuse Media.

PackRat Audio Bridge uses public Windows Core Audio MMDevice and EndpointVolume APIs for enumeration, friendly names, current defaults, endpoint volume and mute.

Windows does not expose a documented public setter for the global default endpoint. The bridge isolates the long-standing Windows IPolicyConfig policy interface behind a runtime capability check. If activation or a switch fails, default-device switching fails closed in the UI while volume/mute remain usable. No third-party audio-switcher executable is bundled.

Per-app audio is intentionally omitted from v1. Session volume is possible, but robust per-app routing adds a separate less-stable Windows policy surface and is not required for the core customer job.

## Architecture
XENEON widget -> ws://127.0.0.1:17484/ws -> PackRat Audio Bridge -> Windows Core Audio.

The bridge binds only to loopback, rejects non-loopback clients, allowlists file/null/localhost origins, stores no credentials, makes no cloud requests and sends no telemetry.

## Failure states
Bridge connecting/offline/reconnecting, no output, no input, missing default endpoint, microphone volume unavailable, default switching unavailable and device disappearance are all first-class states.