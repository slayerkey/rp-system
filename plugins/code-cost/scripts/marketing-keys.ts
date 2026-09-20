/**
 * Writes the key faces the listing art uses, straight from the shipping renderers.
 *
 * Both cost plugins draw their keys at runtime, so there is no static PNG for the marketing
 * generator to pull. Rendering them here keeps the listing honest: every key in the art is a
 * real badge from the real code path, not a mockup.
 *
 *   npx tsx plugins/code-cost/scripts/marketing-keys.ts <outDir>
 *   node tools/art/svg_to_png.mjs <outDir> plugins
 *
 * The numbers are representative of a working week on a $100 plan, not the author's own
 * spend. They are the shape a buyer will actually see rather than an outlier, and nobody's
 * personal billing goes into a public listing.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { costBadge as liteCost, messageBadge as liteMessage, money } from "../src/badge";
import {
	breakdownBadge,
	cacheBadge,
	costBadge as proCost,
	prettyModel,
	sparkBadge,
	valueBadge
} from "../../code-cost-pro/src/faces";

const out = process.argv[2] ?? "marketing-keys";

const DAILY = [12.4, 9.8, 21.6, 0, 18.2, 27.4, 14.9, 31.2, 8.6, 0, 19.7, 24.1, 16.3, 22.8];
const MONTH = 487.3;

const faces: Record<string, Record<string, string>> = {
	"code-cost": {
		today: liteCost({ period: "Today", value: money(18.4) }),
		week: liteCost({ period: "7 Days", value: money(126.8) }),
		month: liteCost({ period: "30 Days", value: money(MONTH) }),
		claude: liteCost({ period: "7 Days", value: money(98.15), sub: "Claude Code" }),
		codex: liteCost({ period: "7 Days", value: money(28.65), sub: "Codex" }),
		// The honest states matter as much as the happy ones: a buyer should see what the key
		// does when it cannot read anything, and when a model has no price on file.
		partial: liteCost({ period: "30 Days", value: money(MONTH), partial: true }),
		nologs: liteMessage("NO LOGS", "FOUND")
	},
	"code-cost-pro": {
		value: valueBadge(MONTH / 100, MONTH, 100),
		valuelow: valueBadge(0.6, 61.2, 100),
		budget: proCost("30 Days", money(MONTH), { used: MONTH, cap: 600 }),
		over: proCost("30 Days", money(742.5), { used: 742.5, cap: 600 }),
		bymodel: breakdownBadge("By model", [
			[prettyModel("claude-opus-5"), 321.4],
			[prettyModel("claude-sonnet-5"), 124.7],
			[prettyModel("gpt-5.6-sol"), 41.2]
		]),
		byproject: breakdownBadge("By project", [
			["client-api", 268.9],
			["site-rebuild", 142.3],
			["scratch", 76.1]
		]),
		cache: cacheBadge(91, 884.6),
		trend: sparkBadge("14 day trend", money(227.0), DAILY)
	}
};

for (const [slug, set] of Object.entries(faces)) {
	const dir = path.join(out, slug);
	mkdirSync(dir, { recursive: true });
	for (const [name, svg] of Object.entries(set)) {
		writeFileSync(path.join(dir, `${name}.svg`), svg, "utf-8");
	}
	console.log(`${slug}: ${Object.keys(set).length} faces -> ${dir}`);
}
