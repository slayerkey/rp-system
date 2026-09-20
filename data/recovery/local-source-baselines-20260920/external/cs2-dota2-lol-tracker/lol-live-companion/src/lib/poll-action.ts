/**
 * Base class for actions driven by the LoL Live Client poller. Subclasses implement
 * {@link draw} (game running) and {@link drawIdle} (API unreachable). The base handles
 * subscription, per-instance settings caching, and fan-out to every visible key.
 */
import {
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { lol, type LiveData } from "./lol-client";

export abstract class PollAction<S extends JsonObject = JsonObject> extends SingletonAction<S> {
	protected readonly settingsById = new Map<string, S>();

	constructor() {
		super();
		lol.onUpdate((data) => this.renderAll(data));
		lol.onIdle(() => this.renderAll(null));
	}

	override onWillAppear(ev: WillAppearEvent<S>): void {
		this.settingsById.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) this.renderOne(ev.action, ev.payload.settings, lol.latest);
	}

	override onWillDisappear(ev: WillDisappearEvent<S>): void {
		this.settingsById.delete(ev.action.id);
		this.onGone(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): void {
		this.settingsById.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) this.renderOne(ev.action, ev.payload.settings, lol.latest);
	}

	protected renderAll(data: LiveData | null): void {
		for (const action of this.actions) {
			if (!action.isKey()) continue;
			this.renderOne(action, this.settingsById.get(action.id) ?? ({} as S), data);
		}
	}

	private renderOne(action: KeyAction<S>, settings: S, data: LiveData | null): void {
		try {
			if (data && lol.connected) this.draw(action, settings, data);
			else this.drawIdle(action, settings);
		} catch {
			/* never break the poll loop */
		}
	}

	protected abstract draw(action: KeyAction<S>, settings: S, data: LiveData): void;
	protected abstract drawIdle(action: KeyAction<S>, settings: S): void;

	protected onGone(_id: string): void {
		/* no-op */
	}
}
