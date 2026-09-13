import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, "..", "_shared", "monitor-manager", "windows", "monitor-helper.ps1");
const targetDir = path.join(root, "com.packrat.monitormanagerlite.sdPlugin", "helper");
await mkdir(targetDir, { recursive: true });
await copyFile(source, path.join(targetDir, "monitor-helper.ps1"));
console.log("Copied Monitor Manager Windows helper.");
