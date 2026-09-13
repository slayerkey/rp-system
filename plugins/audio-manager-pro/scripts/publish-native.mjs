import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SDK_VERSION = "8.0.425";
const root = resolve(import.meta.dirname, "..");
const project = resolve(root, "native", "PackRat.AudioManager.Helper", "PackRat.AudioManager.Helper.csproj");
const output = resolve(root, "com.packrat.audio-manager-pro.sdPlugin", "native", "win-x64");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    windowsHide: true,
    env: options.env || process.env,
  });
}

function hasNet8(command, env = process.env) {
  const probe = run(command, ["--list-sdks"], { capture: true, env });
  if (probe.error || probe.status !== 0) return false;
  return String(probe.stdout || "")
    .split(/\r?\n/)
    .some((line) => /^8\./.test(line.trim()));
}

function fail(message) {
  console.error("");
  console.error("Audio Manager Pro native build failed.");
  console.error(message);
  process.exit(1);
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status} downloading ${url}`);
  const body = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, body);
}

async function ensureDotnet() {
  if (hasNet8("dotnet")) {
    console.log("Audio Manager Pro native build: using installed .NET 8 SDK.");
    return { command: "dotnet", env: process.env };
  }

  if (process.platform !== "win32") {
    fail("No .NET 8 SDK was found. Automatic PackRat SDK bootstrapping is currently supported on Windows only.");
  }

  const localBase = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  const installDir = join(localBase, "PackRat", "tools", "dotnet", SDK_VERSION);
  const dotnet = join(installDir, "dotnet.exe");
  const env = {
    ...process.env,
    DOTNET_ROOT: installDir,
    DOTNET_MULTILEVEL_LOOKUP: "0",
  };

  if (existsSync(dotnet) && hasNet8(dotnet, env)) {
    console.log(`Audio Manager Pro native build: using cached PackRat .NET SDK ${SDK_VERSION}.`);
    return { command: dotnet, env };
  }

  await mkdir(installDir, { recursive: true });
  const installer = join(tmpdir(), "packrat-dotnet-install.ps1");

  console.log(`Audio Manager Pro needs .NET SDK ${SDK_VERSION} to compile its Windows audio helper.`);
  console.log("No compatible SDK is installed, so Rat Dev is bootstrapping a private PackRat build SDK.");
  console.log(`Cache: ${installDir}`);

  try {
    await download("https://dot.net/v1/dotnet-install.ps1", installer);
  } catch (error) {
    fail(`Could not download Microsoft's official dotnet-install.ps1: ${error?.message || error}`);
  }

  const install = run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", installer,
    "-Version", SDK_VERSION,
    "-InstallDir", installDir,
    "-Architecture", "x64",
    "-NoPath",
  ]);

  if (install.error) {
    fail(`Could not start Microsoft's .NET installer: ${install.error.message}`);
  }
  if (install.status !== 0) {
    fail(`Microsoft .NET SDK bootstrap exited with code ${install.status}.`);
  }
  if (!existsSync(dotnet) || !hasNet8(dotnet, env)) {
    fail("The private .NET SDK bootstrap completed but no usable .NET 8 SDK was found.");
  }

  console.log(`Audio Manager Pro native build: private .NET SDK ${SDK_VERSION} ready.`);
  return { command: dotnet, env };
}

const sdk = await ensureDotnet();
await mkdir(output, { recursive: true });

const publish = run(sdk.command, [
  "publish",
  project,
  "-c", "Release",
  "-r", "win-x64",
  "--self-contained", "true",
  "-o", output,
], { env: sdk.env });

if (publish.error) {
  fail(`Could not start dotnet publish: ${publish.error.message}`);
}
if (publish.status !== 0) {
  fail(`dotnet publish exited with code ${publish.status}.`);
}
