import streamDeck from "@elgato/streamdeck";

import { type PollTier, refreshNow, startPoller } from "../../_shared/src/poller";
import { ageLabel } from "../../_shared/src/view";
import { fetchSnapshot } from "./api";
import { readSnapshot, writeSnapshot } from "./store";

export type HelldiversSurface = {
	repaint(): Promise<void>;
};

const MIN_NETWORK_INTERVAL_MS = 60_000;
const SOON_WINDOW_MS = 6 * 60 * 60_000;

let surfaces: HelldiversSurface[] = [];
let lastNetworkPollMs = 0;

export async function currentTier(): Promise<PollTier> {
	const snapshot = await readSnapshot();
	if (snapshot?.campaigns.length) return "live";
	const expiration = Date.parse(snapshot?.majorOrder?.expiresAt ?? "");
	if (Number.isFinite(expiration) && expiration - Date.now() <= SOON_WINDOW_MS) return "soon";
	return "idle";
}

let tier: PollTier = "idle";

async function repaintAll(): Promise<void> {
	for (const surface of surfaces) await surface.repaint();
}

async function poll(): Promise<void> {
	const now = Date.now();
	// The shared live tier is 45 seconds. This local guard honors the API's 60 second floor.
	if (now - lastNetworkPollMs < MIN_NETWORK_INTERVAL_MS) {
		await repaintAll();
		return;
	}
	lastNetworkPollMs = now;

	const snapshot = await fetchSnapshot(now);
	if (snapshot !== null) {
		await writeSnapshot(snapshot);
		tier = snapshot.campaigns.length
			? "live"
			: Number.isFinite(Date.parse(snapshot.majorOrder?.expiresAt ?? "")) &&
				  Date.parse(snapshot.majorOrder?.expiresAt ?? "") - now <= SOON_WINDOW_MS
			? "soon"
			: "idle";
		streamDeck.logger.info(
			`[helldivers] tier=${tier} campaigns=${snapshot.campaigns.length} players=${snapshot.war.playerCount}`
		);
	} else {
		const cached = await readSnapshot();
		streamDeck.logger.warn(
			`[helldivers] refresh failed, keeping cache${cached ? ` age=${ageLabel(cached.fetchedAt, now)}` : ""}`
		);
	}
	await repaintAll();
}

export function startTracking(list: HelldiversSurface[]): void {
	surfaces = list;
	void currentTier().then((value) => {
		tier = value;
	});
	startPoller({
		run: poll,
		tier: () => tier,
		onError: (error) => streamDeck.logger.error("[helldivers] poll failed", error)
	});
}

export function pokeTracker(): void {
	refreshNow();
}

export function staleTier(): PollTier {
	return tier;
}

