# Stream Deck Marketplace Art System v1

Status: canonical after Monitor Manager Pro visual approval.

Reference product:
- `monitor-manager-pro`

Shared implementation:
- `tools/art/streamdeck_marketplace_campaign.py`
- `tools/art/render_streamdeck_ship_hero.py`
- `tools/art/build_marketplace_contact_sheet.py`
- `tools/art/validate_streamdeck_marketplace_campaign.py`
- `tools/local/rat-preview-art.ps1`

## 1. Campaign defaults

Stream Deck Marketplace art is one five-frame sales sequence, not five unrelated feature cards.

Default visual world:
- cover hero scene: `tools/art/scenes/warm-studio-v1/base.png`
- gallery scene: `tools/art/scenes/warm-studio-clean-v1/base-v2.png`
- gallery campaign style: `warm-studio-glass-v1`
- warm orange on the left, cool blue on the right
- dark translucent glass surfaces
- white primary copy
- PackRat orange-yellow for brand emphasis
- green only for real healthy/success states
- red only for real failure/destructive states

A product may override scene choices in `products/<slug>.json`:

```json
{
  "marketplace_art": {
    "hero_scene": "tools/art/scenes/warm-studio-v1/base.png",
    "gallery_scene": "tools/art/scenes/warm-studio-clean-v1/base-v2.png",
    "hero_title_style": "monitor",
    "campaign_style": "warm-studio-glass-v1"
  }
}
```

The shared resolver is authoritative. Do not hardcode alternate scene paths in Rat Ship.

## 2. Five-frame sales funnel

### Cover — earn the click
- immediate product recognition
- large readable product name
- premium desk/studio composition
- actual Stream Deck hardware where appropriate
- exact product key faces whenever available

### Gallery 1 — pain / desire
Answer: **Why do I want this?**

Show the annoying workflow the product removes. Prefer a visual before/after or old-way/new-way composition over a bullet list.

### Gallery 2 — strongest workflow / differentiator
Answer: **What cool thing does this let me do?**

Show the best repeated workflow in one glance. One clear input should produce one clear outcome.

### Gallery 3 — specific feature proof
Answer: **What will I actually be able to change or see?**

Prefer one high-interest feature or workflow over a generic “real product proof” slide. Use exact runtime states, real graphs, real values, real profiles, or real controls. A generic Stream Deck mockup is not required if a more specific use-case frame sells the product better.

### Gallery 4 — close the sale
Answer: **Why is this worth installing or buying?**

Good closing topics include:
- Stream Deck+ dials
- included bundled profiles
- supported Stream Deck models
- Pro depth
- saved workflows
- automation
- multi-monitor / multi-device value
- a high-frequency daily interaction

## 3. Shared campaign primitives

Products should import shared framing rather than reimplement it:

```python
from streamdeck_marketplace_campaign import (
    campaign_footer,
    campaign_header,
    glass_panel,
    load_scene,
    resolve_campaign_config,
    thin_arrow,
)
```

The shared system owns:
- scene normalization to 1920×960 using cover-fit + center crop, never stretching
- orange→blue glass borders and glow
- campaign header
- subtle lower divider / PackRat footer
- canonical connector arrow
- product art metadata resolution

Product-local code owns:
- which features to sell
- product-specific copy
- exact workflow composition
- product runtime keys/states
- product-specific graphs/UI/profiles

Do not globalize product-specific creative decisions.

## 4. Product-proof rule

Marketplace art must use the actual product visual language.

Preferred source order:
1. exact runtime-rendered key/state output from the shipping plugin
2. product-owned Rat Art key PNGs
3. representative Rat Art fixtures based on real manifest assets
4. real manifest state/icon art

Do not redraw a second marketing-only version of a shipping glyph if the shipping renderer can export it.

Do not add decorative status bars, green rails, yellow rails, fake labels, or fake Stream Deck cards that do not exist in the real product merely to make the gallery feel branded.

## 5. Copy and scale

- one slide = one selling job
- one headline should be understandable without reading supporting copy
- benefit first, implementation terminology later
- simplify copy before shrinking it
- every prose block must use bounded text helpers
- review at 480×240, 320×160, and 240×120
- if a label is unreadable at small scale and not essential, remove it

## 6. Profiles and device support

When bundled profiles are included:
- say `BUNDLED PROFILES INCLUDED`
- list the supported device families plainly
- do not repeat low-value labels such as `keys + profile` under every device
- only call out extra behavior when it is meaningfully different, such as native Stream Deck+ dials

## 7. Exact preview contract

The approval surface is always the exact final Rat Ship output.

Run:

```text
rat preview-art <slug>
```

The preview must:
1. validate campaign config
2. build current product source
3. render product-local Rat Art
4. apply the exact final Rat Ship hero overwrite
5. create the five final Marketplace images
6. create `review-contact-sheet.png`
7. stop without opening or modifying Maker Console

A product-local `02_cover.png` before the Rat Ship overwrite is not approval evidence.

## 8. Reference lessons from Monitor Manager Pro

The approved reference established these reusable lessons:
- keep the old warm-studio monitor scene for covers when product-name-on-monitor composition is stronger
- use the cleaner room scene for galleries so feature proof has more breathing room
- orange→blue glass framing can unify the campaign without turning every slide into a photo
- specific use cases sell better than generic “real product proof”
- runtime-exported key faces are materially better than marketing redraws
- large controls beat dense explanatory copy
- bundled-profile support should be listed plainly by device family
- the contact sheet is the primary visual QA surface
