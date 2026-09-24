# Security model

- Binds to `127.0.0.1` only.
- Rejects non-loopback clients.
- Restricts browser origins to local/file origins used by iCUE and the local setup page.
- Requires a random per-user pairing key for WebSocket telemetry.
- Compares pairing keys in fixed time after hashing.
- Opens HWiNFO Shared Memory read-only and never writes to it.
- Uses bounded header/row/count validation before copying/parsing.
- Uses one serialized WebSocket send path per connected client.
- Sends no telemetry, hardware sensor data, keys, or account data to PackRat.
- The local setup page can rotate the pairing key.
- Uninstall removes the executable, startup entry, pairing key, and local bridge data.
