// Resolves the active provider for THIS build from BUILD.id.
import { BUILD } from "./build-info";
import { claudeProvider } from "./claude";
import { codexProvider } from "./codex";
import { openaiProvider } from "./openai";
import { cursorProvider } from "./cursor";
import { geminiProvider } from "./gemini";
import { copilotProvider } from "./copilot";
import { grokProvider } from "./grok";
import { perplexityProvider } from "./perplexity";
import type { Provider } from "./types";

export const REGISTRY: Record<string, Provider> = {
	claude: claudeProvider,
	codex: codexProvider,
	openai: openaiProvider,
	// Side-by-side personal builds. The `local` Claude variant relies on the claudeProvider
	// fallback below, but these two must be mapped explicitly or that fallback would silently
	// point a Codex/ChatGPT key at Claude.
	"codex-local": codexProvider,
	"openai-local": openaiProvider,
	cursor: cursorProvider,
	gemini: geminiProvider,
	copilot: copilotProvider,
	grok: grokProvider,
	perplexity: perplexityProvider,
};

/** Display order for the combined build's provider picker and rollup. */
export const PROVIDER_IDS: string[] = ["claude", "openai", "codex", "cursor", "gemini", "copilot", "grok", "perplexity"];

/** Short tags for the rollup key, where eight names have to fit on one 72x72 face. */
export const PROVIDER_SHORT: Record<string, string> = {
	claude: "CLAUDE",
	openai: "GPT",
	codex: "CODEX",
	cursor: "CURSOR",
	gemini: "GEMINI",
	copilot: "COPILOT",
	grok: "GROK",
	perplexity: "PPLX",
};

/**
 * True only for the combined tracker.
 *
 * Deliberately an exact id match rather than "absent from REGISTRY": the `local` build
 * variant is also absent from it, and inferring would have silently put that build into
 * combined mode, defaulting its keys to the rollup instead of Claude usage.
 */
export const COMBINED_ID = "ai-usage-tracker";
export const IS_COMBINED: boolean = BUILD.id === COMBINED_ID;

/** Look up any provider by id. Falls back to the build's own provider for unknown ids. */
export function providerById(id?: string): Provider {
	return (id ? REGISTRY[id] : undefined) ?? provider;
}

export const provider: Provider = REGISTRY[BUILD.id] ?? claudeProvider;
export { BUILD };
