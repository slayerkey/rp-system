import type { DataProvider, Quote } from "./provider";
import { RateLimitError } from "./provider";

export type QuoteResult = Quote | { error: string };
type Subscriber = (result: QuoteResult) => void;

export type PollerOptions = {
	creditsPerMinute: number;
	/** True if each symbol costs a credit (Finnhub); false if one request covers all (CoinGecko). */
	costPerSymbol?: boolean;
	/** True if the channel needs an API key before it can fetch. */
	requiresKey?: boolean;
	/** Called with every successful quote, for persistence. */
	onQuote?: (symbol: string, quote: Quote) => void;
};

const TICK_MS = 3000;
const BACKOFF_MS = 60_000;
const MAX_BATCH = 120;

/**
 * Central poller for one data channel. All keys watching the same symbol share a
 * single subscription, and subscribed symbols are fetched together each tick. A
 * token bucket caps spend at `creditsPerMinute`; rate-limit responses back off.
 */
export class Poller {
	private readonly subs = new Map<string, Set<Subscriber>>();
	private readonly last = new Map<string, { quote?: Quote; fetchedAt: number }>();
	private readonly costPerSymbol: boolean;
	private readonly requiresKey: boolean;
	private tokens: number;
	private lastRefill = Date.now();
	private backoffUntil = 0;
	private timer?: ReturnType<typeof setInterval>;

	constructor(
		private readonly provider: DataProvider,
		private readonly getApiKey: () => string | undefined,
		private readonly getMinIntervalMs: () => number,
		private readonly opts: PollerOptions,
	) {
		this.tokens = opts.creditsPerMinute;
		this.costPerSymbol = opts.costPerSymbol ?? true;
		this.requiresKey = opts.requiresKey ?? true;
	}

	/** Seed a cached quote (e.g. from disk) so a new subscriber renders instantly. */
	prime(symbol: string, quote: Quote): void {
		if (!this.last.has(symbol)) {
			this.last.set(symbol, { quote, fetchedAt: 0 });
		}
	}

	subscribe(symbol: string, cb: Subscriber): () => void {
		let set = this.subs.get(symbol);
		if (!set) {
			set = new Set();
			this.subs.set(symbol, set);
			if (!this.last.has(symbol)) {
				this.last.set(symbol, { fetchedAt: 0 });
			}
		}
		set.add(cb);

		const cached = this.last.get(symbol)?.quote;
		if (cached) {
			safeEmit(cb, cached);
		}
		this.ensureRunning();

		return () => {
			const current = this.subs.get(symbol);
			if (current) {
				current.delete(cb);
				if (current.size === 0) {
					this.subs.delete(symbol);
					// Keep last value cached for a fast re-subscribe; only drop subscribers.
				}
			}
			if (this.subs.size === 0) {
				this.stop();
			}
		};
	}

	private ensureRunning(): void {
		if (!this.timer) {
			this.lastRefill = Date.now();
			this.timer = setInterval(() => void this.tick(), TICK_MS);
			void this.tick();
		}
	}

	private stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	private refill(): void {
		const now = Date.now();
		const elapsed = now - this.lastRefill;
		this.lastRefill = now;
		this.tokens = Math.min(this.opts.creditsPerMinute, this.tokens + elapsed * (this.opts.creditsPerMinute / 60_000));
	}

	private async tick(): Promise<void> {
		this.refill();
		if (Date.now() < this.backoffUntil) {
			return;
		}
		if (this.subs.size === 0) {
			this.stop();
			return;
		}

		const key = this.getApiKey();
		if (this.requiresKey && !key) {
			this.broadcastNew({ error: "Add free API key" });
			return;
		}

		const minInterval = this.getMinIntervalMs();
		const now = Date.now();
		const eligible = [...this.subs.keys()]
			.filter((s) => now - (this.last.get(s)?.fetchedAt ?? 0) >= minInterval)
			.sort((a, b) => (this.last.get(a)?.fetchedAt ?? 0) - (this.last.get(b)?.fetchedAt ?? 0));

		if (eligible.length === 0) {
			return;
		}

		// Cost is the whole batch (per-symbol) or a single request (per-request).
		const budget = Math.floor(this.tokens);
		const maxSymbols = this.costPerSymbol ? Math.min(budget, MAX_BATCH) : MAX_BATCH;
		if (this.costPerSymbol && budget < 1) {
			return;
		}
		if (!this.costPerSymbol && this.tokens < 1) {
			return;
		}

		const batch = eligible.slice(0, maxSymbols);
		this.tokens -= this.costPerSymbol ? batch.length : 1;

		try {
			const quotes = await this.provider.getBatchQuotes(batch, key ?? "");
			const t = Date.now();
			for (const s of batch) {
				const resolved = quotes.get(s);
				if (resolved) {
					this.last.set(s, { quote: resolved, fetchedAt: t });
					this.opts.onQuote?.(s, resolved);
					this.emit(s, resolved);
				} else {
					const cached = this.last.get(s)?.quote;
					this.last.set(s, { quote: cached, fetchedAt: t });
					this.emit(s, cached ?? { error: "Unknown symbol" });
				}
			}
		} catch (e) {
			if (e instanceof RateLimitError) {
				this.backoffUntil = Date.now() + BACKOFF_MS;
				this.broadcastNew({ error: "Rate limited" });
			} else {
				const message = e instanceof Error ? truncate(e.message) : "Error";
				for (const s of batch) {
					const cached = this.last.get(s)?.quote;
					this.emit(s, cached ?? { error: message });
				}
			}
		}
	}

	private emit(symbol: string, result: QuoteResult): void {
		const set = this.subs.get(symbol);
		if (!set) {
			return;
		}
		for (const cb of set) {
			safeEmit(cb, result);
		}
	}

	/** Emit a status only to symbols that have no cached value yet (avoid clobbering good data). */
	private broadcastNew(result: QuoteResult): void {
		for (const [symbol, set] of this.subs) {
			if (this.last.get(symbol)?.quote) {
				continue;
			}
			for (const cb of set) {
				safeEmit(cb, result);
			}
		}
	}
}

function safeEmit(cb: Subscriber, result: QuoteResult): void {
	try {
		cb(result);
	} catch {
		// A failing subscriber must not break the poll loop.
	}
}

function truncate(message: string): string {
	return message.length > 24 ? `${message.slice(0, 23)}…` : message;
}
