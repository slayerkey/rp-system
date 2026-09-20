import type { RadialSettings } from "./mouse-settings";

/**
 * Draws the Radial Select key face as an SVG string, reflecting the settings: the lit
 * wedge points the chosen direction and the reach dot sits at the chosen distance. So
 * a key set to "3 o'clock, close" looks different from "9 o'clock, far" at a glance.
 *
 * setImage accepts an SVG string, so this is generated per-instance at runtime -- no
 * pre-baked PNG per angle.
 */
const CHARCOAL = "#1c1b19";
const BRASS = "#e8791a";
const DIM_DEEP = "#44413c";

const C = 72; // centre of a 144x144 face
const R_OUT = 48;
const R_IN = 24;

function polar(r: number, deg: number): [number, number] {
	const a = (deg * Math.PI) / 180;
	return [C + r * Math.sin(a), C - r * Math.cos(a)]; // 0deg = up, clockwise
}

/** A donut-slice path centred on `deg`, spanning `span` degrees. */
function wedge(deg: number, span: number): string {
	const [ox1, oy1] = polar(R_OUT, deg - span / 2);
	const [ox2, oy2] = polar(R_OUT, deg + span / 2);
	const [ix2, iy2] = polar(R_IN, deg + span / 2);
	const [ix1, iy1] = polar(R_IN, deg - span / 2);
	return [
		`M ${ox1.toFixed(1)} ${oy1.toFixed(1)}`,
		`A ${R_OUT} ${R_OUT} 0 0 1 ${ox2.toFixed(1)} ${oy2.toFixed(1)}`,
		`L ${ix2.toFixed(1)} ${iy2.toFixed(1)}`,
		`A ${R_IN} ${R_IN} 0 0 0 ${ix1.toFixed(1)} ${iy1.toFixed(1)}`,
		"Z"
	].join(" ");
}

export function radialSvg(s: RadialSettings): string {
	const angle = s.angle ?? 0;
	const distance = Math.min(100, Math.max(0, s.distance ?? 60));

	// Eight faint slots for context, so the lit one reads as "one of a wheel".
	const slots = Array.from({ length: 8 }, (_, i) => {
		const deg = i * 45;
		const isLit = Math.abs(((deg - angle + 540) % 360) - 180) < 22.5;
		return `<path d="${wedge(deg, 40)}" fill="${isLit ? BRASS : DIM_DEEP}" />`;
	}).join("");

	// Reach dot: how far out the cursor is pushed, along the chosen direction.
	const [dx, dy] = polar(R_IN + (R_OUT - R_IN + 6) * (distance / 100), angle);
	const [px, py] = polar(R_IN - 3, angle);

	return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect x="0" y="0" width="144" height="144" rx="26" fill="${CHARCOAL}"/>
${slots}
<circle cx="${C}" cy="${C}" r="${R_IN - 4}" fill="${CHARCOAL}"/>
<circle cx="${C}" cy="${C}" r="6" fill="${BRASS}"/>
<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${dx.toFixed(1)}" y2="${dy.toFixed(1)}" stroke="${BRASS}" stroke-width="3" stroke-linecap="round"/>
<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="5" fill="${BRASS}" stroke="${CHARCOAL}" stroke-width="2"/>
</svg>`;
}
