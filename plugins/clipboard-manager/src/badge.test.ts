/** Key face rendering. Run with: npm run test:badge */
import { emptySlotBadge, escapeXml, keyImage, previewText, slotBadge } from "./badge";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
	const ok = actual === expected;
	if (!ok) failures++;
	console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`}`);
}

console.log("Key faces");

check("short text is shown whole", previewText("hello", 40), "hello");
check("a long copy is cut to the preview length", previewText("x".repeat(100), 20).length, 20);
check("a cut copy ends in an ellipsis", previewText("x".repeat(100), 20).endsWith("…"), true);
check("a pasted paragraph reads as one line", previewText("one\n\ttwo   three", 40), "one two three");
check("text exactly at the limit is left alone", previewText("x".repeat(20), 20), "x".repeat(20));

// Every state has to produce a real image, because a key that renders nothing looks
// identical to a plugin that has crashed.
const decode = (uri: string) => Buffer.from(uri.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");

check("a key face is a base64 data uri", keyImage("<svg/>").startsWith("data:image/svg+xml;base64,"), true);
check("the markup survives the round trip", decode(keyImage("<svg/>")), "<svg/>");

const filled = decode(keyImage(slotBadge({ slotIndex: 2, preview: "hello there", pasteMode: "direct" })));
check("a filled slot names its number", filled.includes("SLOT 2"), true);
check("a filled slot shows its text", filled.includes("hello there"), true);
check("paste mode is marked on the key", filled.includes("PASTE"), true);
check("restore mode is marked differently", decode(keyImage(slotBadge({ slotIndex: 1, preview: "x", pasteMode: "restore" }))).includes("COPY"), true);
check("a configured name replaces the slot header", decode(keyImage(slotBadge({ slotIndex: 1, label: "Email", preview: "x", pasteMode: "plain" }))).includes("Email"), true);
check("plain text paste is marked on the key", decode(keyImage(slotBadge({ slotIndex: 1, preview: "x", pasteMode: "plain" }))).includes("PLAIN"), true);

for (const reason of ["pick", "cold", "short"] as const) {
	const empty = decode(keyImage(emptySlotBadge({ slotIndex: reason === "pick" ? 0 : 3, reason })));
	check(`the ${reason} state draws a real face`, empty.startsWith("<svg") && empty.length > 200, true);
}

// A copied XML snippet or an ampersand in a URL would otherwise produce markup the
// renderer silently refuses, leaving the key blank.
check("angle brackets in a copy are escaped", escapeXml("<b>&"), "&lt;b&gt;&amp;");
check("a copied tag does not break the face", decode(keyImage(slotBadge({ slotIndex: 1, preview: "<script>", pasteMode: "direct" }))).includes("&lt;script&gt;"), true);

// Wrapping is greedy per line, so a URL with no spaces still has to break somewhere.
const wrapped = decode(keyImage(slotBadge({ slotIndex: 1, preview: previewText("https://example.com/a/very/long/path", 45), pasteMode: "direct" })));
check("an unbroken url still wraps onto lines", (wrapped.match(/<text/g) ?? []).length > 2, true);

// An email is the single most copied thing there is, and a fixed-column cut lands in the
// middle of the domain. The break belongs on the punctuation.
const mail = decode(keyImage(slotBadge({ slotIndex: 1, preview: "hello@packrat.studio", pasteMode: "direct" })));
check("an email breaks on punctuation, not mid-word", mail.includes(">hello@packrat.<"), true);
check("the rest of the domain stays whole", mail.includes(">studio<"), true);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
