// Per-provider build config: identity, branding, windows, and token instructions.
// build-provider.mjs reads this to stamp out each branded plugin from the shared engine.

export const PROVIDERS = {
	claude: {
		id: "claude",
		name: "Claude Usage",
		display: "Claude",
		uuid: "com.ratpack.claude-usage",
		actionUuid: "com.ratpack.claude-usage.monitor",
		brand: "#FF8A3D",
		autoload: true,
		version: "0.1.3.0", // light theme fix: ring's reset-time text was invisible (white on white)
		help: `<p>Log in to <code>claude.ai</code>, then copy the <code>sessionKey</code> cookie value (starts with <code>sk-ant-sid01-…</code>).</p>
			<details class="browser"><summary>Chrome / Edge / Arc / Brave</summary><ol>
				<li>On claude.ai, open DevTools (<code>F12</code>)</li>
				<li><b>Application</b> tab → <b>Storage → Cookies → https://claude.ai</b></li>
				<li>Find <code>sessionKey</code>, right-click its <b>Value</b> → <b>Copy value</b></li></ol></details>
			<details class="browser"><summary>Firefox</summary><ol>
				<li><code>F12</code> → <b>Storage</b> → Cookies → claude.ai → <code>sessionKey</code> → right-click → Copy</li></ol></details>
			<details class="browser"><summary>Safari</summary><ol>
				<li>Enable Develop menu (Settings → Advanced → “Show features for web developers”)</li>
				<li><code>Cmd+Opt+I</code> → Storage → Cookies → claude.ai → <code>sessionKey</code></li></ol></details>`,
		windows: [
			{ value: "five_hour", label: "5-hour session" },
			{ value: "seven_day", label: "Weekly" },
			{ value: "weekly_model", label: "Model weekly (Fable / Opus)" },
			{ value: "extra_usage", label: "Extra credits" },
			{ value: "overview", label: "Overview (5h + Week)" },
		],
	},
	codex: {
		id: "codex",
		name: "Codex Usage",
		display: "Codex",
		uuid: "com.ratpack.codex-usage",
		actionUuid: "com.ratpack.codex-usage.monitor",
		brand: "#10A37F",
		autoload: true,
		version: "0.1.3.0", // shares the ChatGPT adapter, so it gets the session-cookie fix
		help: `<p>If you have the <b>Codex CLI</b> installed, your token is auto-detected — usually nothing to paste. If usage isn't updating, paste your ChatGPT session token below.</p>
			<details class="browser"><summary>Get your ChatGPT session token</summary><ol>
				<li>Log in to <code>chatgpt.com</code></li>
				<li>In the same browser, go to <code>chatgpt.com/api/auth/session</code></li>
				<li>You'll see JSON on the page — find <code>"accessToken"</code></li>
				<li>Copy the value (it starts with <code>eyJ…</code>) and paste it below — no surrounding quotes</li></ol></details>
			<details class="browser"><summary>Keeps saying "Expired"? Use the cookie instead</summary>
				<p>The <code>accessToken</code> is short-lived. The session cookie lasts far longer, and the plugin refreshes the token from it automatically.</p><ol>
				<li>On <code>chatgpt.com</code>, open DevTools (<code>F12</code>)</li>
				<li><b>Application</b> tab → <b>Storage → Cookies → https://chatgpt.com</b></li>
				<li>Find <code>__Secure-next-auth.session-token</code>, right-click its <b>Value</b> → <b>Copy value</b></li>
				<li>Paste it below in place of the access token</li></ol></details>
			<details class="browser"><summary>Get token from Codex auth file</summary><ol>
				<li>Open <code>~/.codex/auth.json</code> in any text editor</li>
				<li>Copy the value of <code>tokens.access_token</code></li>
				<li>Paste it below</li></ol></details>`,
		windows: [
			{ value: "five_hour", label: "5-hour session" },
			{ value: "seven_day", label: "Weekly" },
			{ value: "overview", label: "Overview (5h + Week)" },
		],
	},
	openai: {
		id: "openai",
		name: "ChatGPT Usage",
		display: "ChatGPT",
		uuid: "com.ratpack.chatgpt-usage",
		actionUuid: "com.ratpack.chatgpt-usage.monitor",
		brand: "#10A37F",
		version: "0.1.6.0", // Credits key shows the real balance instead of claiming there is none
		help: `<p>Log in to <code>chatgpt.com</code>, then go to <code>chatgpt.com/api/auth/session</code> in the same browser. Copy the <code>accessToken</code> value from the JSON that appears.</p>
			<details class="browser"><summary>Step by step</summary><ol>
				<li>Go to <code>chatgpt.com</code> and sign in</li>
				<li>In the same tab, navigate to <code>chatgpt.com/api/auth/session</code></li>
				<li>You'll see JSON on the page — look for <code>"accessToken"</code></li>
				<li>Copy the value (starts with <code>eyJ…</code>) and paste it below</li>
				<li>Paste the value only — no surrounding quotes</li></ol></details>
			<details class="browser"><summary>Keeps saying "Expired"? Use the cookie instead</summary>
				<p>The <code>accessToken</code> above is short-lived. The session cookie lasts far longer, and the plugin refreshes the token from it automatically.</p><ol>
				<li>On <code>chatgpt.com</code>, open DevTools (<code>F12</code>)</li>
				<li><b>Application</b> tab → <b>Storage → Cookies → https://chatgpt.com</b></li>
				<li>Find <code>__Secure-next-auth.session-token</code>, right-click its <b>Value</b> → <b>Copy value</b></li>
				<li>Paste it below in place of the access token</li></ol></details>`,
		windows: [
			{ value: "five_hour", label: "5-hour session" },
			{ value: "seven_day", label: "Weekly" },
			{ value: "credits", label: "Credits" },
			{ value: "overview", label: "Overview (5h + Week)" },
		],
	},
	local: {
		id: "local",
		name: "Claude Usage (Local)",
		version: "0.1.3.0", // tracks the claude SKU, see the note in localVariant
		display: "Claude",
		uuid: "com.ratpack.claude-usage.local",
		actionUuid: "com.ratpack.claude-usage.local.monitor",
		brand: "#FF8A3D",
		autoload: true,
		help: `<p>Log in to <code>claude.ai</code>, then copy the <code>sessionKey</code> cookie value (starts with <code>sk-ant-sid01-…</code>).</p>
			<details class="browser"><summary>Chrome / Edge / Arc / Brave</summary><ol>
				<li>On claude.ai, open DevTools (<code>F12</code>)</li>
				<li><b>Application</b> tab → <b>Storage → Cookies → https://claude.ai</b></li>
				<li>Find <code>sessionKey</code>, right-click its <b>Value</b> → <b>Copy value</b></li></ol></details>
			<details class="browser"><summary>Firefox</summary><ol>
				<li><code>F12</code> → <b>Storage</b> → Cookies → claude.ai → <code>sessionKey</code> → right-click → Copy</li></ol></details>
			<details class="browser"><summary>Safari</summary><ol>
				<li>Enable Develop menu (Settings → Advanced → "Show features for web developers")</li>
				<li><code>Cmd+Opt+I</code> → Storage → Cookies → claude.ai → <code>sessionKey</code></li></ol></details>`,
		windows: [
			{ value: "five_hour", label: "5-hour session" },
			{ value: "seven_day", label: "Weekly" },
			{ value: "weekly_model", label: "Model weekly (Fable / Opus)" },
			{ value: "extra_usage", label: "Extra credits" },
			{ value: "overview", label: "Overview (5h + Week)" },
		],
	},
	cursor: {
		id: "cursor",
		name: "Cursor Usage",
		display: "Cursor",
		uuid: "com.ratpack.cursor-usage",
		actionUuid: "com.ratpack.cursor-usage.monitor",
		brand: "#6B8AFF",
		help: `<p>Log in to <code>cursor.com</code>, then open DevTools and copy the <code>WorkosCursorSessionToken</code> cookie value.</p>
			<details class="browser"><summary>Chrome / Edge / Arc / Brave</summary><ol>
				<li>Go to <code>cursor.com</code> and make sure you're logged in</li>
				<li>Open DevTools (<code>F12</code>)</li>
				<li><b>Application</b> tab → <b>Storage → Cookies → https://cursor.com</b></li>
				<li>Find <code>WorkosCursorSessionToken</code>, right-click its <b>Value</b> → <b>Copy value</b></li></ol></details>
			<details class="browser"><summary>Firefox</summary><ol>
				<li><code>F12</code> → <b>Storage</b> → Cookies → cursor.com → <code>WorkosCursorSessionToken</code> → right-click → Copy</li></ol></details>
			<details class="browser"><summary>Safari</summary><ol>
				<li>Enable Develop menu (Settings → Advanced → "Show features for web developers")</li>
				<li><code>Cmd+Opt+I</code> → Storage → Cookies → cursor.com → <code>WorkosCursorSessionToken</code></li></ol></details>`,
		windows: [{ value: "month", label: "Monthly requests" }],
	},
	gemini: {
		id: "gemini",
		name: "Gemini Usage",
		display: "Gemini",
		uuid: "com.ratpack.gemini-usage",
		actionUuid: "com.ratpack.gemini-usage.monitor",
		brand: "#4285F4",
		autoload: true,
		help: `<p>Install the <b>Gemini CLI</b> and run <code>gemini auth</code> once — your token is then auto-detected with nothing to paste. If auto-detect isn't working, paste your Google access token below.</p>
			<details class="browser"><summary>Get your Gemini CLI access token manually</summary><ol>
				<li>Make sure <code>gemini</code> CLI is installed and you've run <code>gemini auth</code></li>
				<li>Open <code>~/.gemini/oauth_creds.json</code> in any text editor</li>
				<li>Copy the value of <code>"token"</code> (starts with <code>ya29.</code>)</li>
				<li>Paste it below — note Google tokens expire after 1 hour; run <code>gemini auth</code> again to refresh</li></ol></details>
			<details class="browser"><summary>Install Gemini CLI</summary><ol>
				<li>Requires Node.js 18+ installed</li>
				<li>Run: <code>npm install -g @google/gemini-cli</code></li>
				<li>Then run: <code>gemini auth</code> and follow the browser prompt</li></ol></details>`,
		windows: [
			{ value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
			{ value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
		],
	},
	copilot: {
		id: "copilot",
		name: "Copilot Usage",
		display: "Copilot",
		uuid: "com.ratpack.copilot-usage",
		actionUuid: "com.ratpack.copilot-usage.monitor",
		brand: "#8957E5",
		autoload: true,
		version: "0.2.1.0",
		help: `<p>If you have the <b>GitHub CLI</b> (<code>gh</code>) installed and signed in, your token is auto-detected, nothing to paste. Otherwise, create a GitHub Personal Access Token and paste it below.</p>
			<details class="browser"><summary>Auto-detect: sign in with GitHub CLI</summary><ol>
				<li>Install the GitHub CLI: <a href="https://cli.github.com" target="_blank">cli.github.com</a></li>
				<li>Run: <code>gh auth login</code> and follow the prompts</li>
				<li>Restart this plugin, your token is now auto-detected</li></ol></details>
			<details class="browser"><summary>Manual: create a GitHub Personal Access Token</summary><ol>
				<li>Go to <code>github.com/settings/tokens</code></li>
				<li>Click <b>Generate new token (classic)</b></li>
				<li>Give it a name, set expiry, and check the <b>user</b> scope</li>
				<li>If your Copilot comes from an employer, also check <b>read:org</b></li>
				<li>Click <b>Generate token</b> and copy the value (starts with <code>ghp_</code>)</li>
				<li>Paste it below</li></ol></details>
			<details class="browser"><summary>Copilot provided by your employer</summary>
				<p>Company licences bill AI credits to the organization rather than to you, so the token needs the <b>read:org</b> scope to find them.</p>
				<p>If your company uses single sign-on, open <code>github.com/settings/tokens</code>, find your token and click <b>Configure SSO</b> to authorise it for the organization. Without that step GitHub hides the organization from the token.</p>
				<p>Then set <b>Type</b> to <b>BUSINESS</b> or <b>ENTERPRISE</b> to match your plan.</p></details>
			<p>Then set the <b>Type</b> dropdown to your Copilot plan: <b>PRO</b> (1,500 credits), <b>PRO+</b> (7,000), <b>MAX</b> (20,000), <b>BUSINESS</b> (300) or <b>ENTERPRISE</b> (1,000).</p>`,
		windows: [
			{ value: "pro", label: "Copilot Pro (1.5K)" },
			{ value: "proplus", label: "Copilot Pro+ (7K)" },
			{ value: "max", label: "Copilot Max (20K)" },
			{ value: "business", label: "Copilot Business (300)" },
			{ value: "enterprise", label: "Copilot Enterprise (1K)" },
		],
	},
	grok: {
		id: "grok",
		name: "Grok Usage",
		display: "Grok",
		uuid: "com.ratpack.grok-usage",
		actionUuid: "com.ratpack.grok-usage.monitor",
		brand: "#FF3B5C",
		help: `<p>Log in to <code>grok.com</code>, then copy the full <b>Cookie</b> header value from the Network tab — this is more reliable than looking for a specific cookie name.</p>
			<details class="browser"><summary>Chrome / Edge / Arc / Brave</summary><ol>
				<li>Go to <code>grok.com</code> and make sure you're signed in</li>
				<li>Open DevTools (<code>F12</code>) → <b>Network</b> tab</li>
				<li>Refresh the page, then click on any request to <code>grok.com</code></li>
				<li>In the <b>Headers</b> panel, find <b>Request Headers → Cookie</b></li>
				<li>Click the value and select all (<code>Ctrl+A</code>), then copy it</li>
				<li>Paste the entire Cookie string below</li></ol></details>
			<details class="browser"><summary>Firefox</summary><ol>
				<li><code>F12</code> → <b>Network</b> → reload → click a grok.com request → <b>Request</b> tab → find <code>Cookie</code> header → copy the full value</li></ol></details>
			<details class="browser"><summary>Safari</summary><ol>
				<li>Enable Develop menu (Settings → Advanced → "Show features for web developers")</li>
				<li><code>Cmd+Opt+I</code> → Network → reload → click a request → Headers → Cookie → copy full value</li></ol></details>`,
		windows: [
			{ value: "default", label: "Grok 3 (Standard)" },
			{ value: "grok4", label: "Grok 4 (Heavy)" },
			{ value: "reasoning", label: "Grok 3 (Reasoning)" },
			{ value: "deepsearch", label: "Grok 3 (DeepSearch)" },
		],
	},
	perplexity: {
		id: "perplexity",
		name: "Perplexity Usage",
		display: "Perplexity",
		uuid: "com.ratpack.perplexity-usage",
		actionUuid: "com.ratpack.perplexity-usage.monitor",
		brand: "#20B2AA",
		version: "0.1.2.0", // accept Perplexity's current secure session-cookie name
		help: `<p>Log in to <code>perplexity.ai</code>, then copy the <code>__Secure-next-auth.session-token</code> cookie value from browser DevTools.</p>
			<details class="browser"><summary>Chrome / Edge / Arc / Brave</summary><ol>
				<li>Go to <code>perplexity.ai</code> and make sure you're signed in to your Pro account</li>
				<li>Open DevTools (<code>F12</code>)</li>
				<li><b>Application</b> tab → <b>Storage → Cookies → https://www.perplexity.ai</b></li>
				<li>Find <code>__Secure-next-auth.session-token</code>, right-click its <b>Value</b> → <b>Copy value</b></li>
				<li>Paste it below</li></ol></details>
			<details class="browser"><summary>Firefox</summary><ol>
				<li><code>F12</code> → <b>Storage</b> → Cookies → perplexity.ai → <code>__Secure-next-auth.session-token</code> → right-click → Copy</li></ol></details>
			<details class="browser"><summary>Safari</summary><ol>
				<li>Enable Develop menu (Settings → Advanced → "Show features for web developers")</li>
				<li><code>Cmd+Opt+I</code> → Storage → Cookies → perplexity.ai → <code>__Secure-next-auth.session-token</code></li></ol></details>
			<p>Use the <b>Type</b> dropdown to switch between Pro queries (weekly), Research (weekly), and Labs (daily).</p>`,
		windows: [
			{ value: "pro", label: "Pro queries (weekly)" },
			{ value: "research", label: "Research (weekly)" },
			{ value: "agentic", label: "Agentic Research (weekly)" },
			{ value: "labs", label: "Labs (daily)" },
		],
	},
};

// Personal side-by-side builds, same engine and help text as the shipped SKUs but on their own
// UUIDs so they install alongside a Marketplace copy instead of colliding with it. Mirrors the
// hand-written `local` (Claude) entry above. Their ids are mapped in src/providers/active.ts.
function localVariant(base, uuid) {
	// The name MUST differ from the shipped SKU. cfg.name becomes the manifest Name, the
	// Category and the action Name, so a local build that borrowed the retail name showed up
	// in the actions list as a second, identical "ChatGPT Usage" with no way to tell which
	// was which. Two entries, separate settings, one of them stale: reported 2026-08-31.
	return {
		...PROVIDERS[base],
		name: `${PROVIDERS[base].name} (Local)`,
		id: `${base}-local`,
		uuid,
		actionUuid: `${uuid}.monitor`,
		// Inherit the SKU's version rather than pinning to the manifest default. A local
		// build frozen at 0.1.1.0 cannot be reinstalled over itself, so it sat on the deck
		// with stale code while its retail twin got fixed, and the two were indistinguishable.
	};
}
PROVIDERS["codex-local"] = localVariant("codex", "com.ratpack.codex-usage.local");
PROVIDERS["openai-local"] = localVariant("openai", "com.ratpack.chatgpt-usage.local");
