import test from "node:test";
import assert from "node:assert/strict";
import { renderKey, stateToken, severity } from "../src/render.js";

test("all setup/error states are explicit and unitless", () => {
  for(const state of ["not_running","sensors_inactive","shared_memory_disabled","shared_memory_expired","shared_memory_unavailable","incompatible"]){
    const token=stateToken({state});
    assert.ok(token.primary.length>0);
    const uri=renderKey({state:"unavailable",label:"HWiNFO",valueText:token.primary,unit:"°C",secondary:token.secondary,points:[],severity:"warning"},{},72);
    const svg=decodeURIComponent(uri.split(",")[1]);
    assert.ok(svg.includes(token.primary));
    assert.ok(!svg.includes("°C"));
  }
});
test("renderer is scale-aware at 36 72 144", () => {
  for(const size of [36,72,144]){
    const uri=renderKey({state:"ready",label:"GPU TEMPERATURE VERY LONG",valueText:"83.4",unit:"°C",secondary:"MIN 30.0 · MAX 95.0",points:[[1,50],[2,70],[3,83]],severity:"warning"},{accent:"#2BE86A"},size);
    const svg=decodeURIComponent(uri.split(",")[1]);
    assert.ok(svg.includes('width="'+size+'"'));
    assert.ok(svg.includes("viewBox"));
  }
});
test("threshold severity handles above and below", () => {
  assert.equal(severity(95,{warningThreshold:80,criticalThreshold:90,thresholdDirection:"above"}),"critical");
  assert.equal(severity(85,{warningThreshold:80,criticalThreshold:90,thresholdDirection:"above"}),"warning");
  assert.equal(severity(10,{warningThreshold:20,criticalThreshold:10,thresholdDirection:"below"}),"critical");
});
