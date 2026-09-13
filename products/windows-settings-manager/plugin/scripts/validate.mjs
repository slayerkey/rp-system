import { spawnSync } from "node:child_process";
import path from "node:path";

for (const flavor of ["lite", "pro"]) {
  const plugin = path.resolve("out", `com.packrat.windows-settings-manager-${flavor}.sdPlugin`);
  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", [
    "streamdeck", "validate", plugin, "--no-update-check"
  ], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
