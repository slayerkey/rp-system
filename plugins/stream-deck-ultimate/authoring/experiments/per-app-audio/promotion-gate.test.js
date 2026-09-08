"use strict";
const assert = require("assert");
const { evaluateHostEvidence, evaluatePromotion } = require("./promotion-gate.js");

function goodReport(hash = "abc123") {
  return {
    schema: 1,
    helper: { backend: "assembly", file: "PackRatAppAudio.dll", sha256: hash },
    endpointAvailable: true,
    target: { found: true, process: "Spotify", pids: [202] },
    exercise: { attempted: true, changedVerified: true, restoreVerified: true },
    status: "write-and-restore-pass",
    error: null
  };
}

(() => {
  const bundle = { helper: { sha256: "ABC123" } };
  const host = evaluateHostEvidence(goodReport(), bundle);
  assert.equal(host.pass, true);
  assert.equal(host.hashMatched, true);
  assert.equal(host.writeRestore, true);
  assert.deepEqual(host.reasons, []);

  // CI / read-only evidence is deliberately insufficient for promotion.
  const readOnly = goodReport();
  readOnly.status = "read-only-pass";
  readOnly.exercise = null;
  const ro = evaluateHostEvidence(readOnly, bundle);
  assert.equal(ro.pass, false);
  assert(ro.reasons.includes("reversible-volume-write-not-proven"));

  // A successful write using a different helper binary is also insufficient.
  const mismatched = evaluateHostEvidence(goodReport("different"), bundle);
  assert.equal(mismatched.pass, false);
  assert(mismatched.reasons.includes("helper-hash-not-matched-to-bundle"));

  // Host proof alone does not authorize integration.
  let promotion = evaluatePromotion({ hostReport: goodReport(), bundleInfo: bundle });
  assert.equal(promotion.readyForV08Integration, false);
  assert(promotion.blockers.includes("physical-stream-deck-interaction-not-proven"));
  assert(promotion.blockers.includes("frozen-product-regression-not-proven-after-integration"));

  promotion = evaluatePromotion({
    hostReport: goodReport(), bundleInfo: bundle,
    streamDeckHardwarePassed: true,
    productRegressionPassed: true
  });
  assert.equal(promotion.readyForV08Integration, true);
  assert.deepEqual(promotion.blockers, []);

  const noAssembly = goodReport();
  noAssembly.helper.backend = "source";
  assert.equal(evaluateHostEvidence(noAssembly, bundle).pass, false);

  console.log("v0.8 App Volume promotion gate passed: CI/read-only is insufficient; requires hash-matched reversible host write, physical Stream Deck proof, and frozen-product regression");
})();
