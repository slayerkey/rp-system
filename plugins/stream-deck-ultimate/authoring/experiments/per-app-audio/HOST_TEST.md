# Ultimate Per-App Audio — Real Windows Host Test

This folder is experimental and is **not part of the accepted v0.7.1 plugin**.

Use this only to prove whether Windows Core Audio application sessions behave correctly on a normal desktop audio host before the feature is promoted into Ultimate.

## Fastest path

Have the target app actively playing audio, then open Command Prompt in this folder and run:

```bat
run-host-test-and-save.cmd -Process Spotify -Exercise
```

Replace `Spotify` with the process you want to test.

The test is deliberately reversible. It changes that app by exactly 1 volume percentage point, verifies the change, restores the original value, and verifies the restoration.

The wrapper automatically saves the complete machine-readable report as:

`host-test-result.json`

That is the preferred file to send back for review.

Expected success:

`write-and-restore-pass`

If the app resolves to multiple PIDs, first run the inventory command below and then repeat the exercise with the exact PID:

```bat
run-host-test-and-save.cmd -Pid 1234 -Exercise
```

## Inventory only

```bat
run-host-test-and-save.cmd
```

This is read-only. It reports the currently visible Windows application audio sessions and still saves `host-test-result.json`.

Useful result states:

- `audit-only-needs-target` — audio endpoint works and the inventory was generated
- `audio-endpoint-unavailable-or-error` — Windows exposed no usable playback endpoint to the helper

## Check one app without changing anything

```bat
run-host-test-and-save.cmd -Process Discord
```

or

```bat
run-host-test-and-save.cmd -Process Spotify
```

This remains read-only.

Expected states:

- `read-only-pass` — exact process session found
- `waiting-no-session` — the app has no current Core Audio session; play audio in the app and run it again

Matching is exact after normalizing `.exe`. `Discord` does not intentionally match `DiscordHelper`.

## Reversible 1% write test details

The harness only exercises a write when the target resolves safely.

Safety refusals are intentional:

- `exercise-refused-multiple-pids` — more than one process PID matched. Re-run with the exact PID from the audit, for example `-Pid 1234 -Exercise`.
- `exercise-refused-mixed-volume` — one PID exposes sessions with different volume values. The harness refuses to flatten that state merely for a test.

The harness never modifies mute state.

## Custom result filename

The original wrapper remains available when a custom output filename is useful:

```bat
run-host-test.cmd -Process Discord -OutputPath discord-audio-audit.json
```

For the reversible test:

```bat
run-host-test.cmd -Pid 1234 -Exercise -OutputPath discord-audio-write-test.json
```

The saved JSON is enough to diagnose the next layer without a button-by-button Stream Deck debugging loop.

## What this proves

A successful `write-and-restore-pass` proves, on that Windows machine and current audio stack:

- the default playback endpoint can expose app sessions
- the target application session can be identified
- a PID-scoped Core Audio volume write works
- the change is observable on a second enumeration
- the original volume can be restored

It does **not** by itself prove:

- Stream Deck+ dial latency
- foreground Current App tracking
- Discord/game/music multi-channel presets
- device-switch behavior
- microphone behavior

Those remain separate acceptance gates.

## Promotion rule

Do not promote per-app audio into the accepted Ultimate plugin only because CI passes. At least one normal Windows desktop must produce a successful reversible `write-and-restore-pass`, followed by the separate physical App Volume Lab Stream Deck acceptance pass.
