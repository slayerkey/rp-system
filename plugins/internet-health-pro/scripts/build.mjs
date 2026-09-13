import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const plugin = path.join(root, "com.packrat.internet-health-pro.sdPlugin");
const sourceUi = path.join(root, "ui");
const targetUi = path.join(plugin, "ui");
fs.mkdirSync(path.join(plugin, "bin"), { recursive: true });
fs.rmSync(targetUi, { recursive: true, force: true });
fs.cpSync(sourceUi, targetUi, { recursive: true });
