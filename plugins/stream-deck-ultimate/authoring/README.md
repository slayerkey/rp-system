# Stream Deck Ultimate Bundle

Windows-first PackRat flagship prototype for turning Stream Deck into a ready-to-use control system for everyday computer use.

## Current status

Current acceptance candidate: **v0.7 Smart Beta**.

This is substantially beyond the original interaction prototype, but it is **not yet a Marketplace release candidate**. The next release boundary is broad physical acceptance of the newer audio, routine, onboarding, and Smart Context systems on a real Windows Stream Deck host.

## Product thesis

Ultimate is not valuable because it has a large action count. Its job is to remove the work of owning a powerful Stream Deck:

> Install once, pick your setup, and get a coherent computer control system without hunting for plugins, building dozens of keys, designing profiles, or becoming an automation engineer.

The commercial product should feel like one product even where proven PackRat subsystems are reused internally.

## v0.7 surface

### Apps and workspaces

- Smart App: focus an existing app or launch it when closed
- active-app feedback for built-in Web, Discord, and Spotify keys
- detected/common app catalog including browser, Discord, Spotify, Slack, Teams, Zoom, Steam, VS Code, Notion, Todoist, OBS, and Explorer
- custom executable support
- Work, Focus, Meeting, and Gaming workspaces
- concurrent app launch/window readiness
- Work, Columns, Grid, and No-Move layouts
- only configured workspace windows are arranged
- routines are guarded against repeated presses while already running
- audio-only and link-only routines are valid

### Window control

- left / right
- top-left / top-right
- bottom-left / bottom-right
- maximize / restore / minimize
- center
- next monitor
- toggle always-on-top

### Clipboard and text

- local recent clipboard history
- four recent clipboard slots
- clear PackRat history
- reusable text snippets
- local dynamic date/time/clipboard tokens
- optional clipboard restoration after snippet paste

### Capture and media

- region capture
- full-screen capture
- active-window capture
- screenshots folder
- play/pause, previous, next
- mute / volume keys

### Premium audio and modes

- default Windows output switching/cycling
- input/microphone switching/cycling
- real endpoint microphone mute state
- microphone mute toggle
- master output volume
- microphone input level
- Work / Focus / Meeting / Gaming audio presets
- explicit mic safety modes: Keep Current / Mute / Live
- preset audio restore
- Stream Deck+ volume, output, input, and mic-level encoders

Core Audio remains local and Windows-first. It still requires physical acceptance across real user devices/drivers before release claims are made.

### Onboarding

The SETUP action opens a local `127.0.0.1` wizard. It can:

- list current Windows audio devices
- detect common installed/running apps
- suggest sensible, creator, or gaming routines
- configure Work / Focus / Meeting / Gaming app sets
- configure window layouts
- configure output volume and mic policy
- add an optional meeting URL

The normal path is pick devices -> accept/tune suggested apps -> adjust modes -> save. Raw `.exe` and token editing remain available for advanced users.

### Smart Context — v0.7

Smart Context is deliberately **optional** rather than making the whole deck unpredictable.

Home has one explicit `SMART` entry. The Smart profile reserves only its first four keys for foreground-app controls while Work, Focus, Meeting, Mic, Output, Clipboard, Windows, Tools, Setup, and Home remain stable.

Current mappings:

- Browser: Back / New Tab / Refresh / Close
- VS Code: Command Palette / Terminal / Save / Close
- Explorer: Back / Up / Address / New Window
- Spotify: Previous / Play / Next / Volume+
- Discord: Search / Quick Switch / Mute / Deafen
- Generic fallback: Web / Discord / Spotify / Capture

Foreground state uses one hidden persistent Windows watcher only while stateful Smart App or Context keys are visible. It emits updates only when the foreground process changes rather than spawning a new process on every poll.

## Bundled profiles

v0.7 generates eight deterministic profiles:

1. Standard Home
2. Standard Smart Context
3. Standard Windows
4. Standard Utilities
5. Standard Audio & Modes
6. Stream Deck XL
7. Stream Deck+
8. Stream Deck Neo

Profiles remain thin shells around plugin logic. Elgato does not overwrite a user's installed profile when a plugin updates, so clean uninstall/reinstall or manual profile import remains necessary during development when profile layouts change.

## What has been physically proven

Observed on the user's real standard Stream Deck during earlier acceptance passes:

- plugin can install and run
- clean first install can install the bundled profile
- left/right/maximize window controls work well
- capture works
- clipboard paste works
- profile structure/runtime fixes introduced after v0.1 solved the original dead-plugin failure

Earlier Browser/Workspace behavior was unreliable, which led to the current catalog, URI fallback, focus/launch, real-window wait, and scoped-arrangement architecture. Those newer paths still need broad physical acceptance rather than being assumed good because CI passes.

## What v0.7 CI proves

A candidate is not test-ready merely because Elgato accepts its manifest.

Current gates include:

- Node syntax checks
- Python generator checks
- safe config migration and microphone-default tests
- Work / Columns / Grid geometry tests
- empty/audio-only routine tests
- actual manifest `CodePath` runtime launch
- proven v0.6 core regression through the v0.7 wrapper
- WebSocket registration and dynamic image feedback
- audio/dial/setup runtime smoke coverage with a deterministic audio mock
- Windows custom executable/workspace execution
- Smart Context process classification and shortcut mapping
- multiplexed Smart Context + core runtime on one Stream Deck WebSocket
- active Smart App state feedback
- deterministic eight-profile generation
- required context/status/art assets
- PowerShell Core Audio syntax parsing on Windows
- official Elgato CLI validation
- official `.streamDeckPlugin` packaging

## Still requires physical acceptance

Do not convert these into release claims until tested on actual hardware/host state:

- real Core Audio output/input switching across the user's installed drivers
- real mic endpoint mute and level behavior
- Work / Focus / Meeting / Gaming routines using the user's actual apps/devices
- detected-app recommendations on the user's PC
- browser focus/launch behavior after the current hardening
- live foreground watcher responsiveness/resource cost
- Smart Context shortcuts in Chrome/Discord/VS Code/Explorer
- Stream Deck+ dial/touch-strip feel
- XL and Neo profile ergonomics on those physical devices

## Existing PackRat code to consolidate for production

The integrated prototype proves the interaction. Production should continue consolidating shared/proven implementations rather than permanently forking them:

- Clipboard Manager / Pro
- Window Manager Lite / Pro
- Workflow Automation Lite / Pro
- Better Hotkeys & Mouse / Pro

The customer should experience **one Ultimate product**, regardless of internal reuse.

## Privacy

- clipboard history and snippets remain local
- config remains local
- foreground process names are used locally for Context and are not sent to PackRat
- onboarding is served only from loopback (`127.0.0.1`)
- basic product operation does not require PackRat cloud infrastructure

## Release discipline

Do not hand a new hardware candidate to the user unless:

1. proven-core regression is green through the current manifest CodePath
2. new subsystem logic/runtime tests are green
3. generated profiles/art validate
4. official Elgato validation passes
5. official Elgato packing passes
6. generated key/profile previews are visually inspected

Do not call a new subsystem physically verified until it has actually been exercised on representative hardware.

## Current deliberate scope boundary

The next high-value technical system after physical v0.7 acceptance is **per-application audio/context-aware audio**, followed by deeper routine polish. Do not add it blindly before the current endpoint/device layer has been tested against real Windows audio hardware.

macOS remains a later parity track rather than something to fake with incomplete feature support.

## Product naming

Working product name: `Stream Deck Ultimate Bundle`.

Elgato brand usage requires `Stream Deck` as two words. Final Marketplace naming remains open until the product thesis and onboarding are accepted on hardware.
