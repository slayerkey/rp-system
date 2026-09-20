import { THEMES, PLATFORM_COLORS, type ThemeName } from "./themes";
import { formatNum, formatFull, formatDelta, formatRevenue, formatDuration, fitFont } from "./format";
import type { StatSnapshot, DisplayMode, PlatformId } from "../platforms/types";

const FONT = "-apple-system, Helvetica, Arial, sans-serif";

// Official brand SVG paths, scaled to 144×144 canvas.
// Source: SimpleIcons / official brand kits (24×24 viewBox → scaled ×3.75, centered at (72,60)).
// translate(27,15) centers a 24px icon at canvas center x=72, icon top at y=15.
const LOGO_PATHS: Record<PlatformId, string> = {
	youtube:
		// Official YouTube play-button mark (24×24 → ×3.75)
		`<g transform="translate(27,15) scale(3.75)">` +
		`<path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>` +
		`<path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>` +
		`</g>`,
	twitch:
		// Official Twitch Glitch mark (24×24 → ×3.75, even-odd for inner cutouts)
		`<g transform="translate(27,15) scale(3.75)">` +
		`<path fill="#9146FF" fill-rule="evenodd" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>` +
		`</g>`,
};

function uri(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function frame(theme: ThemeName, inner: string, bg?: string): string {
	const t = THEMES[theme];
	return uri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
			`<defs><clipPath id="r"><rect width="144" height="144" rx="20"/></clipPath></defs>` +
			`<g clip-path="url(#r)"><rect width="144" height="144" fill="${bg ?? t.bg}"/>${inner}</g></svg>`,
	);
}

function txt(x: number, y: number, size: number, weight: number, fill: string, content: string, anchor = "middle"): string {
	return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${content}</text>`;
}

function progressBar(x: number, y: number, w: number, h: number, pct: number, color: string, trackColor: string, rx = 4): string {
	const fill = Math.max(h, (w * Math.min(pct, 1)));
	return (
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${trackColor}"/>` +
		`<rect x="${x}" y="${y}" width="${fill.toFixed(1)}" height="${h}" rx="${rx}" fill="${color}"/>`
	);
}


// ─────────────────────────────────────────────────────────────────────────────
// Mode: Big Number
// ─────────────────────────────────────────────────────────────────────────────
export function renderBigNumber(snap: StatSnapshot, opts: { theme: ThemeName; milestoneTarget?: number; milestoneAuto?: boolean }): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];
	const raw = snap.metric === "estimated_revenue" ? formatRevenue(snap.value) : formatNum(snap.value);
	const label = metricLabel(snap.metric);
	const fs = fitFont(raw, 128, 58);

	// Mini progress bar to milestone at bottom
	let barHtml = "";
	const target = opts.milestoneTarget ?? (opts.milestoneAuto ? nextMilestone(snap.value) : undefined);
	if (target && target > snap.value) {
		const pct = snap.value / target;
		barHtml = progressBar(12, 124, 120, 10, pct, color, t.track, 5);
	}

	return frame(
		opts.theme,
		txt(72, 30, 15, 700, t.sub, label) +
			txt(72, 92, fs, 800, color, raw) +
			barHtml,
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: Full Number (exact count, no abbreviation)
// ─────────────────────────────────────────────────────────────────────────────
export function renderFullNumber(snap: StatSnapshot, opts: { theme: ThemeName }): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];
	const label = metricLabel(snap.metric);
	const raw = formatFull(snap.value);
	const fs = fitFont(raw, 132, 46, 14);
	return frame(opts.theme,
		txt(72, 30, 15, 700, t.sub, label) +
		txt(72, 88, fs, 800, color, raw),
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: Milestone
// ─────────────────────────────────────────────────────────────────────────────
export function renderMilestone(
	snap: StatSnapshot,
	target: number,
	daysEta: number | null,
	opts: { theme: ThemeName },
): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];

	// Already reached — show congratulatory screen
	if (snap.value >= target) {
		const valStr = formatNum(snap.value);
		const fs = fitFont(valStr, 128, 52);
		return frame(
			opts.theme,
			txt(72, 26, 13, 700, "#30E27B", "GOAL REACHED") +
			txt(72, 80, fs, 800, color, valStr) +
			txt(72, 120, 13, 600, t.sub, "Set a new target"),
		);
	}

	const pct = snap.value / target;
	const away = target - snap.value;
	const awayStr = formatNum(away);
	const targetStr = formatNum(target);
	const etaStr = daysEta !== null ? (daysEta < 1 ? "< 1d" : `~${Math.ceil(daysEta)}d`) : "";
	const valueFs = fitFont(formatNum(snap.value), 128, 52);
	const awayLabel = `${awayStr} away`;

	// ETA gets the top slot (more prominent); "X away" gets the bottom alone so it can be big
	const topTxt = etaStr
		? txt(72, 22, fitFont(etaStr, 120, 16, 10), 600, t.sub, etaStr)
		: txt(72, 22, 14, 600, t.sub, `→ ${targetStr}`);

	return frame(
		opts.theme,
		topTxt +
		txt(72, 80, valueFs, 800, color, formatNum(snap.value)) +
		progressBar(12, 94, 120, 12, pct, color, t.track, 6) +
		txt(72, 128, fitFont(awayLabel, 124, 20, 13), 700, t.sub, awayLabel),
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: Trend (sparkline + delta)
// ─────────────────────────────────────────────────────────────────────────────
export function renderTrend(snap: StatSnapshot, history: number[], opts: { theme: ThemeName }): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];
	const label = trendLabel(snap.metric);
	const window = snap.deltaWindow === "today" ? "TODAY" : "7-DAY";

	// Cold start: fewer than 2 daily points means there's no trend to draw yet.
	// Show the current value + how many days are logged so the user knows what's happening.
	if (history.length < 2) {
		const raw = snap.metric === "estimated_revenue" ? formatRevenue(snap.value) : formatNum(snap.value);
		const fs = fitFont(raw, 124, 52);
		const days = history.length;
		const statusLine = days === 0 ? "collecting…" : `${days} day logged · need 2`;
		return frame(
			opts.theme,
			txt(72, 34, 13, 700, t.sub, label) +
				txt(72, 92, fs, 800, color, raw) +
				txt(72, 122, 11, 600, t.sub, statusLine),
		);
	}

	// Have history — show the change as the headline with a sparkline below.
	const delta = snap.delta ?? 0;
	const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
	const arrowColor = delta > 0 ? "#30E27B" : delta < 0 ? "#FF453A" : t.sub;
	const deltaStr = formatDelta(delta);
	const deltaFs = fitFont(deltaStr, 92, 34, 18);

	const n = history.length;
	const x0 = 10, x1 = 134, yTop = 90, yBot = 132;
	const min = Math.min(...history), max = Math.max(...history);
	const range = Math.max(1, max - min);
	const xy = history.map((v, i) => [
		x0 + (x1 - x0) * (i / (n - 1)),
		yTop + (yBot - yTop) * (1 - (v - min) / range),
	] as const);
	const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
	const last = xy[xy.length - 1];
	const chart =
		`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.75"/>` +
		`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" fill="${color}"/>`;

	return frame(
		opts.theme,
		txt(72, 28, 11, 700, t.sub, `${label} · ${window}`) +
			txt(56, 76, deltaFs, 800, color, deltaStr) +
			txt(116, 76, 26, 800, arrowColor, arrow) +
			chart,
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: Live Viewers
// ─────────────────────────────────────────────────────────────────────────────
export function renderLive(snap: StatSnapshot, opts: { theme: ThemeName }): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];
	const isLive = snap.liveStatus === "live";

	if (!isLive) {
		return frame(
			opts.theme,
			`<circle cx="18" cy="18" r="5" fill="#555555"/>` +
				txt(72, 72, 14, 700, t.sub, "OFFLINE") +
				txt(72, 96, 13, 600, t.dim, "Not live"),
		);
	}

	const viewers = formatNum(snap.value);
	const fs = fitFont(viewers, 124, 56);
	const duration = snap.streamStartedAt ? formatDuration(snap.streamStartedAt) : "";
	const peak = snap.peakViewers ? formatNum(snap.peakViewers) : "";

	// Pulsing live dot (animated via SVG animate)
	const liveDot =
		`<circle cx="18" cy="18" r="6" fill="#FF453A">` +
		`<animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>` +
		`</circle>`;

	return frame(
		opts.theme,
		liveDot +
			txt(72, 30, 13, 800, "#FF453A", `● LIVE  ${duration}`) +
			txt(72, 90, fs, 800, color, viewers) +
			txt(72, 112, 12, 700, t.sub, "VIEWERS") +
			(peak ? txt(72, 134, 11, 600, t.sub, `Peak: ${peak}`) : ""),
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: Platform Icon (row header key)
// ─────────────────────────────────────────────────────────────────────────────
export function renderPlatformIcon(platform: PlatformId, opts: { theme: ThemeName }): string {
	const t = THEMES[opts.theme];
	const logo = LOGO_PATHS[platform];
	const name = platform.toUpperCase();
	return frame(
		opts.theme,
		logo + txt(72, 132, 13, 800, t.sub, name),
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: Achievement (milestone crossed)
// ─────────────────────────────────────────────────────────────────────────────
export function renderAchievement(snap: StatSnapshot, milestoneValue: number, opts: { theme: ThemeName }): string {
	const color = PLATFORM_COLORS[snap.platform];
	const val = formatNum(milestoneValue);
	const label = metricLabel(snap.metric);
	const t = THEMES[opts.theme];

	// Scattered confetti pieces — colored rects at random angles
	const PIECES = [
		[18, 20, 9, 4, 40, "#FFD60A"],
		[108, 16, 8, 4, -35, "#FF453A"],
		[14, 58, 7, 4, 20, "#30E27B"],
		[118, 52, 8, 3, -55, "#FF9F0A"],
		[22, 108, 8, 4, 30, "#9146FF"],
		[112, 104, 7, 4, -40, "#FFD60A"],
		[52, 12, 8, 3, 15, "#FF453A"],
		[88, 14, 9, 3, -25, "#30E27B"],
		[10, 82, 7, 4, 50, "#FFD60A"],
		[122, 78, 8, 3, -30, "#FF453A"],
		[38, 126, 8, 4, 20, "#30E27B"],
		[96, 128, 7, 4, -50, "#9146FF"],
	] as const;

	const confetti = PIECES.map(([x, y, w, h, r, c]) =>
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${c}" opacity="0.9" transform="rotate(${r} ${x + w / 2} ${y + h / 2})"/>`,
	).join("");

	return frame(
		opts.theme,
		confetti +
			txt(72, 62, 30, 800, "#FFD60A", "🏆") +
			txt(72, 90, 20, 800, color, val) +
			txt(72, 110, 11, 700, t.text, label) +
			txt(72, 130, 11, 600, t.sub, "Just reached!"),
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: Upload Streak
// ─────────────────────────────────────────────────────────────────────────────
export function renderStreak(streakDays: number, lastUploadAgo: string, opts: { theme: ThemeName }): string {
	const t = THEMES[opts.theme];
	const color = streakDays >= 7 ? "#FF9F0A" : streakDays >= 3 ? "#FF6B35" : "#FF453A";
	const numStr = String(streakDays);
	const fs = fitFont(numStr, 80, 56);

	return frame(
		opts.theme,
		txt(72, 30, 12, 700, t.sub, "UPLOAD STREAK") +
			txt(50, 92, fs, 800, color, numStr) +
			txt(108, 92, 22, 800, "#FF9F0A", "🔥") +
			txt(72, 114, 12, 700, t.sub, "DAYS") +
			txt(72, 134, 11, 600, t.sub, lastUploadAgo),
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: Multi-Stat (4-quadrant overview)
// ─────────────────────────────────────────────────────────────────────────────
export function renderMulti(
	snaps: Array<{ snap: StatSnapshot | null; label: string }>,
	opts: { theme: ThemeName },
): string {
	const t = THEMES[opts.theme];
	// Quadrant centers: [cx, cy]
	const positions = [
		[36, 38], [108, 38],
		[36, 106], [108, 106],
	] as const;

	let cells = "";
	cells += `<line x1="72" y1="6" x2="72" y2="138" stroke="${t.dim}" stroke-width="0.75"/>`;
	cells += `<line x1="6" y1="72" x2="138" y2="72" stroke="${t.dim}" stroke-width="0.75"/>`;

	for (let i = 0; i < 4; i++) {
		const entry = snaps[i];
		const [cx, cy] = positions[i];
		if (!entry?.snap) {
			cells += txt(cx, cy + 4, 11, 600, t.dim, "—");
			continue;
		}
		const { snap } = entry;
		const color = PLATFORM_COLORS[snap.platform];
		const raw = formatNum(snap.value);
		// Very short label: max 3-4 chars so number can be big
		const lbl = entry.label;
		cells += txt(cx, cy - 11, 10, 700, t.sub, lbl);
		cells += txt(cx, cy + 13, fitFont(raw, 64, 30, 18), 800, color, raw);
	}

	return frame(opts.theme, cells);
}

// ─────────────────────────────────────────────────────────────────────────────
// State screens
// ─────────────────────────────────────────────────────────────────────────────
export function renderMessage(
	title: string,
	lines: string[],
	platform: PlatformId | null,
	theme: ThemeName,
): string {
	const t = THEMES[theme];
	const color = platform ? PLATFORM_COLORS[platform] : "#9146FF";
	const body = lines
		.slice(0, 3)
		.map((l, i) => txt(72, 100 + i * 18, 12, 600, t.sub, l))
		.join("");
	return frame(
		theme,
			`<circle cx="72" cy="48" r="8" fill="${color}"/>` +
			txt(72, 84, 20, 800, t.text, title) +
			body,
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────────────────────────────────────
export interface RenderCtx {
	mode: DisplayMode;
	theme: ThemeName;
	milestoneTarget?: number;
	milestoneAuto?: boolean;
	trendHistory?: number[];
	streakDays?: number;
	lastUploadAgo?: string;
	daysEta?: number | null;
	achievementValue?: number;
	multiSnaps?: Array<{ snap: StatSnapshot | null; label: string }>;
}

export function renderKey(snap: StatSnapshot, ctx: RenderCtx): string {
	switch (ctx.mode) {
		case "number":
			return renderBigNumber(snap, { theme: ctx.theme, milestoneTarget: ctx.milestoneTarget, milestoneAuto: ctx.milestoneAuto });
		case "full":
			return renderFullNumber(snap, { theme: ctx.theme });
		case "milestone": {
			const target = ctx.milestoneTarget ?? nextMilestone(snap.value);
			return renderMilestone(snap, target, ctx.daysEta ?? null, { theme: ctx.theme });
		}
		case "trend":
			return renderTrend(snap, ctx.trendHistory ?? [], { theme: ctx.theme });
		case "live":
			return renderLive(snap, { theme: ctx.theme });
		case "platform_icon":
			return renderPlatformIcon(snap.platform, { theme: ctx.theme });
		case "achievement":
			return renderAchievement(snap, ctx.achievementValue ?? snap.value, { theme: ctx.theme });
		case "streak":
			return renderStreak(ctx.streakDays ?? 0, ctx.lastUploadAgo ?? "", { theme: ctx.theme });
		case "multi":
			return renderMulti(ctx.multiSnaps ?? [], { theme: ctx.theme });
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export function nextMilestone(n: number): number {
	const thresholds = [
		100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000,
		100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
	];
	return thresholds.find((t) => t > n) ?? Math.ceil(n / 1_000_000) * 1_000_000 + 1_000_000;
}

function metricLabel(metric: import("../platforms/types").MetricKey): string {
	const labels: Record<import("../platforms/types").MetricKey, string> = {
		subscribers: "SUBS",
		total_views: "TOTAL VIEWS",
		video_count: "VIDEOS",
		views_today: "VIEWS TODAY",
		views_7day: "VIEWS 7-DAY",
		subs_today: "SUBS TODAY",
		live_viewers: "VIEWERS",
		followers: "FOLLOWERS",
		followers_today: "NEW FOLLOWS",
		twitch_subs: "SUBS",
		estimated_revenue: "EST. REVENUE",
		comments_today: "COMMENTS",
		upload_streak: "STREAK",
		stream_status: "STREAM",
	};
	return labels[metric] ?? metric.toUpperCase();
}

// Short labels for trend header (avoid "VIEWS TODAY · TODAY" doubling)
function trendLabel(metric: import("../platforms/types").MetricKey): string {
	const labels: Record<import("../platforms/types").MetricKey, string> = {
		subscribers: "SUBS",
		total_views: "VIEWS",
		video_count: "VIDEOS",
		views_today: "VIEWS",
		views_7day: "VIEWS",
		subs_today: "SUBS",
		live_viewers: "VIEWERS",
		followers: "FOLLOWERS",
		followers_today: "NEW FOLLOWS",
		twitch_subs: "SUBS",
		estimated_revenue: "REVENUE",
		comments_today: "COMMENTS",
		upload_streak: "STREAK",
		stream_status: "STREAM",
	};
	return labels[metric] ?? metric.toUpperCase();
}
