// Claude adapter. Auto-loaded `oat` token → OAuth endpoint (easy default); pasted `sid`
// session key → claude.ai (reliable fallback). Same normalized windows either way.
import { fetchUsage as fetchSession, fetchUsageOAuth, type UsageResponse } from "../usage/client";
import { autoLoadToken } from "../auth/credentials";
import type { Provider, WindowData, WindowDef, FetchResult } from "./types";

// Max plans get a second weekly cap for the premium model on top of the all-models one.
// Anthropic names it per model family, so we don't hardcode the name — one stable key,
// with the label taken from whatever the account actually reports.
export const MODEL_WEEKLY = "weekly_model";

const WINDOWS: WindowDef[] = [
	{ key: "five_hour", label: "5H", cyclable: true },
	{ key: "seven_day", label: "WEEK", cyclable: true },
	{ key: MODEL_WEEKLY, label: "FABLE", cyclable: false, naLines: ["not on", "your plan"] },
	{ key: "extra_usage", label: "CREDITS", cyclable: false },
];

// "weekly_fable" | "seven_day_opus" → "FABLE" | "OPUS". Labels render at 15px with no
// auto-fit (src/render/svg.ts), so keep them short.
function shortLabel(kind: string): string {
	return kind.replace(/^(weekly|seven_day)_/, "").toUpperCase().slice(0, 6);
}

/** The model-specific weekly cap, from `limits[]` if present, else the legacy fields. */
function modelWeekly(r: UsageResponse): WindowData | null {
	const l = r.limits?.find((x) => x.group === "weekly" && x.kind !== "weekly_all");
	if (l) return { key: MODEL_WEEKLY, label: shortLabel(l.kind), utilization: l.percent, resetsAt: l.resets_at };
	for (const k of ["seven_day_opus", "seven_day_sonnet"] as const) {
		const w = r[k];
		if (w) return { key: MODEL_WEEKLY, label: shortLabel(k), utilization: w.utilization, resetsAt: w.resets_at };
	}
	return null;
}

function normalize(r: UsageResponse): WindowData[] {
	const out: WindowData[] = [];
	const add = (key: string, label: string, w: { utilization: number; resets_at: string } | null): void => {
		if (w) out.push({ key, label, utilization: w.utilization, resetsAt: w.resets_at });
	};
	add("five_hour", "5H", r.five_hour);
	add("seven_day", "WEEK", r.seven_day);
	// Must stay at index ≥ 2: Overview and the heatmap read windows[0] / windows[1].
	const mw = modelWeekly(r);
	if (mw) out.push(mw);
	if (r.extra_usage?.is_enabled && r.extra_usage.utilization !== null) {
		out.push({ key: "extra_usage", label: "CREDITS", utilization: r.extra_usage.utilization });
	}
	return out;
}

export const claudeProvider: Provider = {
	id: "claude",
	displayName: "Claude",
	brand: "#FF8A3D",
	windows: WINDOWS,
	defaultWindow: "five_hour",
	autoLoadToken,
	async fetchUsage(token: string): Promise<FetchResult> {
		const r = token.startsWith("sk-ant-oat") ? await fetchUsageOAuth(token) : await fetchSession(token);
		if (!r.ok) return r;
		return { ok: true, usage: { windows: normalize(r.data) } };
	},
};
