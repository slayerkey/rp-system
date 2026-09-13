import { spawnSync } from "node:child_process";

function fail(message) {
  console.error("");
  console.error("Audio Manager Pro native build prerequisite failed.");
  console.error(message);
  console.error("");
  console.error("Install the .NET 8 SDK in PowerShell:");
  console.error("  winget install --exact --id Microsoft.DotNet.SDK.8 --accept-package-agreements --accept-source-agreements");
  console.error("");
  console.error("Then verify:");
  console.error("  dotnet --list-sdks");
  console.error("");
  console.error("After an 8.x SDK appears, rerun:");
  console.error("  rat dev audio-manager-pro");
  process.exit(1);
}

const probe = spawnSync("dotnet", ["--list-sdks"], {
  encoding: "utf8",
  windowsHide: true,
});

if (probe.error?.code === "ENOENT") {
  fail("The dotnet command is not installed.");
}
if (probe.status !== 0) {
  fail(`dotnet --list-sdks failed with exit code ${probe.status ?? "unknown"}.`);
}

const sdks = String(probe.stdout || "")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const hasNet8 = sdks.some((line) => /^8\./.test(line));

if (!hasNet8) {
  fail(
    sdks.length
      ? `No .NET 8 SDK is installed. Detected SDKs: ${sdks.join(", ")}`
      : "No .NET SDKs are installed. A runtime alone cannot build Audio Manager Pro."
  );
}

console.log(`Audio Manager Pro .NET prerequisite: PASS (${sdks.find((line) => /^8\./.test(line))})`);
