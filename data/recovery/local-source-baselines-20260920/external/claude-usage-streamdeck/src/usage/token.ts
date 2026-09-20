// Shared global settings: named accounts (each a session token) per provider, the refresh
// interval, and the older single-provider shapes kept readable for back-compat. Pasted once,
// used by every key.
import streamDeck from "@elgato/streamdeck";
import { BUILD } from "../providers/active";

export type Account = {
	name: string;
	token: string;
};
type Global = {
	token?: string; // oldest shape: one bare token
	accounts?: Account[]; // single-provider shape: accounts for this build's provider
	providerAccounts?: Record<string, Account[]>; // combined shape: accounts per provider id
	enabledProviders?: string[];
	interval?: string;
	demo?: boolean;
};

let providerAccounts: Record<string, Account[]> = {};
let enabledProviders: string[] = [];
let intervalMs = 120_000;
let demo = false;
const listeners = new Set<() => void>();

function parseInterval(s?: string): number {
	const n = Number(s);
	return Number.isFinite(n) && n >= 10 ? n * 1000 : 120_000;
}

export function getIntervalMs(): number {
	return intervalMs;
}

/** Demo mode: render sample data instead of polling, so the plugin can be shown
 *  working without an account. Set from the Property Inspector. */
export function isDemo(): boolean {
	return demo;
}

/** Accounts configured for one provider. */
export function accountsFor(providerId: string): Account[] {
	return providerAccounts[providerId] ?? [];
}

/** Providers the user has switched on. Empty means "not configured yet". */
export function getEnabledProviders(): string[] {
	return enabledProviders;
}

/** Resolve the session token for a provider's account name; falls back to its first account. */
export function resolveAccountToken(providerId: string, name?: string): string {
	const list = accountsFor(providerId);
	if (name) {
		const a = list.find((x) => x.name === name);
		if (a) return a.token.trim();
	}
	return (list[0]?.token ?? "").trim();
}

export function onChange(listener: () => void): () => void {
	listeners.add(listener);
	listener();
	return () => {
		listeners.delete(listener);
	};
}

function clean(list: unknown): Account[] {
	return Array.isArray(list) ? (list as Account[]).filter((a) => a && typeof a.token === "string") : [];
}

/**
 * Read whichever settings shape is on disk.
 *
 * An installed single-provider plugin still holds the flat `accounts` (or bare `token`) shape,
 * so those are folded in under this build's own provider id. Without this an existing customer
 * would open the plugin after an update and find their pasted token gone.
 */
function apply(g: Global): void {
	const byProvider: Record<string, Account[]> = {};
	for (const [id, list] of Object.entries(g.providerAccounts ?? {})) byProvider[id] = clean(list);

	if (!byProvider[BUILD.id]?.length) {
		const legacy = clean(g.accounts);
		const bare = g.token?.trim();
		if (legacy.length) byProvider[BUILD.id] = legacy;
		else if (bare) byProvider[BUILD.id] = [{ name: "Default", token: bare }];
	}

	providerAccounts = byProvider;
	enabledProviders = Array.isArray(g.enabledProviders) ? g.enabledProviders.filter((s) => typeof s === "string") : [];
	intervalMs = parseInterval(g.interval);
	demo = g.demo === true;
	for (const l of listeners) l();
}

export async function initTokenStore(): Promise<void> {
	streamDeck.settings.onDidReceiveGlobalSettings<Global>((ev) => apply(ev.settings));
	try {
		apply(await streamDeck.settings.getGlobalSettings<Global>());
	} catch {
		/* connection not ready yet — the listener above will deliver it */
	}
}
