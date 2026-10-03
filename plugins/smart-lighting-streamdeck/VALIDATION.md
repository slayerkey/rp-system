# Product validation — 2026-10-02
**Customer job:** one Stream Deck layout should control the supported Hue and Govee lights together, especially during recurring work/game/sleep workflows, without switching provider plugins or repeatedly pairing bulbs.

**Marketplace alternatives:** Elgato Philips Hue and Felix Geelhaar Govee Light Management are both free brand-specific plugins on Elgato Marketplace. Basic toggles alone do not support a paid product.
**Differentiator:** shared cross-provider favorites, one mixed-brand profile, capability-aware device selection, local companion protocol shared with existing PackRat XENEON product, supported Hue scene/room/zone and Govee device control, Plus dials and optional read-only Neo Infobar.
**Price hypothesis:** $9.99 standalone because paid differentiation requires valuable mixed-brand setup; re-evaluate after operator tests. Search/popularity and sales conversions require new Marketplace snapshot before pricing becomes established evidence.
**Engineering feasibility:** existing XENEON companion v1 already performs secured normalization, pairing, UDP/cloud client logic and single-process multi-client WebSocket. Stream Deck uses a separate origin-less local Node WebSocket client, preserving current file/null-only browser origin allowlist. No new credential storage or network provider integrations.
**Risks:** free alternatives, local Windows companion install friction, vendor device capability differences, missing per-command correlation in v1 protocol, physical compatibility testing.
**Decision:** implement minimal plugin candidate for validation; no submission or publisher approval implied.
