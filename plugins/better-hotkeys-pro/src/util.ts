/** Awaitable delay, for the scripted multi-step actions (radial, drag). */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/** Clamps a number into a range, treating non-finite input as the low bound. */
export function clamp(value: number, lo: number, hi: number): number {
	if (!Number.isFinite(value)) return lo;
	return Math.min(hi, Math.max(lo, value));
}
