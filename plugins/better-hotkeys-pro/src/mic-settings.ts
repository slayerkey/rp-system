/** Shared shape for the mic actions. Empty/absent deviceId means "the default mic". */
export type MicSettings = {
	deviceId?: string;
};

export type PttSettings = MicSettings & {
	/** "talk" = held means live (default muted); "mute" = held means muted (default live). */
	mode?: "talk" | "mute";
};

export type MicVolumeSettings = MicSettings & {
	/** "set" jumps to `level`; "nudge" adds `delta` each press. */
	volMode?: "set" | "nudge";
	/** Target level 0..100 for "set". */
	level?: number;
	/** Step for "nudge", e.g. +5 or -5 (percent). */
	delta?: number;
};

/** null tells the audio layer to use the default microphone. */
export function deviceIdOf(s: MicSettings): string | null {
	return s.deviceId && s.deviceId.length > 0 ? s.deviceId : null;
}
