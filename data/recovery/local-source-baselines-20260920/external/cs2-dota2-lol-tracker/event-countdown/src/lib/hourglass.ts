/**
 * Draws an hourglass as raw SVG. The top bulb holds the time remaining (`frac` 0..1) and drains
 * into the bottom bulb as the event approaches; a couple of grains fall through the neck so it
 * visibly "runs". Returns an SVG fragment to drop into a key via the `raw` option.
 */
export type HourglassOpts = {
	cx: number;
	top: number;
	bottom: number;
	halfWidth: number;
	/** Fraction of sand still in the TOP bulb (1 = just started, 0 = arrived). */
	frac: number;
	/** Animation step (0,1,2…) used to move the falling grains. */
	phase: number;
	frame: string; // glass / wood colour
	sand: string; // sand colour
};

export function hourglass(o: HourglassOpts): string {
	const { cx, top, bottom, halfWidth: hw, frame, sand } = o;
	const frac = Math.max(0, Math.min(1, o.frac));
	const capH = 4;
	const neckY = (top + bottom) / 2;
	const tBulbTop = top + capH;
	const bBulbBot = bottom - capH;
	const hTop = neckY - tBulbTop;
	const hBot = bBulbBot - neckY;

	const L = cx - hw;
	const R = cx + hw;

	const parts: string[] = [];

	// Caps (wood).
	parts.push(`<rect x="${L - 3}" y="${top}" width="${hw * 2 + 6}" height="${capH}" rx="2" fill="${frame}"/>`);
	parts.push(`<rect x="${L - 3}" y="${bottom - capH}" width="${hw * 2 + 6}" height="${capH}" rx="2" fill="${frame}"/>`);

	// Sand in the top bulb: an inverted triangle sitting on the neck, height = frac.
	if (frac > 0.001) {
		const surfaceY = neckY - frac * hTop;
		const halfW = hw * frac;
		parts.push(
			`<polygon points="${(cx - halfW).toFixed(1)},${surfaceY.toFixed(1)} ${(cx + halfW).toFixed(1)},${surfaceY.toFixed(1)} ${cx},${neckY.toFixed(1)}" fill="${sand}"/>`
		);
	}

	// Sand piled in the bottom bulb: trapezoid rising from the base, height = (1-frac).
	const fillBot = 1 - frac;
	if (fillBot > 0.001) {
		const surfaceY = bBulbBot - fillBot * hBot;
		const halfW = hw * fillBot;
		parts.push(
			`<polygon points="${(cx - halfW).toFixed(1)},${surfaceY.toFixed(1)} ${(cx + halfW).toFixed(1)},${surfaceY.toFixed(1)} ${R},${bBulbBot.toFixed(1)} ${L},${bBulbBot.toFixed(1)}" fill="${sand}"/>`
		);
	}

	// Falling grain through the neck (only while actually draining).
	if (frac > 0.001 && frac < 0.999) {
		const span = hBot * 0.7;
		const gy = neckY + ((o.phase % 3) / 3) * span + 3;
		parts.push(`<rect x="${cx - 1.3}" y="${gy.toFixed(1)}" width="2.6" height="4" rx="1" fill="${sand}"/>`);
		parts.push(`<line x1="${cx}" y1="${neckY + 1}" x2="${cx}" y2="${(neckY + 6).toFixed(1)}" stroke="${sand}" stroke-width="1" opacity="0.6"/>`);
	}

	// Glass outline (two triangles), drawn last so it sits on top of the sand.
	parts.push(
		`<polygon points="${L},${tBulbTop} ${R},${tBulbTop} ${cx},${neckY.toFixed(1)}" fill="none" stroke="${frame}" stroke-width="2.5" stroke-linejoin="round"/>`
	);
	parts.push(
		`<polygon points="${L},${bBulbBot.toFixed(1)} ${R},${bBulbBot.toFixed(1)} ${cx},${neckY.toFixed(1)}" fill="none" stroke="${frame}" stroke-width="2.5" stroke-linejoin="round"/>`
	);

	return parts.join("");
}
