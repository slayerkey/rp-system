import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TextExpanderLibrary } from "../src/library.mjs";
import { LocalUiServer } from "../src/server.mjs";

async function setup({ onLibraryChanged } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "packrat-text-expander-server-"));
  const library = new TextExpanderLibrary({ edition:"pro", rootDir:root });
  const server = await new LocalUiServer({ edition:"pro", library, onLibraryChanged }).start();
  return { server, library };
}

test("local manager API is token protected", async () => {
  const { server } = await setup();
  try {
    const denied = await fetch(`http://127.0.0.1:${server.port}/api/library`);
    assert.equal(denied.status, 403);
    const allowed = await fetch(`http://127.0.0.1:${server.port}/api/library?token=${encodeURIComponent(server.token)}`);
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).edition, "pro");
  } finally {
    await new Promise(resolve => server.server.close(resolve));
  }
});

test("template cancellation is one-shot and never submits", async () => {
  const { server } = await setup();
  let submitted = 0;
  let cancelled = 0;
  try {
    const url = new URL(server.createTemplate({
      fields:["name"],
      name:"Greeting",
      onSubmit:async () => { submitted++; },
      onCancel:async () => { cancelled++; }
    }));
    const jobId = url.searchParams.get("id");
    const token = url.searchParams.get("token");
    const cancel = await fetch(`http://127.0.0.1:${server.port}/api/template/cancel?token=${encodeURIComponent(token)}`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ jobId })
    });
    assert.equal(cancel.status, 200);
    assert.equal(submitted, 0);
    assert.equal(cancelled, 1);

    const replay = await fetch(`http://127.0.0.1:${server.port}/api/template/submit?token=${encodeURIComponent(token)}`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ jobId, values:{name:"Alex"} })
    });
    assert.equal(replay.status, 404);
    assert.equal(submitted, 0);
  } finally {
    await new Promise(resolve => server.server.close(resolve));
  }
});

test("template requires every field and submits exact Unicode text once", async () => {
  const { server } = await setup();
  const received = [];
  try {
    const url = new URL(server.createTemplate({
      fields:["name","topic"],
      name:"Support",
      onSubmit:async values => { received.push(values); }
    }));
    const jobId = url.searchParams.get("id");
    const token = url.searchParams.get("token");
    const endpoint = `http://127.0.0.1:${server.port}/api/template/submit?token=${encodeURIComponent(token)}`;

    const missing = await fetch(endpoint, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ jobId, values:{name:"🙂 Alex",topic:""} })
    });
    assert.equal(missing.status, 400);
    assert.equal(received.length, 0);

    const ok = await fetch(endpoint, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ jobId, values:{name:"🙂 Alex",topic:"multiline\ntext"} })
    });
    assert.equal(ok.status, 200);
    assert.deepEqual(received, [{name:"🙂 Alex",topic:"multiline\ntext"}]);

    const replay = await fetch(endpoint, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ jobId, values:{name:"Again",topic:"Again"} })
    });
    assert.equal(replay.status, 404);
    assert.equal(received.length, 1);
  } finally {
    await new Promise(resolve => server.server.close(resolve));
  }
});


test("local manager save notifies the running plugin so visible keys and PI can refresh", async () => {
  const updates = [];
  const { server } = await setup({ onLibraryChanged: async library => updates.push(library) });
  try {
    const token = encodeURIComponent(server.token);
    const read = await fetch(`http://127.0.0.1:${server.port}/api/library?token=${token}`);
    const model = await read.json();
    model.library.snippets[0].name = "Updated Email";
    const save = await fetch(`http://127.0.0.1:${server.port}/api/library?token=${token}`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({library:model.library})
    });
    assert.equal(save.status, 200);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].snippets[0].name, "Updated Email");
  } finally {
    await new Promise(resolve => server.server.close(resolve));
  }
});
