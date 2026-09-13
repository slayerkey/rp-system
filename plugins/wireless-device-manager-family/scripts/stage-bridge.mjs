import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

for (const plugin of ["com.packrat.wireless-device-manager.sdPlugin", "com.packrat.wireless-device-manager-pro.sdPlugin"]) {
  const bin = path.resolve(plugin, "bin");
  await mkdir(bin, { recursive: true });
  await copyFile("bridge/dist/x64/WirelessDeviceBridge.exe", path.join(bin, "wireless-device-bridge-x64.exe"));
  await copyFile("bridge/dist/arm64/WirelessDeviceBridge.exe", path.join(bin, "wireless-device-bridge-arm64.exe"));
}
console.log("Staged x64 and arm64 Wireless Device Bridge binaries.");
