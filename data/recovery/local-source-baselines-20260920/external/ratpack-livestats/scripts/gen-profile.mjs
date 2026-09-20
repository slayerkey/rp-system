// Generates the default "Creator Dashboard MK2.streamDeckProfile" file.
// Stream Deck MK2: 5 columns × 3 rows = 15 keys.
// Users import this via Stream Deck software → Profiles → Import.
import archiver from "archiver";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "profiles";
const OUT_FILE = join(OUT_DIR, "Creator Dashboard MK2.streamDeckProfile");
mkdirSync(OUT_DIR, { recursive: true });

const ACTION_UUID = "com.ratpack.livestats.stats";

function key(col, row, metric, platform, displayMode, extra = {}) {
	return {
		UUID: ACTION_UUID,
		Settings: {
			platform,
			metric,
			displayMode,
			theme: "oled",
			milestoneAuto: true,
			showDelta: true,
			deltaWindow: "today",
			...extra,
		},
		State: 0,
		Row: row,
		Column: col,
	};
}

// 15-key layout for MK2
const actions = [
	// ── Row 0: YouTube ─────────────────────────────────────────────────────
	key(0, 0, "subscribers", "youtube", "platform_icon"),           // YouTube logo key
	key(1, 0, "subscribers", "youtube", "number"),                  // Sub count
	key(2, 0, "views_today", "youtube", "number"),                  // Today's views
	key(3, 0, "subscribers", "youtube", "milestone"),               // Milestone progress
	key(4, 0, "subscribers", "youtube", "trend", { deltaWindow: "7d" }), // 7-day trend

	// ── Row 1: Twitch ───────────────────────────────────────────────────────
	key(0, 1, "followers", "twitch", "platform_icon"),              // Twitch logo key
	key(1, 1, "followers", "twitch", "number"),                     // Follower count
	key(2, 1, "live_viewers", "twitch", "live"),                    // Live viewers
	key(3, 1, "twitch_subs", "twitch", "number"),                   // Twitch subs
	key(4, 1, "followers_today", "twitch", "number"),               // New follows today

	// ── Row 2: Advanced / Mixed ─────────────────────────────────────────────
	key(0, 2, "subscribers", "youtube", "multi"),                   // Multi-stat overview
	key(1, 2, "upload_streak", "youtube", "streak"),                // Upload streak
	key(2, 2, "estimated_revenue", "youtube", "number"),            // Est. revenue
	key(3, 2, "comments_today", "youtube", "number"),               // Comments today
	// [4, 2] intentionally empty — user's custom slot
];

const profileManifest = {
	Version: 1,
	Name: "Creator Dashboard",
	DeviceType: 1, // 1 = MK2 (5×3)
	Columns: 5,
	Rows: 3,
};

const page = {
	Actions: actions,
};

// Build ZIP
const output = createWriteStream(OUT_FILE);
const archive = archiver("zip", { zlib: { level: 9 } });

archive.pipe(output);
archive.append(JSON.stringify(profileManifest, null, 2), { name: "manifest.json" });
archive.append(JSON.stringify(page, null, 2), { name: "Pages/page1.json" });

output.on("close", () => {
	console.log(`✔ Profile written: ${OUT_FILE} (${archive.pointer()} bytes)`);
	console.log("   Import via: Stream Deck software → ☰ → Import Profile");
});

archive.on("error", (err) => { throw err; });
archive.finalize();
