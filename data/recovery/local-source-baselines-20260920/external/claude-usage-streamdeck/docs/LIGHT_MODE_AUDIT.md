# Handoff: light/dark theme audit for the usage key renderer

Reported by a customer, 2026-08-11: some key styles do not work in light mode.
Paste the prompt below into a fresh chat in `claude-usage-streamdeck`.

---

## PROMPT

```
Audit and fix light/dark theme support across every key style in the Packrat AI
usage Stream Deck plugins. A customer reported that some styles are unreadable in
light mode.

All rendering is SVG built in src/render/svg.ts, with tokens in src/render/themes.ts.
There are three themes and eight styles:

  THEMES   oled (#000000)  midnight (#0C0C0E)  light (#F4F4F6)
  STYLES   ring  full  number  bigdate  countdown  sparkline  heatmap  status

ONE CONFIRMED BUG, already located, fix it first:

  src/render/svg.ts, in ring(), the reset line at the bottom of the key:
      (reset ? txt(72, 132, fitFont(reset, 92, 17), 700, "#FFFFFF", reset) : "")
  The fill is hardcoded "#FFFFFF" but ring() draws on the THEMED background via
  frame(o.theme, ...). On the light theme that background is #F4F4F6, so the reset
  time is white on near-white and effectively invisible. Every other text in ring()
  correctly uses t.sub, t.text or the threshold colour. It should almost certainly
  be t.sub, matching the label directly above it.

DO NOT "fix" these, they are correct as written:

  full() and countdown() also hardcode #FFFFFF, but both pass FILL_BG (#0A0A0C) as
  an explicit background override, so they draw white on a dark vessel on every
  theme by design. The txtShadow() helper is white-on-dark-shadow for the same
  reason. Changing these to themed colours would break the water-fill styles.
  The rule is: hardcoded white is only a bug when the frame uses the THEMED
  background rather than FILL_BG.

WHAT TO DO

1. Fix the ring() bug above.
2. Audit the other seven styles the same way: for each, determine whether it draws
   on t.bg or on FILL_BG, then check every fill and stroke in it. Flag any literal
   colour that is not threshold-derived and not on a fill vessel. Check strokes and
   opacities too, not just text: a stroke="${t.text}" at low opacity can vanish on
   light even when the token is right.
3. Also check renderMessage() (the error/no-token/loading states). A customer who
   cannot read "Signed out" on light mode has no idea why the key is blank.
4. Contrast, not just "is it themed": the light theme's sub colour is #6E6E78 on
   #F4F4F6. Verify small text still clears roughly 4.5:1. Report anything that
   does not rather than silently restyling it.

VERIFY BY RENDERING, NOT BY READING

Do not hand back a diff you have only eyeballed. renderKey() returns a data: URI, so
write a scratch script that renders the full matrix (8 styles x 3 themes, plus the
message states) and decodes each to a PNG. Then actually LOOK at the light column.
Report a table of style x theme with pass/fail, and say plainly which ones you
inspected visually versus only reasoned about.

Useful inputs: a mid value (~45%), a critical one (~92%), one with resetsAt set and
one without, and one with no history so sparkline shows its "collecting…" state.

WHEN IT IS FIXED

  npx tsc --noEmit
  node scripts/build-provider.mjs <id>     for each of:
      claude codex openai cursor gemini copilot grok perplexity

Then STOP. Do not submit anything to the Marketplace. Report what changed, which
listed plugins are affected, and let the owner decide what ships.

CONTEXT YOU WILL NEED

  - One shared src/ tree is stamped into a separate plugin per provider by
    scripts/build-provider.mjs. A renderer fix therefore affects ALL of them and
    each needs rebuilding.
  - src/usage/bridge.ts is new as of 2026-08-11 and unrelated to this work. Leave
    it alone; it serves GET /usage for the Packrat AI Usage iCUE widget.
```
