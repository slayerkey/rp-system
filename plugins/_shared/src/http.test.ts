/**
 * The network behaviour of the ESPN client: request shape and rate-limit backoff.
 *
 * This is the half of espn.ts that fixtures cannot reach, and it is the half that decides whether
 * a deck spanning eleven leagues is affordable or gets the hidden API to start refusing us. The
 * global fetch is stubbed, so nothing here touches the network.
 *
 * Run: npm test
 */
import assert from "node:assert/strict";

import { fetchScoreboardJson, isBackingOff, resetHttpState } from "./espn";

type Call = { url: string; headers: Record<string, string> };

let calls: Call[] = [];
/** Queue of canned responses; the stub takes the next one, or the last one forever. */
let queue: { status: number; body?: unknown; etag?: string; retryAfter?: string }[] = [];

function stubFetch(): void {
	calls = [];
	globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
		const headers = Object.fromEntries(
			Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])
		);
		calls.push({ url: String(url), headers });
		const next = queue.length > 1 ? (queue.shift() as (typeof queue)[number]) : queue[0];
		const store: Record<string, string> = {};
		if (next.etag) store.etag = next.etag;
		if (next.retryAfter) store["retry-after"] = next.retryAfter;
		return {
			status: next.status,
			ok: next.status >= 200 && next.status < 300,
			headers: { get: (name: string) => store[name.toLowerCase()] ?? null },
			json: async () => next.body
		};
	}) as unknown as typeof fetch;
}

const NBA = { sport: "basketball", league: "nba" };
const NFL = { sport: "football", league: "nfl" };

// --- request shape --------------------------------------------------------
// Both of these are pinned because the obvious instinct is wrong, verified against the live
// endpoints: a custom User-Agent gets a 403, and no endpoint here returns a cache validator.

resetHttpState();
stubFetch();
queue = [{ status: 200, body: { events: [] } }];
await fetchScoreboardJson(NBA);

assert.equal(calls.length, 1);
assert.equal(calls[0].headers.accept, "application/json");
assert.equal(
	calls[0].headers["user-agent"],
	undefined,
	"no User-Agent: ESPN answers 403 to any request carrying one, and 200 to the same request without"
);
assert.equal(
	calls[0].headers["if-none-match"],
	undefined,
	"no conditional request: these endpoints send neither ETag nor Last-Modified, so there is nothing to echo"
);

// An etag arriving anyway must not change behaviour, since nothing stores one.
queue = [{ status: 200, body: { events: [] }, etag: 'W/"abc"' }];
await fetchScoreboardJson(NBA);
queue = [{ status: 200, body: { events: [] } }];
await fetchScoreboardJson(NBA);
assert.equal(calls[2].headers["if-none-match"], undefined);

// --- rate limiting ---------------------------------------------------------

resetHttpState();
stubFetch();
queue = [{ status: 429 }];
assert.equal(await fetchScoreboardJson(NBA), null, "a rate-limited call yields nothing and the key holds its last value");
assert.equal(isBackingOff(), true);

// The backoff is process-wide: backing off per URL would keep hammering with the other ten leagues.
const before = calls.length;
assert.equal(await fetchScoreboardJson(NFL), null);
assert.equal(calls.length, before, "while backing off, no request leaves the process at all");

resetHttpState();
assert.equal(isBackingOff(), false, "resetting clears the window");

// 503 is what a hidden API returns when it is shedding load, and deserves the same restraint.
stubFetch();
queue = [{ status: 503 }];
await fetchScoreboardJson(NBA);
assert.equal(isBackingOff(), true, "a 503 backs off too, rather than retrying into an overloaded service");

// Retry-After wins when it asks for longer than our own floor.
resetHttpState();
stubFetch();
queue = [{ status: 429, retryAfter: "600" }];
const askedAt = Date.now();
await fetchScoreboardJson(NBA);
assert.equal(isBackingOff(askedAt + 5 * 60_000), true, "a ten minute Retry-After is honoured past our one minute floor");
assert.equal(isBackingOff(askedAt + 11 * 60_000), false);

// A nonsense Retry-After must not shorten the floor or produce a NaN deadline.
resetHttpState();
stubFetch();
queue = [{ status: 429, retryAfter: "soon" }];
const flooredAt = Date.now();
await fetchScoreboardJson(NBA);
assert.equal(isBackingOff(flooredAt + 30_000), true, "an unparseable Retry-After leaves the one minute floor standing");
assert.equal(isBackingOff(flooredAt + 90_000), false);

// --- ordinary failures are not rate limits ---------------------------------

resetHttpState();
stubFetch();
queue = [{ status: 404 }];
assert.equal(await fetchScoreboardJson(NBA), null);
assert.equal(isBackingOff(), false, "a 404 is a bad URL, not a request to slow down");

resetHttpState();
calls = [];
globalThis.fetch = (async () => {
	throw new Error("socket hang up");
}) as unknown as typeof fetch;
assert.equal(await fetchScoreboardJson(NBA), null, "a thrown fetch still resolves to null rather than taking the poll down");
assert.equal(isBackingOff(), false);

console.log("http.test.ts: all assertions passed");
