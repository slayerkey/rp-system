# Ultimate per-application audio experiment

This directory is deliberately outside the packaged v0.7 plugin. It explores the next premium audio layer without destabilizing the current physical acceptance candidate.

## Product job

Do not expose Core Audio sessions as a technical list and call that a feature.

The user-facing system should answer two simple needs:

1. **Current App Volume** — control the audible foreground app without hunting through Windows Volume Mixer.
2. **Named App Channels** — keep a few recurring apps such as Discord, Spotify, browser, or a game at useful relative levels.

Stream Deck+ is an especially strong form-factor fit: one dial can become the current foreground app's volume while its touch-strip feedback shows the app and percentage.

## Experimental engine

`PackRatAppAudio.cs` enumerates audio sessions on the current default Windows render endpoint through Core Audio `IAudioSessionManager2` and controls matching sessions through `ISimpleAudioVolume`.

`app-audio.ps1` currently exposes:

- List
- Find
- SetVolume
- AdjustVolume
- Mute
- Unmute
- ToggleMute
- Compile

Matching accepts a process name, partial process/display name, or PID. All active sessions belonging to the match are changed together so users do not need to understand that one application can create multiple sessions.

## Important behavior constraints

### Audio sessions are ephemeral

An installed/running app may not have an audio session until it has actually created an audio stream. This is normal Windows behavior.

Ultimate should therefore show a friendly state such as:

- `SPOTIFY 35%`
- `DISCORD 70%`
- `BROWSER WAITING`

rather than treating “no current session” as a product failure.

### Enumerate fresh after device changes

Changing the default output can invalidate the set of sessions on the old endpoint. Do not keep long-lived COM session handles in the Stream Deck runtime. Resolve sessions fresh for each action/update or behind a carefully managed local helper.

### Aggregate by app

The UI should be application-centric even when Windows exposes multiple sessions for one process.

### Current App requires foreground identity

v0.7 already has a local foreground-process watcher for Smart Context. If per-app audio graduates, reuse the same foreground state instead of introducing another watcher.

### Presets should be sparse

An audio preset should only modify per-app channels the user explicitly included. It must not zero or normalize every active application.

Example Gaming preset:

- game: 100
- Discord: 65
- Spotify: 20

Everything else: unchanged.

### Missing app behavior

If a preset refers to an app without an active audio session, skip it and report a partial result. Do not launch an application solely because an audio preset mentions it.

## Candidate v0.8 controls if the experiment graduates

### Keypad

**App Volume**

Press: mute/unmute selected app

Optional configuration:
- Current foreground app
- Browser
- Discord
- Spotify
- custom process

Dynamic face:
- app identity
- volume percentage
- muted/waiting state

### Stream Deck+ encoder

**Current App Volume**

Rotate: foreground app volume

Press: foreground app mute

Touch strip:
`Discord 68%`

This is likely more valuable than using a permanent dial for generic mic level once the endpoint layer is stable.

### Presets / routines

Per-app volumes should be optional fields inside Work / Focus / Meeting / Gaming audio presets. Endpoint switching and microphone safety remain independent.

## Graduation gates

Do not add this to the packaged plugin until:

1. C# COM interop compiles under Windows PowerShell used by the product.
2. Session enumeration works on at least one real Windows machine with multiple audible apps.
3. Volume and mute changes affect only the intended process sessions.
4. Output-device switching followed by fresh enumeration works.
5. Multiple sessions for one app are handled coherently.
6. No-audio-session behavior is friendly.
7. Current App uses the existing Context foreground source instead of duplicate monitoring.
8. Physical endpoint/microphone v0.7 acceptance is good enough that adding another audio layer is justified.

Until then this directory is research/prototype code, not a release promise.
