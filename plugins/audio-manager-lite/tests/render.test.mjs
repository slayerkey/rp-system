import test from "node:test";import assert from "node:assert/strict";import {renderKey} from "../src/render.js";
const decode=uri=>decodeURIComponent(uri.slice("data:image/svg+xml;charset=utf-8,".length));
test("unconfigured Lite key says SELECT DEVICE",()=>{const svg=decode(renderKey());assert.match(svg,/SELECT DEVICE/);assert.ok(svg.includes("#FFB21E"));});
test("configured Lite key uses target name without gray role footer",()=>{const svg=decode(renderKey({device:{name:"Headphones"}}));assert.match(svg,/Headphones/);assert.doesNotMatch(svg,/DEFAULT OUT|COMM OUT/);});
test("missing target says REBIND",()=>{assert.match(decode(renderKey({device:{name:"Old Headset"},missing:true})),/REBIND/);});
test("offline state is explicit",()=>{const svg=decode(renderKey({offline:true}));assert.match(svg,/AUDIO OFFLINE/);assert.ok(svg.includes("#FF5D6C"));});
