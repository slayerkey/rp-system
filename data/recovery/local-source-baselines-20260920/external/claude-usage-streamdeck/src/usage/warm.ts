// Keeps every switched-on provider polling in the background, whether or not a key for it
// is currently on the deck. Without this a rollup key would show blanks until each provider
// was first placed on its own key, and switching a key to another provider would sit on
// "loading" while that provider made its first request.
import { poller } from "./poller";
import { getEnabledProviders, onChange, resolveAccountToken } from "./token";
import { PROVIDER_IDS } from "../providers/active";

let current = new Map<string, () => void>(); // "provider:token" -> unsubscribe

function desired(): Map<string, [string, string]> {
	const out = new Map<string, [string, string]>();
	for (const id of getEnabledProviders()) {
		if (!PROVIDER_IDS.includes(id)) continue;
		// Empty token is meaningful: providers with a local CLI login auto-load their own.
		const token = resolveAccountToken(id);
		out.set(`${id}:${token}`, [id, token]);
	}
	return out;
}

/** Subscribe to every enabled provider, and re-subscribe whenever that set changes. */
export function startWarmPolling(): void {
	onChange(() => {
		const want = desired();
		for (const [key, off] of current) if (!want.has(key)) off();

		const next = new Map<string, () => void>();
		for (const [key, [id, token]] of want) {
			// The poller already shares one entry per provider+token, so this subscription
			// costs nothing extra when a real key is watching the same pair.
			next.set(key, current.get(key) ?? poller.subscribe(id, token, () => {}));
		}
		current = next;
	});
}
