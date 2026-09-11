# PackRat Window Bridge security contract

- Windows desktop only in production.
- Explicit loopback bind: `127.0.0.1:17487`.
- WebSocket route: `/widget`.
- Only blank, `null`, `file://`, and the bridge's own localhost setup origins are accepted.
- First frame requires `type=hello`, protocol `1`, and the random local pairing key.
- Pairing keys are compared using fixed-time SHA-256 digests.
- Incoming text messages are limited to 64 KiB.
- Commands are schema-limited to focus, minimize, maximize/restore, snap left/right, move monitor and close.
- Window IDs must still be in the current bridge snapshot.
- Monitor IDs must still be in the current bridge snapshot.
- No arbitrary command execution, shell, PowerShell, DLL injection or process launch from WebSocket commands.
- No cloud relay, PackRat account, telemetry, analytics, or remote-control listener.
- Desktop metadata stays local.
- Errors crossing the bridge are length-limited and sanitized to normal exception messages.
