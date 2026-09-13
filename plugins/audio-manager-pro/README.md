# Audio Manager Pro

Audio Manager Pro is PackRat's paid Windows audio-profile plugin for Stream Deck.

The product owns one job: **switch your entire audio setup with one key**. It is intentionally not a per-app volume mixer and does not try to duplicate Elgato Volume Controller or Audio Switcher.

## Actions

1. Apply Audio Profile
2. Set Output Device
3. Set Input Device
4. Cycle Audio Profile
5. Audio Profile Status
6. Mute Default Mic
7. Profile Output Volume for Stream Deck +

## Audio Profiles

Each profile can independently configure:

- Windows Default output
- Windows Communications output
- Windows Default input
- Windows Communications input
- optional endpoint volume restore
- optional endpoint mute restore

For Audio Manager Pro, the user-facing **Default** role means Windows Console + Multimedia together. Applying a Default role sets both underlying Windows roles, and Status requires both to still match before reporting the profile ACTIVE.

A missing or recreated endpoint is never replaced by a friendly-name guess. Profiles store endpoint ID plus Windows device-instance and hardware-container metadata. Safe matches can rebind automatically; weak name-only matches require an explicit user rebind.

Applying a profile reports one of three outcomes: SUCCESS, PARTIAL, or FAILED. If two configured roles target the same physical endpoint but request contradictory saved volume or mute state, routing can still apply but the contradictory state restore is skipped and reported instead of arbitrarily choosing a winner.

## Windows architecture

The Stream Deck plugin is Node-based and launches a bundled, local-only C# helper over stdio.

Both Audio Manager Pro and the existing XENEON Audio Control Center consume the same shared library:

`companions/packrat-audio-core/src/PackRat.AudioCore/`

That library owns MMDevice enumeration, endpoint volume/mute, role-aware default-device switching, friendly names, device instance IDs, and hardware container IDs.

Audio Control Center keeps its original behavior by using a thin adapter that sets Default and Communications roles together. Audio Manager Pro exposes the roles separately.

## Wave Link boundary

Audio Manager Pro uses Windows audio roles only. It does not call private Wave Link internals.

Wave Link users can configure Monitor Mix to follow Windows Default Output, or use Elgato's official Wave Link Stream Deck plugin for Wave-specific routing.

## Development

Building from source requires Node.js 24+ and the .NET 8 SDK. The .NET SDK is a build-time PackRat requirement only; the shipped Windows helper is self-contained.

```text
rat dev audio-manager-pro
```

The Audio Profile Status action is read-only: it refreshes current Windows audio state and reports ACTIVE / INACTIVE without applying the profile.

Release packaging:

```text
rat ship audio-manager-pro
```
