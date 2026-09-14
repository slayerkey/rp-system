import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeTemplateFields, chooseInsertionMode, counterNames, formatDate, renderSnippet, resolveSnippetSelection
} from "../src/core.mjs";

const fixed=new Date(2026,8,12,22,16,5);
test("Lite resolves only its basic variables",()=>{
  const r=renderSnippet("{date}|{time}|{clipboard}|{app}|{{date}}",{edition:"lite",now:fixed,clipboard:"🙂 clip"});
  assert.equal(r.text,"2026-09-12|22:16|🙂 clip|{app}|{date}");
});
test("Pro resolves formatted date, local context, reusable variables, fields, and counters",()=>{
  const r=renderSnippet("{datetime:YYYY/MM/DD hh:mm A}|{app}|{username}|{computer}|{sig}|{name}|{counter:ticket}",{
    edition:"pro",now:fixed,app:"notepad",username:"user",computer:"PC",variables:{sig:"Thanks"},fields:{name:"Alex"},counters:{ticket:41}
  });
  assert.equal(r.text,"2026/09/12 10:16 PM|notepad|user|PC|Thanks|Alex|41");
});
test("Unknown Pro simple variables become fill-in fields",()=>{
  assert.deepEqual(analyzeTemplateFields("Hi {name}, {topic}. {date} {counter:x} {sig}",{edition:"pro",variables:{sig:"x"}}),["name","topic"]);
  assert.deepEqual(analyzeTemplateFields("Hi {name}",{edition:"lite"}),[]);
});
test("Counter names are deduplicated",()=>assert.deepEqual(counterNames("{counter:a} {counter:a} {counter:b}"),["a","b"]));
test("Cursor marker is removed and tracks remaining graphemes",()=>{
  const r=renderSnippet("hello {cursor}🙂x",{edition:"pro"});
  assert.equal(r.text,"hello 🙂x");assert.equal(r.cursorBack,2);
});
test("Unicode, emoji, multiline, tabs, URLs, special characters, and large snippets are not mutated",()=>{
  const text="αβ🙂\nline\thttps://example.invalid/?a=1&b=<x>\n"+("Z".repeat(50000));
  assert.equal(renderSnippet(text,{edition:"pro"}).text,text);
});
test("Auto mode uses clipboard fallback for long or structured text",()=>{
  assert.equal(chooseInsertionMode("auto","x".repeat(2048)),"unicode");
  assert.equal(chooseInsertionMode("auto","x".repeat(2049)),"clipboard");
  assert.equal(chooseInsertionMode("auto","line one\nline two"),"clipboard");
  assert.equal(chooseInsertionMode("auto","left\tright"),"clipboard");
  assert.equal(chooseInsertionMode("unicode","line one\nline two"),"unicode");
  assert.equal(chooseInsertionMode("unicode","x".repeat(9000)),"unicode");
});
test("stale or empty snippet selections repair to the first available snippet without changing other settings",()=>{
  const snippets=[{id:"email",name:"Email"},{id:"date",name:"Date"}];
  const stale=resolveSnippetSelection(snippets,{snippetId:"missing",insertionMode:"auto",afterInsert:"none"});
  assert.equal(stale.changed,true);
  assert.equal(stale.snippet.id,"email");
  assert.deepEqual(stale.settings,{snippetId:"email",insertionMode:"auto",afterInsert:"none"});

  const empty=resolveSnippetSelection(snippets,{});
  assert.equal(empty.changed,true);
  assert.equal(empty.settings.snippetId,"email");

  const valid=resolveSnippetSelection(snippets,{snippetId:"date"});
  assert.equal(valid.changed,false);
  assert.equal(valid.snippet.id,"date");

  const none=resolveSnippetSelection([],{snippetId:"missing"});
  assert.equal(none.changed,false);
  assert.equal(none.snippet,null);
});
test("date formatter supports documented tokens",()=>assert.equal(formatDate(fixed,"dddd, MMMM D YYYY HH:mm:ss"),"Saturday, September 12 2026 22:16:05"));
test("missing app context and empty reusable variables resolve safely",()=>{
  assert.equal(renderSnippet("{app}|{blank}",{edition:"pro",variables:{blank:""}}).text,"|");
});
