import test from "node:test";
import assert from "node:assert/strict";
import { BoundedHistory } from "../src/history.js";

test("rapid histories stay bounded", () => {
  const h=new BoundedHistory({rawMax:32,archiveMax:16,archiveMs:1000});
  for(let i=0;i<10000;i++)h.push(1_700_000_000_000+i*10,Math.sin(i/10)*100);
  assert.ok(h.raw.length<=32);
  assert.ok(h.archive.length<=16);
});
test("history accepts extreme finite values and rejects missing", () => {
  const h=new BoundedHistory();
  assert.equal(h.push(1, null),false);
  assert.equal(h.push(2, undefined),false);
  assert.equal(h.push(3, ""),false);
  assert.equal(h.push(4, Number.POSITIVE_INFINITY),false);
  assert.equal(h.push(5, -1e200),true);
  assert.equal(h.latest(),-1e200);
});
