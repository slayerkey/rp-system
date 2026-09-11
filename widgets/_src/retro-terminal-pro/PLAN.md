# Retro Terminal Pro plan

## Product boundary

Retro Terminal Pro is a separate paid XENEON Edge widget. The published free Retro Terminal remains untouched.

The canonical repository, branch search, commit search, code search, and accessible Slayerkey repositories did not contain recoverable source for the published free Retro Terminal. Pro therefore preserves the known product direction rather than claiming source reuse that was not available.

## V1 focus

The paid value is terminal customization and atmosphere, not a retro-skinned version of XENEON EDGE Ultimate.

Programs:

- PROMPT: customizable local decorative terminal text.
- SYSTEM: native iCUE CPU, GPU and RAM sensor values when present.
- TRACE: clearly labeled synthetic ambient trace.
- DATA RAIN: clearly labeled synthetic ambient animation.
- CLOCK: local device time.

Appearance:

- green phosphor, amber, white monochrome, blue terminal, cyberpunk and custom colors
- scanlines, glow, subtle flicker, vignette and CRT curvature
- classic, cascade, fast and disabled startup sequences

Behavior:

- touch program switching
- optional automatic program rotation
- optional automatic style rotation
- configurable idle/screensaver program
- local per-instance persistence

## Data honesty

SYSTEM discovers real sensor metadata and values through the iCUE Sensors provider. A role is displayed only when a matching provider sensor exists. No browser fixture or ambient animation is used as a shipping sensor fallback.

The displayed uptime is widget-session uptime and is labeled as such. It is not claimed as operating-system uptime.

## Responsive strategy

All eight official XENEON viewport compositions use the same terminal language but different font, padding, row and stacking decisions. Small slots compress the header and sensor grid. Vertical layouts stack SYSTEM rows. Large native-resolution layouts deliberately increase the physical-device baseline.

## Release gate

Static verification, exact packaged browser fixture, all eight layouts, touch/settings/idle/no-sensor states, official CORSAIR validate/package, ZIP integrity, lexical Custom Style regression, Corsair Labs Windows runner, StreamSpell package verification, deterministic Rat Art, and Rat Ship kit.
