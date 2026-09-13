# Macro Recorder Lite + Pro — Market / Redundancy Gate

Date: 2026-09-12

## Verdict

GO. Macro Recorder owns a separate customer job from Better Hotkeys & Mouse:

> I do not want to program a macro. I want to perform it once and have Stream Deck remember it.

The primary product object is a recorded, time-ordered input timeline. Editing is optional refinement after capture.

## Why this is not Better Hotkeys

Better Hotkeys & Mouse Lite/Pro exposes discrete keyboard and mouse building blocks such as hold/toggle key, clicks, mouse movement, drag, scroll, auto-repeat and encoder hotkeys.

Macro Recorder starts from observed input. The user presses Record, performs a workflow, presses Stop, then assigns or saves the captured timeline. Better Hotkeys remains a separate product family and is not modified by this build.

The current PackRat repository contains published metadata for Better Hotkeys & Mouse Lite 0.2.1.0 and Pro 1.1.0.0, but their shipping source is not present in the connected canonical tree. Macro Recorder therefore introduces a shared Windows input host designed for future reuse rather than silently creating a second unrelated injection engine.

## Why this is not SuperMacro

Current SuperMacro is a powerful Windows macro plugin. Its documented workflow includes command syntax, virtual-key notation, mouse commands, coordinates, variables, functions and advanced settings.

Macro Recorder deliberately does not add a scripting language. The default workflow is record -> perform -> stop -> replay, with a human-readable event timeline for corrections.

## Why this is not native Multi Action

Stream Deck Multi Actions are manually constructed from actions and delays. Macro Recorder captures actual keyboard/mouse event order and timing from a performed workflow and replays that result as one macro action.

## Other current competitors reviewed

- SuperMacro
- Humble Macro
- Simple Macro
- Mouse Magic
- native Stream Deck Multi Actions

The category is not treated as empty.

## Search / SEO evidence

PackRat's Elgato Marketplace search snapshot captured 2026-08-29 shows:
- Windows: popularity 198
- Mouse: popularity 98
- Keyboard: popularity 96
- Shortcut: popularity 62

These are rolling Marketplace query-suggestion popularity signals, not sales counts. The build uses macro / macro recorder / keyboard macro / mouse macro / automation / record keystrokes / record mouse / hotkeys / shortcuts wording naturally, but does not claim that "macro" is a top-100 query because the current top-100 snapshot does not establish that.

## Product split

### Lite — Free

- Keyboard-only recording
- Key down / key up fidelity
- Modifier combinations
- Recorded delays
- Human-readable timeline with editable delays
- 30-second maximum recording
- 60-event maximum recording
- One saved macro per configured Replay Macro action
- Global Stop action
- Ctrl+Shift+F12 emergency playback stop
- Local-only macro storage in Stream Deck action settings

### Pro — $7.99

Everything in Lite plus:
- Mouse buttons, movement, wheel and drag capture
- 10-minute maximum recording
- 25,000-event maximum recording
- Adjustable 0.25x–4x playback speed
- Repeat count
- Repeat while held
- Toggle repeat
- Reusable local Macro Library
- Duplicate / delete / reorder timeline events
- Import / export PackRat macro JSON files
- Absolute multi-monitor mouse coordinates
- Optional active-window-relative mouse positioning
- Starter profile pages for MACROS, GAMING, PRODUCTIVITY, MOUSE and LOOPS

## Safety boundary

- Macro contents are never uploaded to PackRat.
- No scripting language or shell execution is included.
- The product warns users not to deliberately record passwords.
- Windows secure-desktop input is outside the normal recording desktop. Ordinary application password fields cannot be detected reliably, so the product does not claim otherwise.
- Playback cleanup releases tracked keys and mouse buttons in a finally path.
- A helper crash triggers a recovery release pass from the plugin.
- The Stop action and Ctrl+Shift+F12 both cancel playback globally.
- Bundled examples exclude anti-AFK, cheats, gameplay farming or abusive automation.
