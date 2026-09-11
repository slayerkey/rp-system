# PackRat Clipboard Shelf Bridge security contract

- Production listener binds only to `127.0.0.1:17485`.
- Clipboard state is sent only after the fixed WebSocket subprotocol and the locally generated per-user pairing code both validate.
- The pairing code is generated from 128 bits of cryptographic randomness, stored only inside DPAPI-protected local state, omitted from `/health`, and suppressed from clipboard history when copied from the tray.
- Remote web origins are rejected. Localhost origins used by deterministic compatibility harnesses still require the pairing code.
- Incoming command messages are capped at 32 KiB and schema-limited to Clipboard Shelf actions.
- Clipboard text and the pairing code are never written to console/request logs or CI evidence logs.
- Persisted state is DPAPI protected for the current Windows user, schema-versioned, and corrupt state fails closed.
- Full clipboard text stays in the companion. XENEON snapshots cap displayed text previews and cap recognized URL transport size.
- Private Mode pauses capture and clears the tracked CURRENT marker immediately so the display never claims an old value is still copied.
- Runtime commands cannot execute arbitrary shell, PowerShell, processes, scripts, or remote-control operations.
- There is no cloud relay, PackRat account, telemetry, analytics, or synchronization of clipboard contents.
