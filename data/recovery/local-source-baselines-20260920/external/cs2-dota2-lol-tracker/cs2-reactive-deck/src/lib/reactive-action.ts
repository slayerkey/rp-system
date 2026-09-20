/**
 * Base class for actions that re-render whenever a new GSI payload arrives.
 *
 * It owns the boilerplate: subscribing to the shared {@link gsi} server, caching each
 * visible instance's settings, and fanning a re-render out to every visible key.
 * Subclasses implement {@link draw} for a single key.
 */
import {
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { gsi, type GsiPayload } from "./gsi-server";

export abstract class ReactiveAction<S extends JsonObject = JsonObject> extends SingletonAction<S> {
	/** Latest settings per visible action instance, keyed by action id. */
	protected readonly settingsById = new Map<string, S>();

	constructor() {
		super();
		gsi.onUpdate((payload) => this.renderAll(payload));
	}

	override onWillAppear(ev: WillAppearEvent<S>): void {
		this.settingsById.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) this.safeDraw(ev.action, ev.payload.settings, gsi.latest);
	}

	override onWillDisappear(ev: WillDisappearEvent<S>): void {
		this.settingsById.delete(ev.action.id);
		this.onGone(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): void {
		this.settingsById.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) this.safeDraw(ev.action, ev.payload.settings, gsi.latest);
	}

	/** Re-render every currently-visible instance of this action. */
	protected renderAll(payload: GsiPayload | null): void {
		for (const action of this.actions) {
			if (!action.isKey()) continue;
			const settings = this.settingsById.get(action.id) ?? ({} as S);
			this.safeDraw(action, settings, payload);
		}
	}

	private safeDraw(action: KeyAction<S>, settings: S, payload: GsiPayload | null): void {
		try {
			this.draw(action, settings, payload);
		} catch (err) {
			// Never let a render error kill the update loop.
			void err;
		}
	}

	/** Render a single key from the latest payload + its settings. */
	protected abstract draw(action: KeyAction<S>, settings: S, payload: GsiPayload | null): void;

	/** Hook for subclasses to clean up per-instance timers when a key disappears. */
	protected onGone(_actionId: string): void {
		/* no-op by default */
	}
}
