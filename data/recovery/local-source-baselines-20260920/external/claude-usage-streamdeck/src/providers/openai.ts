// ChatGPT adapter — pasted chatgpt.com access token or session cookie → ChatGPT usage.
// Response shape confirmed against a live Plus account 2026-09-03; see openai-shared.ts.
import type { Provider } from "./types";
import { fetchChatGptUsage, CHATGPT_WINDOWS } from "./openai-shared";

export const openaiProvider: Provider = {
	id: "openai",
	displayName: "ChatGPT",
	brand: "#10A37F",
	windows: CHATGPT_WINDOWS,
	defaultWindow: "five_hour",
	fetchUsage: fetchChatGptUsage,
};
