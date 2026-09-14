import { spawnSync } from "node:child_process";
import path from "node:path";

const cli = path.resolve("node_modules", "@elgato", "cli", "bin", "streamdeck.mjs");

for (const flavor of ["lite", "pro"]) {
  const plugin = path.resolve("out", `com.packrat.windows-settings-manager-${flavor}2.sdPlugin`);
  const result = spawnSync(process.execPath, [
    cli, "validate", plugin, "--no-update-check"
  ], { stdio: "inherit" });

  if (result.error) {
    console.error(`Could not launch Elgato CLI for ${flavor}:`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
