// Codex adapter — auto-loads the access token from ~/.codex/auth.json (or pasted),
// then reads ChatGPT/Codex usage. Response shape confirmed against a live account
// 2026-09-03; see openai-shared.ts.
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { Provider } from "./types";
import { fetchChatGptUsage, CHATGPT_WINDOWS } from "./openai-shared";

function autoLoad(): string | undefined {
	try {
		const j = JSON.parse(readFileSync(join(homedir(), ".codex", "auth.json"), "utf8"));
		return j?.tokens?.access_token ?? j?.access_token ?? undefined;
	} catch {
		return undefined;
	}
}

export const codexProvider: Provider = {
	id: "codex",
	displayName: "Codex",
	brand: "#10A37F",
	windows: CHATGPT_WINDOWS,
	defaultWindow: "five_hour",
	autoLoadToken: autoLoad,
	fetchUsage: fetchChatGptUsage,
};
