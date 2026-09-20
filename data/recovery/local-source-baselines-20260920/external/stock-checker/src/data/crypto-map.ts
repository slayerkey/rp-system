// Maps common crypto tickers to their CoinGecko ids. Unknown tickers fall back to
// the lowercased symbol, which matches many CoinGecko ids directly.
const COIN_IDS: Record<string, string> = {
	BTC: "bitcoin",
	ETH: "ethereum",
	SOL: "solana",
	XRP: "ripple",
	DOGE: "dogecoin",
	ADA: "cardano",
	BNB: "binancecoin",
	LTC: "litecoin",
	DOT: "polkadot",
	LINK: "chainlink",
	MATIC: "matic-network",
	AVAX: "avalanche-2",
	TRX: "tron",
	SHIB: "shiba-inu",
	UNI: "uniswap",
	ATOM: "cosmos",
};

export function tickerToCoinId(raw: string): string {
	const ticker = coinDisplay(raw);
	return COIN_IDS[ticker] ?? ticker.toLowerCase();
}

export function coinDisplay(raw: string): string {
	return raw.toUpperCase().replace("/USD", "").replace("USD", "").trim();
}
