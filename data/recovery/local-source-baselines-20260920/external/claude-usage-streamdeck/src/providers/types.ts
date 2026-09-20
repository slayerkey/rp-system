// Provider abstraction: the shared engine renders/polls generic "windows"; each provider
// (Claude, ChatGPT, Codex, Cursor) is a thin adapter. One adapter is selected per build
// to produce a separate, name-targeted Marketplace product.

export interface WindowData {
	key: string;
	label: string; // short, e.g. "5H", "WEEK", "MONTH"
	utilization: number; // 0..100; not meaningful when `count` or `unlimited` is set
	resetsAt?: string; // ISO-8601
	count?: number; // a raw balance (credits) that has no denominator to be a percentage of
	unlimited?: boolean; // the balance is unbounded
}

export interface Usage {
	windows: WindowData[]; // ordered; [0] is the primary/session window
}

export type FetchResult =
	| { ok: true; usage: Usage }
	| { ok: false; status: number; reason: "auth" | "rate-limited" | "blocked" | "error"; detail?: string };

export interface WindowDef {
	key: string;
	label: string;
	cyclable: boolean; // included in the long-press window cycle
	naLines?: [string, string]; // shown when this account has no such window; default "not"/"available"
}

export interface Provider {
	id: string; // "claude" | "openai" | "codex" | "cursor"
	displayName: string; // "Claude"
	brand: string; // hex accent used on state screens
	windows: WindowDef[]; // all selectable windows (for the property inspector)
	defaultWindow: string;
	fetchUsage(token: string): Promise<FetchResult>;
	autoLoadToken?(): string | undefined; // zero-config token from local CLI creds, if any
}
