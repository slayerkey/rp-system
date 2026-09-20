/**
 * Tiny SVG key renderer for Stream Deck.
 *
 * Stream Deck keys are 72x72 (144x144 @2x). We draw a 144x144 SVG and hand it to
 * `setImage` as a data URI. SVG is vector, crisp at any size, and needs no native
 * canvas dependency. Note: `setImage` does NOT animate GIFs, so anything that
 * "flashes" or "pulses" is done by toggling between two SVG frames on a timer
 * (see {@link Pulse}). The SDK throttles image updates to ~10/sec.
 */

export const SIZE = 144;

/** Escape text for safe inclusion in SVG. */
export function esc(s: unknown): string {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Wrap an SVG document string into a data URI for `action.setImage`. */
export function toImage(svg: string): string {
	return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

export type Line = {
	text: string;
	/** Baseline centre Y (0-144). */
	y: number;
	size?: number;
	color?: string;
	weight?: number | string;
	opacity?: number;
	/** Letter spacing in px. */
	spacing?: number;
};

export type Bar = {
	/** 0..1 fill fraction. */
	pct: number;
	color: string;
	track?: string;
	y?: number;
	h?: number;
	pad?: number;
};

export type KeyOpts = {
	/** Solid background colour, or top colour of a vertical gradient when `bg2` is set. */
	bg?: string;
	bg2?: string;
	border?: string;
	borderWidth?: number;
	radius?: number;
	/** Inner glow colour drawn around the edge — good for "alert" states. */
	glow?: string;
	/** Raw SVG injected before the text (icons, shapes). Use 0-144 coordinates. */
	raw?: string;
	lines?: Line[];
	bar?: Bar;
};

/**
 * Build a full 144x144 key SVG. Compose backgrounds, a glow, raw shapes, text lines
 * and an optional bar — everything most reactive buttons need.
 */
export function key(o: KeyOpts): string {
	const r = o.radius ?? 18;
	const parts: string[] = [];
	parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`);

	// Background (solid or vertical gradient).
	if (o.bg2) {
		parts.push(
			`<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
				`<stop offset="0" stop-color="${o.bg ?? "#0b0b0e"}"/>` +
				`<stop offset="1" stop-color="${o.bg2}"/></linearGradient></defs>`
		);
		parts.push(`<rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${r}" fill="url(#bg)"/>`);
	} else {
		parts.push(`<rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${r}" fill="${o.bg ?? "#0b0b0e"}"/>`);
	}

	// Inner glow ring.
	if (o.glow) {
		parts.push(
			`<rect x="4" y="4" width="${SIZE - 8}" height="${SIZE - 8}" rx="${r - 3}" fill="none" ` +
				`stroke="${o.glow}" stroke-width="8" opacity="0.55"/>`
		);
		parts.push(
			`<rect x="9" y="9" width="${SIZE - 18}" height="${SIZE - 18}" rx="${r - 6}" fill="none" ` +
				`stroke="${o.glow}" stroke-width="3" opacity="0.9"/>`
		);
	}

	// Border.
	if (o.border) {
		const bw = o.borderWidth ?? 3;
		parts.push(
			`<rect x="${bw / 2}" y="${bw / 2}" width="${SIZE - bw}" height="${SIZE - bw}" rx="${r}" ` +
				`fill="none" stroke="${o.border}" stroke-width="${bw}"/>`
		);
	}

	if (o.raw) parts.push(o.raw);

	// Bar.
	if (o.bar) {
		const b = o.bar;
		const pad = b.pad ?? 16;
		const h = b.h ?? 12;
		const y = b.y ?? SIZE - pad - h;
		const w = SIZE - pad * 2;
		const pct = Math.max(0, Math.min(1, b.pct));
		parts.push(`<rect x="${pad}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${b.track ?? "#ffffff22"}"/>`);
		if (pct > 0) {
			parts.push(`<rect x="${pad}" y="${y}" width="${w * pct}" height="${h}" rx="${h / 2}" fill="${b.color}"/>`);
		}
	}

	// Text lines.
	for (const l of o.lines ?? []) {
		const attrs = [
			`x="${SIZE / 2}"`,
			`y="${l.y}"`,
			`text-anchor="middle"`,
			`font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif"`,
			`font-size="${l.size ?? 40}"`,
			`font-weight="${l.weight ?? 700}"`,
			`fill="${l.color ?? "#ffffff"}"`,
			l.opacity != null ? `opacity="${l.opacity}"` : "",
			l.spacing != null ? `letter-spacing="${l.spacing}"` : ""
		]
			.filter(Boolean)
			.join(" ");
		parts.push(`<text ${attrs}>${esc(l.text)}</text>`);
	}

	parts.push(`</svg>`);
	return parts.join("");
}

/** Convenience: build a key and wrap as a data URI in one call. */
export function keyImage(o: KeyOpts): string {
	return toImage(key(o));
}

/**
 * Minimal action surface we need for animation — anything with `setImage`.
 * Avoids tightly coupling to a specific SDK event type.
 */
export interface Imageable {
	setImage(image?: string): Promise<void>;
}

/**
 * Toggle a set of frames on an interval to fake animation (flash / pulse / glow).
 * `setImage` cannot show animated GIFs, so this is how reactive states breathe.
 */
export class Pulse {
	private timer?: ReturnType<typeof setInterval>;
	private i = 0;

	constructor(
		private readonly targets: Iterable<Imageable> | (() => Iterable<Imageable>),
		private readonly frames: string[],
		private readonly intervalMs = 450
	) {}

	private resolveTargets(): Iterable<Imageable> {
		return typeof this.targets === "function" ? this.targets() : this.targets;
	}

	start(): void {
		this.stop();
		this.i = 0;
		this.paint();
		this.timer = setInterval(() => {
			this.i = (this.i + 1) % this.frames.length;
			this.paint();
		}, this.intervalMs);
	}

	private paint(): void {
		const frame = this.frames[this.i];
		for (const t of this.resolveTargets()) void t.setImage(frame);
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	get running(): boolean {
		return this.timer !== undefined;
	}
}
