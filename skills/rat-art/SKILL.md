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

## Required preflight

Verify canonical engine imports, required source assets, brand logo, device plate, required widget captures, and exact brand font resolution.

Missing brand typography is an error. Never silently fall back to Pillow's default bitmap font for marketplace output.

## Review

Run deterministic QA, inspect every candidate hero and contact sheet, and record visual review results.

Judge title legibility, hierarchy, device dominance, contextual recognition, crop quality, clutter, accidental branding, text bounds, gallery sequencing, footer branding, divider consistency, feature-list usefulness, and marketplace polish.

If the candidate fails, make one evidence based correction pass before reporting the blocker.
