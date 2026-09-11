# PackRat Audio Bridge security boundary

- Windows desktop only for the production Core Audio backend.
- Binds explicitly to `127.0.0.1:17484`.
- Rejects non-loopback clients.
- Allows only `null` / `file://` and localhost / `127.0.0.1` origins.
- WebSocket commands are size-limited and schema-validated.
- Endpoint IDs must still exist in the active endpoint set before default switching.
- No shell or PowerShell execution.
- No cloud API, PackRat account, API key, credential, token, telemetry, or analytics.
- No third-party audio-switcher executable.
- Errors crossing the bridge are sanitized.
- The undocumented Windows default-device policy interface is isolated to one adapter and capability-probed before the UI enables switching.
