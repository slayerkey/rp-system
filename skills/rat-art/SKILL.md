---
name: rat-art
description: Research, stage, render, and visually review PackRat marketplace artwork using deterministic repository tooling only. Never use ImageGen or any image-generation provider for Rat Art.
---

# Rat Art

Rat Art is a repository pipeline, not chat image generation.

## Non-negotiable execution rule

When the user invokes `/rat-art`, asks to use Rat Art, or asks to regenerate marketplace art through the Rat Art pipeline, **do not call ChatGPT image generation, ImageGen, DALL-E, an image API, or any other generative image provider**.

Run the canonical deterministic repository tooling instead. For XENEON widgets the executable path is `tools/art/rat_art.py` plus `tools/art/capture_xeneon.mjs`, normally through the canonical Rat Ship or Rat Art workflow.

If the deterministic pipeline is missing a required asset or capture, fail and fix or migrate that dependency. Never substitute generated artwork.

Read the product, validation evidence, product metadata, brand standards, art reproducibility contract, and applicable platform reference.

## Safety model

Treat live product `marketing/` folders and submitted ship kits as immutable while creating a candidate.

Create an isolated review job or CI artifact for candidate sources, rendered output, provenance, deterministic QA, and visual review.

Do not promote candidate files into live marketing during this skill. Promotion is a separate approved operation.

## Nonwidget products

Use first party contextual screenshots where the current product style calls for context. Preserve source provenance and reject low resolution or unsuitable source images.

Keep PackRat text, device plates, icons, key faces, badges, and layouts deterministic.

Do not use generated images for product keys, text, device representations, marketplace screenshots, or contextual plates.

## Stream Deck products

For Stream Deck marketplace heroes, use the shared deterministic photo compositor at `tools/art/streamdeck_photo.py` with the approved `streamdeck-mk2-straight.png` hardware plate and its calibrated LCD map.

The MK.2 plate is an overlay, not a canvas to paint on. Product key art belongs on an underlay behind the plate's real transparent LCD windows. The untouched photographed hardware goes on top so the physical bezel, rounded glass edge, reflections, chassis, and lighting remain authentic.

Detect the 15 LCD windows from the source PNG alpha channel inside calibrated physical button bounds. Cached LCD bounds are regression evidence only, not the rendering mask. Fill every detected LCD pixel with an opaque screen underlay plus a small under-bezel safety bleed before placing product content. Rat Art must fail unless exactly 15 LCDs are detected and uncovered LCD pixels equal zero.

Transparent key art must be alpha-trimmed and contained automatically. Its transparency reveals the intentional LCD background, never the warm-studio scene. Opaque key-face art fills the detected LCD region. Never paste product pixels over the physical button rim or compensate for a bad fit by covering a finished hero with a dark matte.

Stream Deck hero typography must use the same deterministic font resolver and warm-studio white/orange hierarchy as the approved XENEON hero system.

### Stream Deck gallery conversion rule

The Stream Deck cover and gallery have different jobs. The cover earns the click. The four product-local gallery frames must sell the workflow after the click.

Default Stream Deck gallery sequence:

1. **Pain removed / core outcome** — show the annoying task the product eliminates and the one-sentence payoff.
2. **Best differentiator** — show the capability that makes this meaningfully better than a basic shortcut or the Lite edition.
3. **Concrete workflow proof** — real controls, modes, profiles, or states that demonstrate what the buyer can actually do.
4. **High-frequency interaction or upgrade story** — dials, repeated daily use, multi-device depth, or a clear Lite→Pro comparison.

Do not lead a Stream Deck gallery with implementation details such as capability parsing, API safety, DDC terminology, profile-file formats, or “starter profiles included” unless that is genuinely the primary buying reason. Those belong later in the listing, documentation, or Property Inspector.

Use the canonical PackRat orange-yellow `#FFB21E` as the default marketplace accent. Green is reserved for true success/healthy/connected states and must not become the dominant gallery accent.

The Maker Console may include the separate Thumbnail in its own carousel preview. Product-local Rat Art still emits exactly four gallery files and must never intentionally duplicate the cover as one of them.

## XENEON and iCUE widget products

`standards/xeneon-marketplace-hero-v1.md` is the approved XENEON hero standard. For catalogued XENEON products, the hero uses the deterministic `warm-studio-v1` environment, a real `XL_H` product capture, the approved transparent XENEON Edge hardware plate, a large product name on the background monitor, and the PackRat rat/package mark in the upper-right. The approved mark is rendered at twice the original September prototype size for clearer browsing-scale brand recognition.

Do not substitute a contextual background for the real widget.

First build the widget and run deterministic browser captures at the required native sizes. Art preflight must fail if those captures are absent.

Composite the real capture into the approved XENEON device plate using the calibrated mapping.

The capture gate must test glyph safety for clipped descenders and other text-bound failures before the marketplace art is rendered.

### Shared marketplace composition defaults

These are repository defaults for future XENEON Rat Art and should not be reimplemented product by product.

1. Footer center branding is the PackRat rat logo only. Do not render the `PACKRAT` wordmark beside it. Hero frames may still keep useful platform labels such as `iCUE WIDGET` and `CORSAIR XENEON EDGE` at the sides.
2. Marketplace sequence is cover first, then the detailed feature or value breakdown, then the broader product showcase, then settings or interaction states, then size compatibility. The gallery should teach more as the customer moves forward rather than repeat the cover.
3. Treat the sequence as a conversion funnel. The cover earns the click. Gallery 01 should answer `What do I get and why would I want this?` at a glance. Later frames should prove the most important experience, remove setup or usability doubts, demonstrate customization or depth, and finish with compatibility confidence.
4. Gallery 01 should normally contain three or four outcome-led feature/value points. Lead with what materially changes the user experience. Prefer the core use case, controls or workflow, persistence/progression, useful customization, or a meaningful Pro advantage. Do not spend prime feature-list space on low-value implementation trivia such as `zero upkeep`, `runs locally`, or `no account` unless setup friction is genuinely one of the main buying objections.
5. Search/app icons are utility assets, not gallery content. Never create or intentionally upload a logo-only or icon-only gallery frame. If there is no dedicated marketplace icon field, the icon should simply remain a package/search asset.
6. Cover and gallery frames must be distinct. Rat Ship should fail if any generated marketplace image is byte identical to another listing image.
7. Labels beneath screenshots need a visible safety gap from the screenshot frame. Never place a label directly on the screenshot edge.
8. Multi-panel settings and size frames use the shared lower divider and a dedicated footer copy band. Labels stay above the divider, footer copy stays below it, and neither should collide with the main Rat Art footer.
9. The Rat Art contact sheet should follow marketplace viewing order so visual review catches sequencing problems before shipping.

### Feature breakdown copy test

Before accepting Gallery 01, read only its title and feature points and ask whether a customer can understand the product's practical value without seeing the rest of the listing.

For a game, stronger feature points are usually things like display fit, controls, difficulty/progression, persistence, replayability, or meaningful presentation options. For a utility, prioritize the core job, saved time or visibility, important live data, history/persistence, quick controls, and the feature that most clearly separates Lite from Pro.

Use setup convenience as supporting copy unless setup simplicity is itself the product's main advantage.

## Marketplace text safety

All customer-facing Rat Art prose must be laid out inside explicit bounding boxes with the shared helper at `tools/art/marketplace_text.py`.

- use `draw_fitted_text(...)` for card descriptions, subtitles, explanatory copy, and any text that can wrap
- let the helper choose the largest safe font size inside the declared box
- wrapping must preserve the full copy; do not silently truncate or clip
- if the copy cannot fit at the declared minimum readable size, Rat Art must fail closed
- do not use raw Pillow `multiline_text(...)` for marketplace prose
- prefer fewer, larger cards over many narrow cards when the listing is expected to be judged at thumbnail size
- inspect gallery frames at 480×240, 320×160, and 240×120; if text becomes decorative noise instead of useful information, simplify the layout or increase the content scale

This rule exists specifically to prevent text from crossing card boundaries or becoming unreadable after Marketplace downsizing.

## Required preflight

Verify canonical engine imports, required source assets, brand logo, device plate, required widget captures, and exact brand font resolution.

Missing brand typography is an error. Never silently fall back to Pillow's default bitmap font for marketplace output.

## Review

Run deterministic QA, inspect every candidate hero and contact sheet, and record visual review results.

Judge title legibility, hierarchy, device dominance, contextual recognition, crop quality, clutter, accidental branding, text bounds, gallery sequencing, footer branding, divider consistency, feature-list usefulness, and marketplace polish.

If the candidate fails, make one evidence based correction pass before reporting the blocker.
