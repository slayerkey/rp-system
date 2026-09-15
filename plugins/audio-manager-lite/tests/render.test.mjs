import test from "node:test";import assert from "node:assert/strict";import {renderKey} from "../src/render.js";
const decode=uri=>decodeURIComponent(uri.slice("data:image/svg+xml;charset=utf-8,".length));
test("unconfigured output key says SELECT DEVICE",()=>{const svg=decode(renderKey("set-output"));assert.match(svg,/SELECT DEVICE/);assert.ok(svg.includes("#FFB21E"));});
test("unconfigured input key uses microphone glyph",()=>{const svg=decode(renderKey("set-input"));assert.match(svg,/SELECT DEVICE/);assert.match(svg,/<rect x="60" y="20" width="24" height="45"/);});
test("configured direct keys use target name without gray role footer",()=>{const out=decode(renderKey("set-output",{device:{name:"Headphones"}}));const input=decode(renderKey("set-input",{device:{name:"USB Mic"}}));assert.match(out,/Headphones/);assert.match(input,/USB Mic/);assert.doesNotMatch(out+input,/DEFAULT OUT|DEFAULT IN|COMM OUT|COMM IN/);});
test("missing target says REBIND",()=>{assert.match(decode(renderKey("set-input",{device:{name:"Old Mic"},missing:true})),/REBIND/);});
test("offline state is explicit",()=>{const svg=decode(renderKey("set-output",{offline:true}));assert.match(svg,/AUDIO OFFLINE/);assert.ok(svg.includes("#FF5D6C"));});
