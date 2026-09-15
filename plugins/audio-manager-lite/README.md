# Audio Manager Lite

Audio Manager Lite is the free, focused edition of PackRat's Windows audio family for Stream Deck.

## Two direct controls

Lite exposes exactly two customer-facing actions:

- **Set Output Device** — switch Windows Default Output to a speaker, headset, monitor, USB DAC, or other playback device.
- **Set Input Device** — switch Windows Default Input to a microphone or other capture device.

Each key remembers its own configured target and shows that target on the hardware key. The Property Inspector separately shows what Windows is using right now.

Lite controls the Windows **Default** role, meaning Console + Multimedia together. It intentionally does not expose Communications routing.

## Why Pro exists

Audio Manager Pro is the whole-setup edition. It adds:

- Audio Profiles that switch output + input + Communications roles together
- profile capture, apply, cycle, and status
- saved endpoint volume/mute restore
- Communications routing
- default microphone mute
- Stream Deck+ profile-output volume

Lite intentionally stops at individual speaker/microphone switching. Pro is where multiple audio changes become one setup.

## Lite → Pro UI

The Property Inspector follows the canonical PackRat Lite→Pro pattern:

- PackRat maker link at top left
- persistent **Upgrade to Pro ↗** at top right
- bottom Audio Manager Pro feature card

Until the exact public Audio Manager Pro Marketplace product URL exists, both upgrade controls use the canonical PackRat maker fallback.

## Bundled layouts

Starter layouts ship for Standard/MK.2, XL, Stream Deck+, and Neo. Each layout includes unconfigured output and input keys so the user immediately gets both halves of Lite without building the page from scratch.

## Development

`rat dev audio-manager-lite`

The product uses the shared PackRat Windows AudioCore and a self-contained local helper. Customers do not need .NET installed.
