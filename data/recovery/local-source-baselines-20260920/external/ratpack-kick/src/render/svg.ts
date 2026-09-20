import { THEMES, PLATFORM_COLORS, type ThemeName } from "./themes";
import { formatNum, formatFull, formatDelta, formatDuration, fitFont } from "./format";
import type { StatSnapshot, DisplayMode } from "../platforms/types";

const FONT = "-apple-system, Helvetica, Arial, sans-serif";

// Official Kick logo — SimpleIcons path, 24×24 viewBox → ×3.75 scaled, centered on 144×144 key
const KICK_LOGO =
	`<g transform="translate(27,15) scale(3.75)">` +
	`<path fill="#53FC18" d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z"/>` +
	`</g>`;

function uri(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function frame(theme: ThemeName, inner: string): string {
	const t = THEMES[theme];
	return uri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
			`<defs><clipPath id="r"><rect width="144" height="144" rx="20"/></clipPath></defs>` +
			`<g clip-path="url(#r)"><rect width="144" height="144" fill="${t.bg}"/>${inner}</g></svg>`,
	);
}

function txt(x: number, y: number, size: number, weight: number, fill: string, content: string, anchor = "middle"): string {
	return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${content}</text>`;
}

function progressBar(x: number, y: number, w: number, h: number, pct: number, color: string, trackColor: string, rx = 4): string {
	const fill = Math.max(h, w * Math.min(pct, 1));
	return (
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${trackColor}"/>` +
		`<rect x="${x}" y="${y}" width="${fill.toFixed(1)}" height="${h}" rx="${rx}" fill="${color}"/>`
	);
}

export function renderBigNumber(snap: StatSnapshot, opts: { theme: ThemeName; milestoneTarget?: number; milestoneAuto?: boolean; channelName?: string }): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];
	const raw = formatNum(snap.value);
	const label = metricLabel(snap.metric);
	const fs = fitFont(raw, 128, 58);
	const name = opts.channelName ? `@${opts.channelName}` : "";

	let barHtml = "";
	const target = opts.milestoneTarget ?? (opts.milestoneAuto ? nextMilestone(snap.value) : undefined);
	if (target && target > snap.value) {
		barHtml = progressBar(12, 118, 120, 8, snap.value / target, color, t.track, 4);
	}

	return frame(opts.theme,
		txt(72, 30, 15, 700, t.sub, label) +
		txt(72, 90, fs, 800, color, raw) +
		barHtml +
		(name ? txt(72, 136, 10, 600, t.dim, name) : ""),
	);
}

export function renderFullNumber(snap: StatSnapshot, opts: { theme: ThemeName; channelName?: string }): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];
	const label = metricLabel(snap.metric);
	const raw = formatFull(snap.value);
	const fs = fitFont(raw, 132, 46, 14);
	const name = opts.channelName ? `@${opts.channelName}` : "";
	return frame(opts.theme,
		txt(72, 30, 15, 700, t.sub, label) +
		txt(72, 86, fs, 800, color, raw) +
		(name ? txt(72, 136, 10, 600, t.dim, name) : ""),
	);
}

export function renderMilestone(snap: StatSnapshot, target: number, daysEta: number | null, opts: { theme: ThemeName }): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];

	if (snap.value >= target) {
		const valStr = formatNum(snap.value);
		return frame(opts.theme,
			txt(72, 26, 13, 700, "#30E27B", "GOAL REACHED") +
			txt(72, 80, fitFont(valStr, 128, 52), 800, color, valStr) +
			txt(72, 120, 13, 600, t.sub, "Set a new target"),
		);
	}

	const pct = snap.value / target;
	const away = target - snap.value;
	const etaStr = daysEta !== null ? (daysEta < 1 ? "< 1d" : `~${Math.ceil(daysEta)}d`) : "";
	const bottomLine = etaStr ? `${formatNum(away)} away · ${etaStr}` : `${formatNum(away)} away`;

	return frame(opts.theme,
		txt(72, 24, 14, 600, t.sub, `→ ${formatNum(target)}`) +
		txt(72, 80, fitFont(formatNum(snap.value), 128, 52), 800, color, formatNum(snap.value)) +
		progressBar(12, 94, 120, 12, pct, color, t.track, 6) +
		txt(72, 126, 15, 600, t.sub, bottomLine),
	);
}

export function renderTrend(snap: StatSnapshot, history: number[], opts: { theme: ThemeName }): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];
	const label = trendLabel(snap.metric);
	const window = snap.deltaWindow === "today" ? "TODAY" : "7-DAY";

	if (history.length < 2) {
		const raw = formatNum(snap.value);
		const days = history.length;
		const statusLine = days === 0 ? "collecting…" : `${days} day logged · need 2`;
		return frame(opts.theme,
			txt(72, 34, 13, 700, t.sub, label) +
			txt(72, 92, fitFont(raw, 124, 52), 800, color, raw) +
			txt(72, 122, 11, 600, t.sub, statusLine),
		);
	}

	const delta = snap.delta ?? 0;
	const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
	const arrowColor = delta > 0 ? "#30E27B" : delta < 0 ? "#FF453A" : t.sub;
	const deltaStr = formatDelta(delta);
	const deltaFs = fitFont(deltaStr, 92, 34, 18);

	const n = history.length;
	const x0 = 10, x1 = 134, yTop = 90, yBot = 132;
	const min = Math.min(...history), max = Math.max(...history);
	const range = Math.max(1, max - min);
	const xy = history.map((v, i) => [x0 + (x1 - x0) * (i / (n - 1)), yTop + (yBot - yTop) * (1 - (v - min) / range)] as const);
	const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
	const last = xy[xy.length - 1];
	const chart =
		`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.75"/>` +
		`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" fill="${color}"/>`;

	return frame(opts.theme,
		txt(72, 28, 11, 700, t.sub, `${label} · ${window}`) +
		txt(56, 76, deltaFs, 800, color, deltaStr) +
		txt(116, 76, 26, 800, arrowColor, arrow) +
		chart,
	);
}

export function renderLive(snap: StatSnapshot, opts: { theme: ThemeName }): string {
	const t = THEMES[opts.theme];
	const color = PLATFORM_COLORS[snap.platform];
	const isLive = snap.liveStatus === "live";

	if (!isLive) {
		return frame(opts.theme,
			`<circle cx="18" cy="18" r="5" fill="#555555"/>` +
			txt(72, 72, 14, 700, t.sub, "OFFLINE") +
			txt(72, 96, 13, 600, t.dim, "Not live"),
		);
	}

	const viewers = formatNum(snap.value);
	const fs = fitFont(viewers, 124, 56);
	const duration = snap.streamStartedAt ? formatDuration(snap.streamStartedAt) : "";
	const peak = snap.peakViewers ? formatNum(snap.peakViewers) : "";
	const liveDot =
		`<circle cx="18" cy="18" r="6" fill="#53FC18">` +
		`<animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>` +
		`</circle>`;

	return frame(opts.theme,
		liveDot +
		txt(72, 30, 13, 800, "#53FC18", `● LIVE  ${duration}`) +
		txt(72, 90, fs, 800, color, viewers) +
		txt(72, 112, 12, 700, t.sub, "VIEWERS") +
		(peak ? txt(72, 134, 11, 600, t.sub, `Peak: ${peak}`) : ""),
	);
}

export function renderPlatformIcon(opts: { theme: ThemeName }): string {
	const t = THEMES[opts.theme];
	return frame(opts.theme, KICK_LOGO + txt(72, 132, 13, 800, t.sub, "KICK"));
}

export function renderAchievement(snap: StatSnapshot, milestoneValue: number, opts: { theme: ThemeName }): string {
	const color = PLATFORM_COLORS[snap.platform];
	const val = formatNum(milestoneValue);
	const label = metricLabel(snap.metric);
	const t = THEMES[opts.theme];

	const PIECES = [
		[18, 20, 9, 4, 40, "#53FC18"], [108, 16, 8, 4, -35, "#30E27B"],
		[14, 58, 7, 4, 20, "#53FC18"], [118, 52, 8, 3, -55, "#7aFF50"],
		[22, 108, 8, 4, 30, "#53FC18"], [112, 104, 7, 4, -40, "#30E27B"],
		[52, 12, 8, 3, 15, "#53FC18"], [88, 14, 9, 3, -25, "#7aFF50"],
		[10, 82, 7, 4, 50, "#53FC18"], [122, 78, 8, 3, -30, "#30E27B"],
		[38, 126, 8, 4, 20, "#53FC18"], [96, 128, 7, 4, -50, "#7aFF50"],
	] as const;

	const confetti = PIECES.map(([x, y, w, h, r, c]) =>
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${c}" opacity="0.9" transform="rotate(${r} ${x + w / 2} ${y + h / 2})"/>`,
	).join("");

	return frame(opts.theme,
		confetti +
		txt(72, 62, 30, 800, "#53FC18", "🏆") +
		txt(72, 90, 20, 800, color, val) +
		txt(72, 110, 11, 700, t.text, label) +
		txt(72, 130, 11, 600, t.sub, "Just reached!"),
	);
}

export function renderMessage(title: string, lines: string[], theme: ThemeName): string {
	const t = THEMES[theme];
	const body = lines.slice(0, 3).map((l, i) => txt(72, 100 + i * 18, 12, 600, t.sub, l)).join("");
	return frame(theme,
		`<circle cx="72" cy="48" r="8" fill="#53FC18"/>` +
		txt(72, 84, 20, 800, t.text, title) +
		body,
	);
}

export interface RenderCtx {
	mode: DisplayMode;
	theme: ThemeName;
	milestoneTarget?: number;
	milestoneAuto?: boolean;
	trendHistory?: number[];
	daysEta?: number | null;
	achievementValue?: number;
	channelName?: string;
}

export function renderKey(snap: StatSnapshot, ctx: RenderCtx): string {
	switch (ctx.mode) {
		case "number":
			return renderBigNumber(snap, { theme: ctx.theme, milestoneTarget: ctx.milestoneTarget, milestoneAuto: ctx.milestoneAuto, channelName: ctx.channelName });
		case "full":
			return renderFullNumber(snap, { theme: ctx.theme, channelName: ctx.channelName });
		case "milestone": {
			const target = ctx.milestoneTarget ?? nextMilestone(snap.value);
			return renderMilestone(snap, target, ctx.daysEta ?? null, { theme: ctx.theme });
		}
		case "trend":
			return renderTrend(snap, ctx.trendHistory ?? [], { theme: ctx.theme });
		case "live":
			return renderLive(snap, { theme: ctx.theme });
		case "platform_icon":
			return renderPlatformIcon({ theme: ctx.theme });
	}
}

export function nextMilestone(n: number): number {
	const thresholds = [
		100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000,
		100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
	];
	return thresholds.find((t) => t > n) ?? Math.ceil(n / 1_000_000) * 1_000_000 + 1_000_000;
}

function metricLabel(metric: import("../platforms/types").MetricKey): string {
	const labels: Record<import("../platforms/types").MetricKey, string> = {
		followers: "FOLLOWERS",
		live_viewers: "VIEWERS",
		followers_today: "NEW FOLLOWS",
	};
	return labels[metric] ?? metric.toUpperCase();
}

function trendLabel(metric: import("../platforms/types").MetricKey): string {
	const labels: Record<import("../platforms/types").MetricKey, string> = {
		followers: "FOLLOWERS",
		live_viewers: "VIEWERS",
		followers_today: "NEW FOLLOWS",
	};
	return labels[metric] ?? metric.toUpperCase();
}
