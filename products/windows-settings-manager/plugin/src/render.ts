import type { ApplyResult, ModeDefinition, SystemSnapshot } from "./types.js";

export function statusTitle(snapshot: SystemSnapshot): string {
  return snapshot.backendOnline ? "PC\nREADY" : "PC\nOFFLINE";
}

export function hdrTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.backendOnline) return "HDR\nOFFLINE";
  if (!snapshot.hdr.available) return "HDR\nN/A";
  if (snapshot.hdr.errors.length > 0) return "HDR\nCHECK";
  if (snapshot.hdr.supportedCount === 0) return "HDR\nN/A";
  if (snapshot.hdr.mixed) return "HDR\nMIXED";
  return snapshot.hdr.enabledCount === snapshot.hdr.supportedCount ? "HDR\nON" : "HDR\nOFF";
}

export function powerTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.backendOnline) return "POWER\nOFFLINE";
  return `POWER\n${powerPlanShort(snapshot.powerPlanName || "UNKNOWN")}`;
}

export function topologyTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.backendOnline) return "DISPLAY\nOFFLINE";
  const label = snapshot.topology === "internal"
    ? "PC ONLY"
    : snapshot.topology === "clone"
      ? "MIRROR"
      : snapshot.topology === "extend"
        ? "EXTEND"
        : snapshot.topology === "external"
          ? "2ND ONLY"
          : "UNKNOWN";
  return `DISPLAY\n${label}`;
}

export function timeoutTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.backendOnline) return "SCREEN\nOFFLINE";
  if (!snapshot.timeout) return "SCREEN\nN/A";
  return `SCREEN\n${duration(snapshot.timeout.monitorAcSeconds)}`;
}

export function awakeTitle(snapshot: SystemSnapshot): string {
  if (!snapshot.backendOnline) return "SLEEP\nOFFLINE";
  return snapshot.keepAwake ? "STAY\nAWAKE" : "SLEEP\nNORMAL";
}

export function currentModeTitle(
  modes: ModeDefinition[],
  snapshot: SystemSnapshot,
  matcher: (mode: ModeDefinition, snapshot: SystemSnapshot) => boolean
): string {
  if (!snapshot.backendOnline) return "MODE\nOFFLINE";
  const configured = modes.filter((mode) => Object.keys(mode.settings ?? {}).length > 0);
  if (!configured.length) return "MODES\nEMPTY";
  const matches = configured.filter((mode) => matcher(mode, snapshot));
  if (!matches.length) return "MODE\nCUSTOM";
  if (matches.length > 1) return "MODE\nMULTI";
  return `MODE\n${short(matches[0].name, 9)}`;
}

export function modeTitle(mode?: ModeDefinition): string {
  return short(mode?.name || "MODE", 10);
}

export function resultTitle(result: ApplyResult): string {
  return `${result.status}\n${short(result.modeName, 9)}`;
}

function powerPlanShort(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim().toUpperCase();
  if (/HIGH PERFORMANCE|ULTIMATE PERFORMANCE/.test(clean)) return "PERFORM";
  if (/BALANCED/.test(clean)) return "BALANCED";
  if (/POWER SAVER|ENERGY SAVER/.test(clean)) return "SAVER";
  return short(clean, 9);
}

function duration(seconds: number): string {
  if (seconds === 0) return "NEVER";
  if (seconds % 3600 === 0) return `${seconds / 3600} HR`;
  if (seconds % 60 === 0) return `${seconds / 60} MIN`;
  return `${seconds} SEC`;
}

function short(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim().toUpperCase();
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(1, max - 1))}…`;
}
