/**
 * Tap versus hold, for keys that have somewhere to go as well as something to do.
 *
 * Stream Deck reports key down and key up but not how long a key was held, so the two events are
 * paired here. Every tracker key already does something useful on a tap (cycle, refresh), and each
 * one also knows a web page for whatever it is currently showing. Hiding that page behind a
 * settings toggle meant choosing one or the other; holding gets both on the same key with nothing
 * to configure.
 *
 * The action must move from onKeyDown to onKeyUp for this to work, which costs the tap nothing
 * perceptible and is how every long-press on a touch surface behaves anyway.
 */

/** Long enough not to fire on a normal tap, short enough not to feel like a wait. */
export const HOLD_MS = 450;

const downAt = new Map<string, number>();

/** Call from onKeyDown. */
export function markDown(id: string): void {
	downAt.set(id, Date.now());
}

/**
 * Call from onKeyUp: true when the key was held rather than tapped.
 *
 * Consumes the timestamp, so a key up with no matching key down (which happens when a page
 * changes mid-press) reads as a tap rather than inheriting an old press.
 */
export function wasHeld(id: string, nowMs: number = Date.now()): boolean {
	const started = downAt.get(id);
	downAt.delete(id);
	return started !== undefined && nowMs - started >= HOLD_MS;
}

/** Call from onWillDisappear, so a key removed mid-press leaves nothing behind. */
export function forgetPress(id: string): void {
	downAt.delete(id);
}
