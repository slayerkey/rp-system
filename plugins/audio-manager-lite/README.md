# Audio Manager Lite

Audio Manager Lite is the free, focused edition of PackRat's Windows audio family for Stream Deck.

## One job

Lite exposes exactly one customer-facing action: **Set Output Device**.

Use separate keys for speakers, headphones, a monitor, a USB DAC, or another Windows playback device. Each key remembers its configured target and shows the target on the hardware key while the Property Inspector separately shows what Windows is using right now.

Lite controls the Windows **Default Output** role, which means Console + Multimedia together.

## Why Pro exists

Audio Manager Pro is the whole-setup edition. It adds:

- Audio Profiles that switch output + input + Communications roles together
- profile capture, apply, cycle, and status
- saved endpoint volume/mute restore
- direct input switching and Communications routing
- default microphone control
- Stream Deck+ profile-output volume

Lite intentionally does not expose those features.

## Lite → Pro UI

The Property Inspector follows the canonical PackRat Lite→Pro pattern:

- PackRat maker link at top left
- persistent **Upgrade to Pro ↗** at top right
- bottom Audio Manager Pro feature card

Until the exact public Audio Manager Pro Marketplace product URL exists, both upgrade controls use the canonical PackRat maker fallback.

## Bundled layouts

Starter layouts ship for Standard/MK.2, XL, Stream Deck+, and Neo. They contain several unconfigured Set Output Device keys so the user can bind their common speakers/headphones without building the page from scratch.

## Development

`rat dev audio-manager-lite`

The product uses the shared PackRat Windows AudioCore and a self-contained local helper. Customers do not need .NET installed.
