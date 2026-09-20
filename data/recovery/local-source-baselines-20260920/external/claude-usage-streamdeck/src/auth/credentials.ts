// Best-effort zero-config fallback: the OAuth access token Claude Code stores locally.
// Used only when the user hasn't pasted a session key. Read-only; stays on the machine.
import { readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function fromCreds(json: string): string | undefined {
	const o = JSON.parse(json)?.claudeAiOauth;
	if (o?.accessToken && (!o.expiresAt || o.expiresAt > Date.now())) return o.accessToken as string;
	return undefined;
}

export function autoLoadToken(): string | undefined {
	try {
		return fromCreds(readFileSync(join(homedir(), ".claude", ".credentials.json"), "utf8"));
	} catch {
		/* file not present — try keychain on macOS */
	}
	if (process.platform === "darwin") {
		try {
			const out = execFileSync(
				"security",
				["find-generic-password", "-s", "Claude Code-credentials", "-a", userInfo().username, "-w"],
				{ encoding: "utf8" },
			);
			return fromCreds(out);
		} catch {
			/* no keychain entry */
		}
	}
	return undefined;
}
