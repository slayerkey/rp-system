/** Format a USD price; crypto allows more decimals for sub-dollar coins. */
export function formatPrice(n: number, crypto = false): string {
	if (!Number.isFinite(n)) {
		return "--";
	}
	const abs = Math.abs(n);
	const decimals = crypto ? (abs < 1 ? 5 : abs < 100 ? 3 : 2) : 2;
	return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatPct(n: number): string {
	return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/** Signed USD amount for position P/L, e.g. "+$1,240" or "-$310". */
export function formatMoney(n: number): string {
	const sign = n >= 0 ? "+" : "-";
	return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Coerce inspector values (often strings) to a finite number, or undefined. */
export function toNumber(value: unknown): number | undefined {
	if (value === undefined || value === null || value === "") {
		return undefined;
	}
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}
