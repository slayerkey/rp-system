# Audio Control Center QA

Product: Audio Control Center
Slug: audio-control-center
Branch: product/audio-control-center
Version: 1.0.0
Price: $9.99

Physical XENEON hardware test: **not performed**. This file records hardware-free validation only.

Required release gate:
- authored runtime syntax and product contract
- PackRat Audio Bridge Windows build and fake-backend tests
- all eight XENEON layouts
- multiple fake output/input devices
- device disappearance and no devices
- long names
- mute/unmute and volume changes
- bridge unavailable and reconnecting
- switching capability unavailable
- microphone endpoint volume unavailable
- canonical flattened shipping build
- official CORSAIR validation and package verification
- Corsair Labs Windows runner
- StreamSpell all presets
- Rat Art
- Rat Ship

The widget declares no iCUE Media/audio provider. Per-app audio is not part of v1.