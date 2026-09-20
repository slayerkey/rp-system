/**
 * Tap versus hold. Pure timestamp pairing, no SDK and no timers. Run: npm test
 */
import assert from "node:assert/strict";

import { forgetPress, HOLD_MS, markDown, wasHeld } from "./press";

// markDown stamps Date.now(), so each case measures against a real start.

const tapStart = Date.now();
markDown("tap");
assert.equal(wasHeld("tap", tapStart + 100), false, "a quick tap is a tap");

const holdStart = Date.now();
markDown("hold");
assert.equal(wasHeld("hold", holdStart + HOLD_MS + 50), true, "holding past the threshold opens the page");

const edgeStart = Date.now();
markDown("edge");
assert.equal(wasHeld("edge", edgeStart + HOLD_MS), true, "the threshold itself counts as a hold");

// The timestamp is consumed, so a key up with no matching key down never inherits an old press.
markDown("once");
wasHeld("once");
assert.equal(wasHeld("once"), false, "a second key up after one key down is not a hold");
assert.equal(wasHeld("never-pressed"), false, "a key up with no key down at all is a tap, not a hold");

// A key removed mid-press leaves nothing behind for the next key to pick up.
markDown("gone");
forgetPress("gone");
assert.equal(wasHeld("gone"), false);

// Presses are tracked per key, so two keys held at once do not interfere.
const bothStart = Date.now();
markDown("left");
markDown("right");
assert.equal(wasHeld("left", bothStart + 50), false);
assert.equal(wasHeld("right", bothStart + HOLD_MS + 50), true, "the other key's release is unaffected");

console.log("press.test.ts: all assertions passed");
