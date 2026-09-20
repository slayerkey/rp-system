import { copyFileSync, mkdirSync } from "node:fs";

const BASE = process.env.SD_PLUGIN_DIR ?? "com.ratpack.kick.sdPlugin";
mkdirSync(`${BASE}/ui`, { recursive: true });
copyFileSync("src/ui/stats.html", `${BASE}/ui/stats.html`);
console.log(`✔ Copied Property Inspector → ${BASE}/ui/stats.html`);
