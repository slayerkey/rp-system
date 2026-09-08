"use strict";

function lower(value) { return String(value || "").trim().toLowerCase(); }

function evaluateHostEvidence(report = {}, bundleInfo = {}) {
  const expectedHash = lower(bundleInfo?.helper?.sha256 || bundleInfo?.helperSha256);
  const actualHash = lower(report?.helper?.sha256);
  const assemblyBacked = report?.helper?.backend === "assembly";
  const hashMatched = !!expectedHash && !!actualHash && expectedHash === actualHash;
  const targetFound = report?.target?.found === true;
  const writeRestore = report?.status === "write-and-restore-pass"
    && report?.endpointAvailable === true
    && report?.exercise?.attempted === true
    && report?.exercise?.changedVerified === true
    && report?.exercise?.restoreVerified === true;
  const pass = assemblyBacked && hashMatched && targetFound && writeRestore && !report?.error;
  const reasons = [];
  if (!assemblyBacked) reasons.push("host-test-not-using-precompiled-assembly");
  if (!hashMatched) reasons.push("helper-hash-not-matched-to-bundle");
  if (!targetFound) reasons.push("target-audio-session-not-found");
  if (!writeRestore) reasons.push("reversible-volume-write-not-proven");
  if (report?.error) reasons.push("host-report-error");
  return { pass, assemblyBacked, hashMatched, targetFound, writeRestore, reasons };
}

function evaluatePromotion(options = {}) {
  const host = evaluateHostEvidence(options.hostReport || {}, options.bundleInfo || {});
  const streamDeckHardwarePassed = options.streamDeckHardwarePassed === true;
  const productRegressionPassed = options.productRegressionPassed === true;
  const readyForV08Integration = host.pass && streamDeckHardwarePassed && productRegressionPassed;
  const blockers = [...host.reasons];
  if (!streamDeckHardwarePassed) blockers.push("physical-stream-deck-interaction-not-proven");
  if (!productRegressionPassed) blockers.push("frozen-product-regression-not-proven-after-integration");
  return {
    readyForV08Integration,
    host,
    streamDeckHardwarePassed,
    productRegressionPassed,
    blockers
  };
}

module.exports = { evaluateHostEvidence, evaluatePromotion };
