import test from "node:test";
import assert from "node:assert/strict";
import { PRO_SEEDS } from "../src/core.mjs";
import {
  renderSnippetKey, renderActionIconSvg, renderFallbackKeySvg, visualForSnippet
} from "../src/key-visuals.mjs";

function decodeDataUri(uri){
  const prefix="data:image/svg+xml;base64,";
  assert.ok(uri.startsWith(prefix));
  return Buffer.from(uri.slice(prefix.length),"base64").toString("utf8");
}

test("Pro QUICK starter keys render as six distinct semantic SVG visuals",()=>{
  const quick=PRO_SEEDS.filter(item=>item.folder==="QUICK");
  assert.equal(quick.length,6);
  const images=quick.map(renderSnippetKey);
  assert.equal(new Set(images).size,6);
  const svgs=images.map(decodeDataUri);
  for(const svg of svgs){
    assert.match(svg,/<svg/);
    assert.match(svg,/#080A0E/i);
    assert.doesNotMatch(svg,/M22 12h100/);
    assert.doesNotMatch(svg,/FONT_5X7|CustomImages|state0\.png/);
  }
  assert.match(svgs[0],/#FFB21E/i);
  assert.match(svgs[1],/#FFB21E/i);
  assert.match(svgs[0],/EMAIL \+/);
  assert.match(svgs[1],/CLIP \+/);
  assert.match(svgs[2],/>TIME</);
  assert.match(svgs[3],/>DATE</);
  assert.match(svgs[4],/>ADDRESS</);
  assert.match(svgs[5],/>LINK</);
});

test("built-in Text Expander snippets map to intentional semantic glyph kinds",()=>{
  assert.equal(visualForSnippet({id:"pro-quick-email"}).kind,"email-plus");
  assert.equal(visualForSnippet({id:"pro-quick-clipboard"}).kind,"clipboard-plus");
  assert.equal(visualForSnippet({id:"pro-quick-time"}).kind,"time");
  assert.equal(visualForSnippet({id:"pro-quick-date"}).kind,"date");
  assert.equal(visualForSnippet({id:"pro-quick-address"}).kind,"address");
  assert.equal(visualForSnippet({id:"pro-quick-link"}).kind,"link");
  assert.equal(visualForSnippet({id:"pro-follow-up"}).kind,"followup");
  assert.equal(visualForSnippet({id:"pro-youtube"}).kind,"video");
  assert.equal(visualForSnippet({id:"pro-code"}).kind,"code");
});

test("custom snippets infer a useful semantic glyph instead of one generic generated icon",()=>{
  assert.equal(visualForSnippet({name:"Client Email",content:"hello"}).kind,"email");
  assert.equal(visualForSnippet({name:"Deploy URL",content:"https://example.com"}).kind,"link");
  assert.equal(visualForSnippet({name:"Follow up tomorrow",content:"Ping them again"}).kind,"followup");
  assert.equal(visualForSnippet({name:"Clipboard value",content:"{clipboard}"}).kind,"clipboard");
  assert.equal(visualForSnippet({name:"Release script",content:"npm run ship"}).kind,"code");
  assert.equal(visualForSnippet({name:"Anything else",content:"plain text"}).kind,"text");
});

test("hardware keys do not use a generic decorative orange top rail",()=>{
  for(const kind of ["time","date","address","link","reply","followup","code"]){
    const svg=renderFallbackKeySvg(kind,kind.toUpperCase());
    assert.doesNotMatch(svg,/M22 12h100/);
  }
});

test("action-list and fallback art are clean SVG rather than pixel-font profile renders",()=>{
  const icon=renderActionIconSvg("insert");
  const key=renderFallbackKeySvg("library","LIBRARY");
  assert.match(icon,/stroke="#FFFFFF"/);
  assert.doesNotMatch(icon,/<text/);
  assert.match(key,/LIBRARY/);
  assert.match(key,/rx="24"/);
  assert.doesNotMatch(key,/FONT_5X7|CustomImages|state0\.png/);
});
