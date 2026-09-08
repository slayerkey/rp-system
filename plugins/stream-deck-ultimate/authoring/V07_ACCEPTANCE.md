# Stream Deck Ultimate Bundle — v0.7 Physical Acceptance

This file separates what automation proves from what must be observed on real Stream Deck + Windows hardware.

## Candidate

- Product version: `0.7.0.0`
- Working label: `Stream Deck Ultimate Bundle v0.7 Smart Beta`
- Primary acceptance device: standard 15-key Stream Deck on Windows
- Additional profile targets: Stream Deck XL, Stream Deck+, Stream Deck Neo
- Core architecture: proven v0.6 runtime + isolated v0.7 Smart Context sidecar on one Stream Deck WebSocket

## Already physically proven from earlier builds

Do not re-open these as unknown unless a regression is observed:

| System | Physical state | Notes |
| --- | --- | --- |
| Plugin install/runtime | PROVEN | Original v0.1 dead-runtime defect was fixed and regression-gated. |
| Clean bundled-profile install | PROVEN | Clean uninstall/reinstall is needed to exercise first-install profile behavior during development. |
| Window left/right/maximize | PROVEN | User reported these work perfectly. |
| Region capture | PROVEN | User reported Capture works. |
| Clipboard paste | PROVEN | User reported Clip 1 pastes content. |
| Old browser implementation | FAILED/REPLACED | Do not treat the old failure as proof against the current hardened implementation. |

## v0.7 automated release gates

All of these must be green before physical acceptance:

- v0.6 safe config/product-logic regression
- Smart Context classification/mapping tests
- actual manifest CodePath runtime launch
- proven v0.6 runtime through the v0.7 wrapper
- Context/core WebSocket multiplex test
- active Smart App image-state test
- Windows custom workspace execution
- PowerShell Core Audio parse
- eight deterministic profiles/previews
- context/status/art asset presence
- official Elgato validate
- official Elgato pack

## Physical acceptance pass

The goal is one broad session, not one-button-at-a-time debugging. Record observations; do not ask the tester to diagnose implementation details.

### A. Install / first-use

- [ ] Clean uninstall prior development build
- [ ] Install v0.7 `.streamDeckPlugin`
- [ ] Standard Home profile appears on first install
- [ ] Home key art fits cleanly with no clipping/duplicate titles
- [ ] SMART navigation opens the Smart profile
- [ ] HOME from Smart returns to Home
- [ ] SETUP opens local onboarding

### B. Setup / detected apps

- [ ] Output devices appear with understandable names
- [ ] Input/microphone devices appear with understandable names
- [ ] Installed/running app suggestions are plausible
- [ ] Recommended default can be accepted without editing raw tokens
- [ ] Creator/Gaming suggestions behave sensibly if relevant apps are installed
- [ ] Save persists after Stream Deck restart
- [ ] Meeting URL can be left empty
- [ ] A routine can intentionally have zero apps

### C. Smart Apps

Test each both closed and already-running where possible.

- [ ] WEB launches/focuses the intended browser
- [ ] DISCORD launches/focuses Discord
- [ ] SPOTIFY launches/focuses Spotify
- [ ] Active built-in app key gets a subtle green status dot
- [ ] Active state moves away when another app becomes foreground
- [ ] No surprising window rearrangement occurs from a Smart App press

### D. Smart Context

Enter SMART and switch foreground applications naturally.

Browser:
- [ ] Back
- [ ] New Tab
- [ ] Refresh
- [ ] Close Tab

VS Code:
- [ ] Command Palette
- [ ] Terminal
- [ ] Save
- [ ] Close Editor/Window behavior is acceptable

Explorer:
- [ ] Back
- [ ] Up
- [ ] Address bar
- [ ] New window

Spotify:
- [ ] Previous
- [ ] Play/Pause
- [ ] Next
- [ ] Volume+

Discord:
- [ ] Search
- [ ] Quick Switcher
- [ ] Mute shortcut
- [ ] Deafen shortcut

Context behavior:
- [ ] First four keys change within roughly one second of foreground-app change
- [ ] The remaining eleven keys remain stable and memorable
- [ ] Unknown apps fall back to Web / Discord / Spotify / Capture
- [ ] Context does not flicker continuously
- [ ] Hidden PowerShell foreground watcher does not create visible windows
- [ ] Idle/resource cost feels acceptable during normal use

### E. Real audio layer

This is the most important new hardware boundary.

- [ ] MIC reflects current default input mute state
- [ ] MIC toggles the expected microphone
- [ ] OUT cycles only sensible output endpoints
- [ ] Input cycle selects expected microphones
- [ ] No duplicate/broken endpoints make normal cycling unusable
- [ ] Work preset applies expected master volume
- [ ] Focus preset defaults to mute without unexpectedly changing unrelated devices
- [ ] Meeting preset preserves mic state unless explicitly configured otherwise
- [ ] Gaming preset preserves mic state unless explicitly configured otherwise
- [ ] Restore returns the prior output/input/volume/mic state when expected

### F. Routines

- [ ] WORK opens/focuses only configured apps
- [ ] WORK only arranges its own app windows
- [ ] Work layout is useful
- [ ] Columns layout is useful when selected
- [ ] Grid layout is useful when selected
- [ ] Focus routine applies configured audio/workspace state
- [ ] Meeting can operate as audio-only or URL-only if desired
- [ ] Gaming can operate without arranging windows
- [ ] Rapid double press does not start overlapping copies of the same routine

### G. Regression pass

- [ ] LEFT
- [ ] RIGHT
- [ ] MAX
- [ ] next monitor
- [ ] region capture
- [ ] clipboard slot 1
- [ ] media play/pause
- [ ] Utilities profile navigation
- [ ] Windows profile navigation
- [ ] Audio & Modes profile navigation

## Stream Deck+ acceptance when hardware is available

- [ ] Master Volume dial has intuitive step size
- [ ] Output dial cycles predictably
- [ ] Input dial cycles predictably
- [ ] Mic Level dial adjusts the intended endpoint
- [ ] Dial press mute behavior is learnable
- [ ] Touch-strip feedback truncates device names acceptably

## XL / Neo acceptance when hardware is available

- [ ] XL reads like one dashboard rather than a stretched standard profile
- [ ] XL visual grouping is understandable without documentation
- [ ] Neo contains the highest-value eight controls
- [ ] Neo does not feel like a crippled version of Standard

## Acceptance decisions

After one broad physical pass classify observations as:

- `PASS` — habit-worthy and reliable
- `POLISH` — works but UX/art should improve
- `BUG` — expected behavior did not happen
- `REMOVE` — feature is not valuable enough for Ultimate
- `DEFER` — valuable but not ready for v1

The acceptance pass should produce a batch revision, not a sequence of tiny one-button patches.

## Next major technical boundary

Do **not** begin per-application audio or deeper context-aware audio as a release dependency until the endpoint/device/mic section above is physically accepted. It is safe to research or prototype it in isolation, but it should not destabilize the acceptance candidate.
