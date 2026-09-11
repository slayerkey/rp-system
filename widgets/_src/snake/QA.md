# Snake QA Contract

## Product
- Slug: `snake`
- Version: `1.0.1`
- Price: free
- Network dependency: none
- Account/API key/helper app: none
- Optional host integration: official iCUE Link Provider for the PackRat Marketplace creator link in the non-gameplay overlay

## Canonical layouts
- S H: 840 × 344, 32 × 11 grid
- S V: 696 × 416, 24 × 12 grid
- M H: 840 × 696, 24 × 18 grid
- M V: 696 × 840, 18 × 24 grid
- L H: 1688 × 696, 42 × 16 grid
- L V: 696 × 1688, 16 × 42 grid
- XL H: 2536 × 696, 64 × 16 grid
- XL V: 696 × 2536, 16 × 64 grid

## Automated gate
`node widgets/_src/snake/verify.mjs .`

The verification script covers all eight sizes, overflow, canvas visibility, pause, resume, restart, keyboard arrow input, keyboard reverse-direction protection, touch zones, swipe input, fast repeated input, reverse prevention, wall collision, self collision, legal tail-vacate movement, eating and growth, food spawning, exactly-one-free-cell spawning, full-board completion, score persistence, high-score persistence, browser preview operation, runtime errors and a 300-draw rendering benchmark.

The canonical XENEON CI then regenerates the inline shipping build, runs the official CORSAIR CLI validator and packager, and opens the packaged `.icuewidget` through StreamSpell across all eight official presets.

## Performance contract
The game is event driven. It does not run a continuous animation frame loop. Movement advances from 205 ms per step at level 1 down to 68 ms per step at level 10. The browser benchmark uses a conservative 16 ms average draw regression ceiling.

## Physical confidence checks
Physical XENEON Edge testing is optional under the current RatPack release gate. If hardware is available, verify swipe threshold and directional-zone feel, accidental touch resistance, desk-distance visibility, exact iCUE touch hit testing, OLED contrast, pause/restart ergonomics and the creator link opening in the system browser. Keyboard arrows are standard web key events and therefore require the widget webview to have keyboard focus; verify real-iCUE focus behavior when available.
