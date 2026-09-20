export function formatNum(n: number): string {
	if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 1 : 2)}B`;
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
	if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
	if (n >= 1_000) return n.toLocaleString("en-US");
	return String(Math.round(n));
}

export function formatDelta(n: number): string {
	if (n > 0) return `+${formatNum(n)}`;
	if (n < 0) return `-${formatNum(Math.abs(n))}`;
	return "0";
}

export function formatFull(n: number): string {
	return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatDuration(startedAt: string): string {
	const ms = Date.now() - new Date(startedAt).getTime();
	if (ms < 0) return "0:00";
	const totalSecs = Math.floor(ms / 1000);
	const h = Math.floor(totalSecs / 3600);
	const m = Math.floor((totalSecs % 3600) / 60);
	const s = totalSecs % 60;
	const mm = String(m).padStart(2, "0");
	const ss = String(s).padStart(2, "0");
	return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function fitFont(text: string, maxWidth: number, maxSize: number, minSize = 18): number {
	return Math.max(minSize, Math.min(maxSize, Math.floor(maxWidth / (text.length * 0.62))));
}
