# warm-studio-v1

Reusable PackRat marketplace environment plate.

## Required files

- `base.png` — exact `1920x960` clean environment plate with blank monitor and empty desk.
- `geometry.json` — calibrated monitor, product, and brand placement coordinates.
- `title-style.json` — approved monitor typography hierarchy and decorative launch treatment.

## Source requirements

`base.png` contains only the reusable environment: lamp, plants, headphones, blank monitor, dark room, and wood desk. It does not contain product UI, XENEON hardware, Stream Deck hardware, PackRat branding, or product copy.

The scene is presentation context only. Purchased-product proof continues to come from real captures and approved device plates.

## Deterministic render flow

```text
base.png
  -> title-style.json + geometry.json
  -> deterministic monitor title drawn with PackRat fonts
  -> PackRat repository logo
  -> approved XENEON hardware plate
  -> real Playwright-captured XENEON UI
  -> final 1920x960 hero
```

No image-generation API participates in this path.

## Product integration

Any schema-v2 XENEON product can opt into this scene from its existing `rat-art.json`:

```json
{
  "environment_hero": {
    "enabled": true,
    "scene": "warm-studio-v1",
    "shot": "XL_H.png",
    "title": "PC POWER",
    "accent_title": "METER",
    "subtitle": "for XENEON Edge",
    "accent": "#F27900",
    "brand": true
  }
}
```

The working reference implementation is `widgets/_src/pc-power-meter-pro/rat-art.json`.

## Complete product command

After normal XENEON captures exist, run:

```powershell
python tools/art/render_environment_product.py xeneon pc-power-meter-pro `
  --shots artifacts/marketplace-v2/pc-power-meter-pro/shots `
  --out artifacts/marketplace-v2/pc-power-meter-pro/review
```

That command:

1. runs the existing canonical `rat_art.py` XENEON renderer,
2. preserves the normal showcase/features/settings/sizes gallery,
3. replaces only `1-hero.png` with the warm-studio composition,
4. uses `render_device()` to insert the real captured `XL_H.png` into the approved XENEON device plate,
5. rebuilds the contact sheet and thumbnail sheet after the hero replacement,
6. updates `rat-art-report.json` with scene, source, capture, and output hashes.

## Product geometry

`geometry.json` intentionally gives the XENEON enough vertical room to preserve the calibrated hardware aspect ratio at approximately 96% of the full marketplace canvas width. The product overlaps the lower monitor naturally while the approved title stack remains fully readable above it.

## CI

`.github/workflows/marketplace-listing-v2-ci.yml` uses the environment-product integration automatically for `pc-power-meter-pro` while the other prototype products continue through ordinary Marketplace Listing V2 rendering.

`.github/workflows/marketplace-environment-hero-preview.yml` is a focused environment-only validation workflow for the same product.

## Stream Deck

The scene/monitor layer is reusable for Stream Deck, but truthful Stream Deck compositing still requires an approved calibrated Stream Deck hardware plate/key geometry. Do not substitute generated or approximate hardware for that missing calibration.
