import type { InputMode } from "./input";

/**
 * Settings shape shared by Hold Key and Toggle Key.
 *
 * `keys` is an array of objects rather than bare numbers so a future scancode-first
 * key model can add `sc`/`ext` fields additively, without migrating stored settings.
 *
 * The list of pickable keys lives in the property inspector (ui/keys.js), not here --
 * the plugin never needs to know what a key is called, only which VK to send.
 */
export type KeySettings = {
	keys?: { vk: number }[];
	mode?: InputMode;
};

export function vksFrom(settings: KeySettings): number[] {
	return (settings.keys ?? []).map((k) => k.vk).filter((vk) => Number.isInteger(vk) && vk > 0);
}

/** A single hotkey as the profile builder emits it: one main key plus a modifier bitmask. */
export type Hotkey = { vk?: number; modifiers?: number };

/** Bit values for Hotkey.modifiers, shared with the profile builder (see common.py). */
export const MODIFIER_BITS = { shift: 1, ctrl: 2, alt: 4, cmd: 8 } as const;

/** Left-side modifier VKs, matching the convention already used by keys.js's recorder. */
const MODIFIER_VKS_WIN = { shift: 0xa0, ctrl: 0xa2, alt: 0xa4, cmd: 0x5b };

/** Carbon HIToolbox kVK_* modifier codes -- stable across macOS versions. */
const MODIFIER_VKS_MAC = { shift: 0x38, ctrl: 0x3b, alt: 0x3a, cmd: 0x37 };

/**
 * Expands a {vk, modifiers} pair into an ordered VK list: modifiers first, then the main
 * key, so pressing them in order and releasing in reverse arrives as a real chord (e.g.
 * Shift+Right, not Right followed by a separate Shift). Used by Encoder Hotkey, which
 * takes a bitmask instead of Hold/Toggle Key's own discrete `keys` array.
 */
export function expandHotkey(hotkey: Hotkey | undefined): number[] {
	if (!hotkey || !Number.isInteger(hotkey.vk) || (hotkey.vk as number) <= 0) return [];

	const table = process.platform === "darwin" ? MODIFIER_VKS_MAC : MODIFIER_VKS_WIN;
	const bits = hotkey.modifiers ?? 0;
	const mods: number[] = [];
	if (bits & MODIFIER_BITS.shift) mods.push(table.shift);
	if (bits & MODIFIER_BITS.ctrl) mods.push(table.ctrl);
	if (bits & MODIFIER_BITS.alt) mods.push(table.alt);
	if (bits & MODIFIER_BITS.cmd) mods.push(table.cmd);
	return [...mods, hotkey.vk as number];
}
