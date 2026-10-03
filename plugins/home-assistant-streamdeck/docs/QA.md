# QA handoff matrix

| Gate | State |
|---|---|
| Node deterministic tests — transport, service calls, history, rendering, profile contracts, PI race | Run locally; see `qa-evidence` |
| Four profile ZIPs / unique ActionIDs and empty titles | Run locally; see `qa-evidence` |
| Actual SVG state key previews rendered at 72×72 / 36×36 | Offline raster QA; visual human check recommended |
| Live HA instance: authentication, registries, controls, reconnect | NOT TESTED |
| Windows Steam Deck host or physical MK.2 / XL / Plus / Neo | NOT TESTED |
| Official Elgato CLI validation and `.streamDeckPlugin` build | BLOCKED — no SDK/vendor CLI in local runtime |
| Canonical design audit `--require-canonical-pi` and key-visual audit `--require-major-profiles` | NOT RUN — canonical audit executable and installed SDK unavailable locally |
| Exact 5-frame approved Rat Art, final cover and contact sheet | NOT RUN — canonical photographic plate/original brand asset unavailable offline |
| Exact source commit on private per-SKU GitHub repository | PENDING private repository destination |
| SHIP_KIT / publication | NOT CREATED / NOT AUTHORIZED |

Fixture PASS proves only deterministic behavior. A real Home Assistant acceptance instance and physical host remain separate gates.
