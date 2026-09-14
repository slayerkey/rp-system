import streamDeck from "@elgato/streamdeck";

const scope = streamDeck.logger.createScope("Wireless");

function safe(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function diag(event: string, details: Record<string, unknown> = {}): void {
  scope.info(`[wireless] ${event} ${safe(details)}`);
}

export function diagError(event: string, error: unknown, details: Record<string, unknown> = {}): void {
  const message = error instanceof Error
    ? { message: error.message, stack: error.stack ?? "" }
    : { message: String(error) };
  scope.error(`[wireless] ${event} ${safe({ ...details, ...message })}`);
}

export function inspectorEventDetails(ev: unknown): Record<string, unknown> {
  const event = ev as any;
  return {
    actionId: String(event?.action?.id ?? ""),
    actionUuid: String(event?.action?.manifestId ?? event?.action?.uuid ?? ""),
    payloadType: String(event?.payload?.type ?? ""),
    actionContext: String(event?.payload?.actionContext ?? "")
  };
}

export const processDetails = {
  pid: process.pid,
  node: process.version,
  arch: process.arch,
  platform: process.platform,
  argv: process.argv
};
