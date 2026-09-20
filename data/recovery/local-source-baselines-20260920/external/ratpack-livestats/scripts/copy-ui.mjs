// Copies the Property Inspector HTML into the plugin bundle folder.
import { copyFileSync, mkdirSync } from "node:fs";

const BASE = process.env.SD_PLUGIN_DIR ?? "com.ratpack.livestats.sdPlugin";
mkdirSync(`${BASE}/ui`, { recursive: true });
copyFileSync("src/ui/stats.html", `${BASE}/ui/stats.html`);
console.log(`✔ Copied Property Inspector → ${BASE}/ui/stats.html`);
