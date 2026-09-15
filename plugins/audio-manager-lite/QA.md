# Audio Manager Lite QA

Product: Audio Manager Lite  
Slug: audio-manager-lite  
Branch: product/audio-manager-lite  
Version: 1.0.0.0  
Price: Free

## Product boundary

Lite intentionally exposes exactly two direct Windows audio actions:

- **Set Output Device**
- **Set Input Device**

Both switch the Windows **Default** role (Console + Multimedia). Lite does not expose Communications routing, Audio Profiles, profile workflow, microphone mute, restore state, or Stream Deck+ profile volume.

That is the conversion boundary: Lite switches one speaker or microphone at a time; Pro switches the whole audio setup.

## Current QA state

The previous output-only green evidence is stale because the product boundary changed to include direct microphone switching.

Exact-head CI must prove:

- both manifest actions register
- output and input helper commands verify against Windows
- both key glyphs render correctly
- bundled profiles contain both speaker and mic keys
- stale PI refresh cannot overwrite either device selection
- canonical PackRat PI + Lite→Pro audits pass
- native helper smoke, Elgato validation/package, and payload hygiene pass

## Physical gate

Run `rat dev audio-manager-lite`, then verify:

1. bundled Audio Manager Lite profile imports/opens
2. the starter row visibly includes **speaker keys and microphone keys**
3. bind one output key to speakers/headphones
4. bind one input key to the microphone you actually use
5. wait several seconds and confirm neither selection snaps back
6. press the output key and confirm Windows Default Output changes
7. press the input key and confirm Windows Default Input changes
8. confirm each hardware key uses the correct speaker/mic glyph and target name
9. confirm PI `Windows is using` follows the selected action's live output/input
10. no horizontal scrollbar appears with long device names
11. top **Upgrade to Pro ↗** and bottom **Open Audio Manager Pro ↗** remain visible and correct

Do not mark READY_TO_SHIP until the refreshed automated pass and this physical pass are complete.
