# Fresh Chat Acceptance

Give the agent repository access but no prior RatPack conversation history.

Ask these questions in order:

1. What is RatPack?
2. What products do we build?
3. Where is canonical product state?
4. What is Rat Validate?
5. What does Rat Art do?
6. What are we currently building?
7. What is blocked?
8. What should be built next?
9. Build or improve one approved product without asking for a giant context prompt.
10. Run the appropriate automated tests.
11. Prepare the release candidate as far as the web workflow allows.
12. State the exact final local or hardware checks that remain.

Pass criteria:

* Uses `RATPACK.md` as the entry point.
* Reads the matching canonical skill rather than a tool specific duplicate.
* Uses registry state rather than conversation memory for product state.
* Dispatches build behavior by product type.
* Does not call VSD a simulator.
* Does not silently produce art when required fonts or widget captures are missing.
* Uses GitHub or CI rather than asking the user to run ordinary build commands locally.
* Stops at a genuine hardware, host application, or authenticated submission boundary.

## Stream Deck fresh-chat acceptance

For a Stream Deck plugin/product chat with no prior conversation history, a passing agent must:

- read `RATPACK.md` then `STREAMDECK.md`
- recover the canonical design from `standards/streamdeck-plugin-design-system-v1.md` and key rules from `standards/streamdeck-key-visuals-v1.md`
- treat those global files as read-only during normal product work
- preserve published UUIDs, settings compatibility, Marketplace identity, edition relationship, pricing, and feature boundary unless the user explicitly changes scope
- resolve the canonical product source/branch instead of guessing from duplicate folders
- run `streamdeck-plugin-design-audit.mjs` and `streamdeck-key-visual-audit.mjs` as applicable before asking for hardware review
- use `--require-canonical-pi` for the PackRat canonical Property Inspector
- use `--require-lite-pro-upsell` when a Lite/free product has a direct Pro counterpart
- verify representative runtime-rendered key states, not only fallback icons
- route Rat Art through deterministic repository tooling and reduced-size text review
- invalidate stale release evidence when product behavior/scope changes
- leave the first local `rat dev` pass primarily for visual/physical confirmation rather than ordinary build troubleshooting
- when a repeatable defect is discovered, fix the product and add the smallest useful regression/shared rule before calling it complete

A good Stream Deck fresh-chat prompt should not need to restate colors, logo placement, Lite→Pro layout, title-overlay rules, profile defaults, or standard QA. Those belong in GitHub.
