# Windows Settings Manager QA

## Automated gates

Required on the exact candidate head:

- strict TypeScript compile
- deterministic Lite and Pro assembly
- policy tests
- Windows backend process smoke
- official Elgato CLI validation
- official Stream Deck packaging
- production dependency audit
- deterministic Rat Art and dimension checks
- seven bundled profile device families per edition
- Lite/Pro action identity separation
- standard Pro profile contains exactly the 15 core Control Center actions
- destructive Restart/Shutdown confirmation regression
- radio capability/readback regression
- theme read/write/readback regression
- virtual desktop state-verification regression
- existing HDR safety boundary remains covered
- repository Lite/Pro portfolio and Rat Ship routing audits

Automation does not establish physical Windows behavior.

## Required physical Pro QA

### Power row

- Lock PC works immediately.
- Sleep enters Windows sleep and recovers cleanly.
- Hibernate works on a PC with hibernation enabled.
- Hibernate shows N/A / refuses action when hibernation is unavailable.
- Restart requires the default second press and actually restarts Windows.
- A single Restart press expires without restarting.
- Shutdown requires the default second press and actually shuts down Windows.
- A single Shutdown press expires without shutting down.
- Optional immediate confirmation setting behaves exactly as labeled.

### Windows state row

- Wi-Fi live state matches Windows.
- Wi-Fi Toggle / On / Off are verified on supported hardware.
- Wi-Fi hardware/policy/permission denial fails closed.
- Bluetooth live state matches Windows.
- Bluetooth Toggle / On / Off are verified on supported hardware.
- Bluetooth unavailable hardware shows N/A.
- Bluetooth global-radio behavior is not confused with individual peripheral connection.
- Power Plan live state matches Windows.
- exact-plan selection works for discovered plans.
- external power-plan changes refresh onto Stream Deck.
- Keep Awake toggles between STAY AWAKE and SLEEP NORMAL.
- turning Keep Awake off does not immediately sleep the PC.
- backend/plugin restart clears plugin-owned Keep Awake state safely.
- Theme shows LIGHT / DARK / MIXED correctly.
- Theme Toggle / explicit Dark / explicit Light work for the selected scope.
- external Windows theme changes refresh onto Stream Deck.

### Virtual desktop row

- Previous Desktop changes exactly one desktop left and confirms the result.
- Previous Desktop at the first desktop is a safe no-op.
- Next Desktop changes exactly one desktop right and confirms the result.
- Next Desktop at the last desktop is a safe no-op.
- New Desktop increases desktop count and confirms the new current desktop.
- Close Desktop decreases desktop count and confirms the result.
- Close Desktop refuses to close the only desktop.
- Current Desktop shows the correct index/count.
- external desktop changes refresh onto Stream Deck.
- reboot / Explorer restart does not leave stale desktop state.

### Stream Deck / lifecycle

- standard 5x3 profile installs and contains the exact 15-key layout.
- Mini profile is readable and contains the intended six keys.
- Plus and Neo compact layouts are readable.
- XL, Galleon, and + XL profiles stay within physical key bounds.
- no overlapping decorative art under native titles.
- no text overflow at normal viewing distance.
- Stream Deck restart restores state.
- Windows reboot restores state.
- backend failure shows OFFLINE / N/A rather than stale values.
- Rat Dev rebuild succeeds while the previous development plugin is linked.
- Rat Dev opens the intended standard .streamDeckProfile for import when shared command-layer support is available.

## Lite physical QA

At minimum:

- Lock
- Sleep
- Power Plan
- Keep Awake
- Previous Desktop
- Next Desktop
- external-state refresh
- all seven bundled profiles
- Lite contains no Pro-only action UUIDs

## Existing advanced compatibility QA

Because legacy advanced controls remain in Pro, do not weaken their safety boundary:

- Windows 11 24H2+ HDR supported / unsupported behavior
- older Windows exposes no legacy ambiguous HDR write
- mixed HDR remains uncertain rather than flattened
- display topology read/write remains verified
- screen/sleep timeout writes remain verified
- optional PC Modes remain empty by default and preserve COMPLETE / PARTIAL / FAILED semantics

These are secondary controls, not the primary product pitch.

## Release blockers

Physical QA cannot be replaced by hosted CI. Keep both product records BLOCKED until this matrix is complete and deterministic Marketplace media is reviewed.

Lite additionally remains commercially blocked until Pro is published, both exact direct Marketplace URLs/IDs are recorded, Lite is rebuilt with the exact Pro URL, and:

`python tools/lite_pro_audit.py --shipping windows-settings-manager-lite`

passes.
