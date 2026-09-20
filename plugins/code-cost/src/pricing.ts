/**
 * Per-model token rates, USD per million tokens.
 *
 * The single maintenance liability in this plugin (registry risk flag
 * `maintenance:per-model-price-table-drift`). Rates change, models are added, and a stale
 * table silently produces a confidently wrong dollar figure, which is worse than no figure.
 * So: unknown models resolve to `null` and the key shows tokens instead of dollars. Never
 * guess a rate to fill a gap.
 *
 * Anthropic rates verified 2026-08-21 against the bundled claude-api reference.
 * Cache write is 1.25x input and cache read is 0.1x input at the standard 5 minute TTL.
 * OpenAI rates verified 2026-08-21 from public pricing pages.
 */
export type Rate = {
	/** USD per million input tokens. */
	input: number;
	/** USD per million output tokens. */
	output: number;
	/** USD per million tokens written to cache. */
	cacheWrite: number;
	/** USD per million tokens read from cache. */
	cacheRead: number;
};

/** Anthropic publishes cache rates as multiples of the input rate rather than absolutes. */
function anthropic(input: number, output: number): Rate {
	return { input, output, cacheWrite: input * 1.25, cacheRead: input * 0.1 };
}

export const RATES: Record<string, Rate> = {
	// Anthropic. Cache multiples applied above.
	"claude-fable-5": anthropic(10, 50),
	"claude-mythos-5": anthropic(10, 50),
	"claude-opus-5": anthropic(5, 25),
	"claude-opus-4-8": anthropic(5, 25),
	"claude-opus-4-7": anthropic(5, 25),
	"claude-opus-4-6": anthropic(5, 25),
	"claude-sonnet-5": anthropic(3, 15),
	"claude-sonnet-4-6": anthropic(3, 15),
	"claude-haiku-4-5": anthropic(1, 5),

	// OpenAI. Cached input is published directly; there is no separate cache-write charge,
	// so cacheWrite matches the plain input rate.
	"gpt-5.6-sol": { input: 5, output: 30, cacheWrite: 5, cacheRead: 0.5 },
	"gpt-5.6-terra": { input: 2, output: 12, cacheWrite: 2, cacheRead: 0.2 },
	"gpt-5.6-luna": { input: 0.2, output: 1.2, cacheWrite: 0.2, cacheRead: 0.02 }
};

export type Tokens = {
	input: number;
	output: number;
	cacheWrite: number;
	cacheRead: number;
};

/**
 * Resolves a logged model id to a rate. Claude Code writes ids that already match the table;
 * Codex writes `gpt-5.6-sol` style ids. Anything unrecognised returns null on purpose, which
 * the view turns into a token count rather than a dollar amount.
 */
export function rateFor(model: string): Rate | null {
	if (!model) return null;
	const exact = RATES[model];
	if (exact) return exact;
	// Claude Code occasionally appends a date snapshot; the base id is the part before it.
	const base = model.replace(/-\d{8}$/, "");
	return RATES[base] ?? null;
}

/** USD for one turn. Returns null when the model has no known rate. */
export function costOf(model: string, t: Tokens): number | null {
	const r = rateFor(model);
	if (!r) return null;
	return (
		(t.input * r.input + t.output * r.output + t.cacheWrite * r.cacheWrite + t.cacheRead * r.cacheRead) / 1e6
	);
}
