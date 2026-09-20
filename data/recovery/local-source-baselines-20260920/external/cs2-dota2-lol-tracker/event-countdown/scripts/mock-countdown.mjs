/**
 * Event Countdown is pure local date math — no server to mock. The only friction in testing is
 * that the visual states are time-gated, so this prints ready-to-paste "Date & time" values that
 * land you in each state immediately.
 *
 *   node scripts/mock-countdown.mjs
 *
 * Paste a value into the Countdown action's "Date & time" field (datetime-local) to see it.
 */
function local(offsetMs) {
	const d = new Date(Date.now() + offsetMs);
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const cases = [
	["NORMAL (calm violet)", 10 * 86400_000],
	["WARN (amber, under 24h)", 12 * 3600_000],
	["URGENT (pulsing red, under 1h)", 30 * 60_000],
	["CELEBRATE (just passed)", -30 * 60_000],
	["IDLE/RESET (passed > 24h ago)", -26 * 3600_000]
];

console.log("Paste these into the Countdown action's Date & time field to preview each state:\n");
for (const [label, off] of cases) {
	console.log(`  ${label.padEnd(34)} ${local(off)}`);
}
console.log("\n(Values are in your local timezone, matching the datetime-local picker.)");
