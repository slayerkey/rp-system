/**
 * Dynamic key faces.
 *
 * Stream Deck's setImage() takes an image, so a key face is just SVG text: no canvas
 * dependency, no native binaries, identical output on Windows and macOS. Every function here
 * is pure, which is what makes the layout testable without a Stream Deck attached.
 */

const W = 144;
const BG = "#080a10";
const PANEL = "#141822";
const TEXT = "#f5faf8";
const MUTED = "#c4cee0";
const ACCENT = "#2be86a";
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Characters per preview line at the body font size, measured against the 144px key. */
const LINE_CHARS = 15;
const MAX_LINES = 3;

export function escapeXml(s: string): string {
	return String(s).replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string
	);
}

/**
 * Wraps finished SVG markup in the form setImage() actually accepts: a base64 data URI.
 *
 * Raw markup does not render, and a plain-text data URI is worse than useless here because
 * every colour starts with '#', which a URI parser reads as the start of a fragment and
 * throws the rest of the document away. Base64 sidesteps the escaping question entirely.
 */
export function keyImage(markup: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(markup, "utf-8").toString("base64")}`;
}

type TextOpts = { x: number; y: number; size: number; fill: string; anchor?: "start" | "middle" | "end"; bold?: boolean };

function text(value: string, o: TextOpts): string {
	return (
		`<text x="${o.x}" y="${o.y}" font-family="${FONT}" font-size="${o.size}" font-weight="${o.bold === false ? "500" : "700"}" ` +
		`fill="${o.fill}" text-anchor="${o.anchor ?? "start"}" letter-spacing="0.3">${escapeXml(value)}</text>`
	);
}

function svg(body: string): string {
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">` +
		`<rect width="${W}" height="${W}" fill="${BG}" />${body}</svg>`
	);
}

/**
 * Slot number band across the top, the one piece of every face that never moves.
 *
 * A slot holding something gets the band filled solid, so a clipboard key is identifiable
 * at arm's length among a deck of other keys. Green text on a dark band read as grey mush
 * at that distance, which is the same reason the trackers fill their team-colour band.
 */
function header(label: string, filled: boolean): string {
	return (
		`<rect width="${W}" height="34" fill="${filled ? ACCENT : PANEL}" />` +
		text(label, { x: 10, y: 24, size: 17, fill: filled ? BG : MUTED })
	);
}

/**
 * Collapses whitespace so a copied code block or paragraph reads as one flowing line on a
 * key, then cuts it to the user's preview length.
 *
 * Display only. The untruncated text is what gets pasted, which is why this lives here and
 * never touches the stored history.
 */
export function previewText(value: string, previewLength: number): string {
	const clean = value.replace(/\s+/g, " ").trim();
	return clean.length <= previewLength ? clean : `${clean.slice(0, Math.max(1, previewLength - 1))}…`;
}

/**
 * Where to cut a token that is too long for one line.
 *
 * Emails, URLs and file names are most of what anyone copies, and they arrive as one
 * unbroken token. Cutting them at a fixed column lands mid-word ("hello@packrat.s"), so
 * prefer the last punctuation in the line, keeping the separator on the line that ends.
 */
function breakAt(token: string): number {
	const window = token.slice(0, LINE_CHARS);
	const punct = Math.max(
		window.lastIndexOf("@"), window.lastIndexOf("/"), window.lastIndexOf("."),
		window.lastIndexOf("-"), window.lastIndexOf("_")
	);
	// Only worth it past the halfway mark, or a leading "https://" strands a near-empty line.
	return punct >= LINE_CHARS / 2 ? punct + 1 : LINE_CHARS;
}

/** Greedy word wrap, breaking mid-word only for something with no spaces at all, like a URL. */
function wrap(value: string): string[] {
	const lines: string[] = [];
	let line = "";

	for (const word of value.split(" ")) {
		let rest = word;
		while (rest.length > LINE_CHARS) {
			if (line) {
				lines.push(line);
				line = "";
			}
			const cut = breakAt(rest);
			lines.push(rest.slice(0, cut));
			rest = rest.slice(cut);
		}
		const candidate = line ? `${line} ${rest}` : rest;
		if (candidate.length > LINE_CHARS) {
			if (line) lines.push(line);
			line = rest;
		} else {
			line = candidate;
		}
	}
	if (line) lines.push(line);

	if (lines.length > MAX_LINES) {
		const kept = lines.slice(0, MAX_LINES);
		kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1].slice(0, LINE_CHARS - 1)}…`;
		return kept;
	}
	return lines;
}

export type SlotBadge = {
	slotIndex: number;
	/** Optional configured name. The stored clipboard text remains untouched. */
	label?: string;
	/** Already run through previewText(). */
	preview: string;
	/** Shown as a small footer mark so the two press behaviours are told apart at a glance. */
	pasteMode: "direct" | "restore" | "plain";
};

export function slotBadge(b: SlotBadge): string {
	const lines = wrap(b.preview);
	const body = lines
		.map((line, i) => text(line, { x: 8, y: 60 + i * 20, size: 15, fill: TEXT, bold: false }))
		.join("");

	return svg(
		header((b.label?.trim() || `SLOT ${b.slotIndex}`).slice(0, 16), true) +
			body +
			text(b.pasteMode === "direct" ? "PASTE" : b.pasteMode === "plain" ? "PLAIN" : "COPY", {
				x: 8,
				y: 136,
				size: 12,
				fill: MUTED,
				bold: false
			})
	);
}

export type EmptyBadge = {
	/** Zero when the key has no slot chosen yet. */
	slotIndex: number;
	/** `pick` needs settings, `cold` has no history at all, `short` has history but not this far. */
	reason: "pick" | "cold" | "short";
};

/**
 * The nothing-to-show face. Deliberately calm: an unconfigured key and an empty slot are both
 * ordinary states on a fresh install, not failures, so neither gets warning colour.
 */
export function emptySlotBadge(b: EmptyBadge): string {
	const detail = { pick: "pick a slot", cold: "nothing", short: "no copy" }[b.reason];
	const sub = { pick: "in settings", cold: "copied yet", short: "here yet" }[b.reason];

	return svg(
		header(b.slotIndex > 0 ? `SLOT ${b.slotIndex}` : "SLOT", false) +
			text(detail, { x: 72, y: 78, size: 16, fill: MUTED, anchor: "middle" }) +
			text(sub, { x: 72, y: 100, size: 14, fill: MUTED, anchor: "middle", bold: false })
	);
}

export function messageBadge(label: string, first: string, second: string): string {
	return svg(
		header(label.slice(0, 16), false) +
			text(first, { x: 72, y: 78, size: 16, fill: MUTED, anchor: "middle" }) +
			text(second, { x: 72, y: 100, size: 14, fill: MUTED, anchor: "middle", bold: false })
	);
}
