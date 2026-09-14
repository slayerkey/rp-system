import { setTimeout as delay } from "node:timers/promises";
import crypto from "node:crypto";
import streamDeck, { action, SingletonAction } from "@elgato/streamdeck";
import { TextExpanderLibrary } from "./library.mjs";
import {
  analyzeTemplateFields, counterNames, renderSnippet, chooseInsertionMode, resolveSnippetSelection
} from "./core.mjs";
import { renderSnippetKey, renderFallbackKeySvg, BUILTIN_SNIPPET_IDS } from "./key-visuals.mjs";
import { LocalUiServer } from "./server.mjs";
import { getWindowsContext, getClipboardText, focusWindow, insertText } from "./windows.mjs";
import { EDITION, ACTIONS, VERIFIED_PRO_URL } from "./edition.mjs";

const library = new TextExpanderLibrary({ edition: EDITION });
const visible = new Map();
let insertionQueue = Promise.resolve();

const ui = await new LocalUiServer({
  edition: EDITION,
  library,
  onLibraryChanged: async () => {
    await refreshVisibleKeys();
    try { await sendSnippetList({ status:"Library updated." }); } catch {}
  }
}).start();

function enqueue(work) {
  const next = insertionQueue.then(work, work);
  insertionQueue = next.catch(() => {});
  return next;
}

function svgData(svg) {
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

async function currentContext(content) {
  const target = await getWindowsContext();
  const clipboard = String(content).includes("{clipboard}") ? await getClipboardText() : "";
  return { target, clipboard };
}

async function performInsert({ snippet, settings, fields = {}, captured }) {
  const latest = await library.load();
  const counts = counterNames(snippet.content);

  return library.withNextCounters(counts, async counters => {
    const rendered = renderSnippet(snippet.content, {
      edition: EDITION,
      now: new Date(),
      clipboard: captured.clipboard,
      username: captured.target.username || "",
      computer: captured.target.computer || "",
      app: captured.target.app || "",
      variables: latest.variables || {},
      fields,
      counters
    });

    if (captured.refocus) {
      const focused = await focusWindow(captured.target.hwnd);
      if (!focused) throw new Error("Could not restore the target application.");
      await delay(90);
    }

    const mode = chooseInsertionMode(settings.insertionMode || "auto", rendered.text);
    return insertText({
      text: rendered.text,
      mode,
      cursorBack: rendered.cursorBack,
      afterInsert: EDITION === "pro" ? (settings.afterInsert || "none") : "none"
    });
  });
}

async function loadSnippetSelection(settings = {}) {
  const current = await library.load();
  return resolveSnippetSelection(current.snippets, settings);
}

async function renderInsertRecord(record) {
  if (!record?.action?.isKey?.()) return;
  const selection = await loadSnippetSelection(record.settings);
  if (selection.changed) {
    record.settings = selection.settings;
    await record.action.setSettings(selection.settings).catch(error => {
      streamDeck.logger.warn("Could not repair stale Text Expander snippet selection.", error);
    });
  }
  await record.action.setTitle("");
  await record.action.setImage(
    selection.snippet ? renderSnippetKey(selection.snippet) : svgData(renderFallbackKeySvg("insert", "SNIPPET"))
  );
}

async function renderLibraryRecord(record) {
  if (!record?.action?.isKey?.()) return;
  await record.action.setTitle("");
  await record.action.setImage(svgData(renderFallbackKeySvg("library", "LIBRARY")));
}

async function renderRecord(record) {
  if (record?.kind === "manage") return renderLibraryRecord(record);
  return renderInsertRecord(record);
}

async function refreshVisibleKeys() {
  await Promise.allSettled([...visible.values()].map(renderRecord));
}

async function insertAction(ev) {
  let settings = ev.payload?.settings && typeof ev.payload.settings === "object"
    ? ev.payload.settings
    : await ev.action.getSettings();

  const selection = await loadSnippetSelection(settings);
  const snippet = selection.snippet;
  if (!snippet) {
    await ev.action.showAlert();
    return;
  }
  if (selection.changed) {
    settings = selection.settings;
    await ev.action.setSettings(settings).catch(error => {
      streamDeck.logger.warn("Could not persist repaired Text Expander snippet selection.", error);
    });
  }

  const latest = await library.load();
  const captured = await currentContext(snippet.content);
  captured.refocus = false;
  const fields = analyzeTemplateFields(snippet.content, {
    edition: EDITION,
    variables: latest.variables || {}
  });

  if (EDITION === "pro" && fields.length) {
    captured.refocus = true;
    const actionInstance = ev.action;
    const url = ui.createTemplate({
      fields,
      name: snippet.name,
      onSubmit: values => enqueue(async () => {
        try {
          const result = await performInsert({ snippet, settings, fields: values, captured });
          if (result.clipboardRestored === false) {
            streamDeck.logger.warn("Text inserted, but Windows did not allow the previous clipboard state to be restored.");
            await actionInstance.showAlert();
          } else {
            await actionInstance.showOk();
          }
        } catch (error) {
          streamDeck.logger.error("Template insertion failed.", error);
          try { await actionInstance.showAlert(); } catch {}
          throw error;
        }
      })
    });
    await streamDeck.system.openUrl(url);
    return;
  }

  await enqueue(async () => {
    try {
      const result = await performInsert({ snippet, settings, captured });
      if (result.clipboardRestored === false) {
        streamDeck.logger.warn("Text inserted, but Windows did not allow the previous clipboard state to be restored.");
        await ev.action.showAlert();
      } else {
        await ev.action.showOk();
      }
    } catch (error) {
      streamDeck.logger.error("Text insertion failed.", error);
      await ev.action.showAlert();
    }
  });
}

async function sendSnippetList(extra = {}) {
  const current = await library.load();
  const ids = new Set(current.snippets.map(item => item.id));
  const selectedId = String(extra.selectedId || "");
  const selectedSnippet = selectedId
    ? current.snippets.find(item => item.id === selectedId) || null
    : null;
  await streamDeck.ui.sendToPropertyInspector({
    type: "snippetList",
    edition: EDITION,
    // Keep the high-cardinality list lightweight. Snippet content is loaded
    // only for the one item being edited so a 5,000-snippet Pro library cannot
    // flood the Property Inspector WebSocket with megabytes of text.
    snippets: current.snippets.map(({ id, name, folder }) => ({ id, name, folder })),
    selectedSnippet: selectedSnippet
      ? { id:selectedSnippet.id, name:selectedSnippet.name, folder:selectedSnippet.folder, content:selectedSnippet.content }
      : null,
    builtinIds: BUILTIN_SNIPPET_IDS.filter(id => ids.has(id)),
    verifiedProUrl: VERIFIED_PRO_URL || "",
    upgradeReasons: [
      "more snippets",
      "folders",
      "advanced dynamic variables",
      "fill-in templates",
      "counters",
      "app-aware behavior"
    ],
    ...extra
  });
}

async function sendSnippetDetail(id) {
  const current = await library.load();
  const snippet = current.snippets.find(item => item.id === String(id || "")) || null;
  await streamDeck.ui.sendToPropertyInspector({
    type:"snippetDetail",
    snippet:snippet
      ? { id:snippet.id, name:snippet.name, folder:snippet.folder, content:snippet.content }
      : null
  });
}

async function saveSnippetFromInspector(payload) {
  const current = await library.load();
  const raw = payload?.snippet && typeof payload.snippet === "object" ? payload.snippet : {};
  const requestedId = String(raw.id || "").trim();
  const id = requestedId || `snippet-${crypto.randomUUID()}`;
  const snippet = {
    id,
    name: String(raw.name || "").trim(),
    folder: EDITION === "pro" ? (String(raw.folder || "").trim() || "QUICK") : "STARTER",
    content: String(raw.content ?? "")
  };
  if (!snippet.name) throw new Error("Give the snippet a name before saving.");

  const snippets = [...current.snippets];
  const index = snippets.findIndex(item => item.id === id);
  if (index >= 0) snippets[index] = snippet;
  else snippets.push(snippet);

  await library.replace({ ...current, snippets });
  await refreshVisibleKeys();
  await sendSnippetList({ selectedId:id, status:"Saved locally." });
}

async function deleteSnippetFromInspector(payload) {
  const current = await library.load();
  const id = String(payload?.snippetId || "").trim();
  if (!id) throw new Error("Choose a snippet to delete.");
  const snippets = current.snippets.filter(item => item.id !== id);
  if (snippets.length === current.snippets.length) throw new Error("Snippet was not found.");

  await library.replace({ ...current, snippets });
  await refreshVisibleKeys();
  await sendSnippetList({ selectedId:snippets[0]?.id || "", status:"Deleted." });
}

async function handlePropertyMessage(ev) {
  const payload = ev?.payload || {};
  try {
    if (payload.type === "listSnippets") return sendSnippetList({ selectedId:String(payload.selectedId || "") });
    if (payload.type === "getSnippet") return sendSnippetDetail(payload.snippetId);
    if (payload.type === "saveSnippet") return saveSnippetFromInspector(payload);
    if (payload.type === "deleteSnippet") return deleteSnippetFromInspector(payload);
    if (payload.type === "openManager") return streamDeck.system.openUrl(ui.managerUrl());
  } catch (error) {
    streamDeck.logger.error("Text Expander Property Inspector request failed.", error);
    await streamDeck.ui.sendToPropertyInspector({
      type:"snippetError",
      message:String(error?.message || "Could not update snippets.")
    });
  }
}

class InsertSnippetAction extends SingletonAction {
  async onWillAppear(ev) {
    const id = String(ev.action?.id || "");
    if (!id) return;
    const record = {
      id,
      kind:"insert",
      action:ev.action,
      settings:ev.payload?.settings || {}
    };
    visible.set(id, record);
    await renderRecord(record);
  }

  onWillDisappear(ev) {
    visible.delete(String(ev.action?.id || ""));
  }

  async onDidReceiveSettings(ev) {
    const id = String(ev.action?.id || "");
    const record = visible.get(id);
    if (!record) return;
    record.settings = ev.payload?.settings || {};
    await renderRecord(record);
  }

  async onKeyDown(ev) {
    await insertAction(ev);
  }
}

class ManageSnippetsAction extends SingletonAction {
  async onWillAppear(ev) {
    const id = String(ev.action?.id || "");
    if (!id) return;
    const record = { id, kind:"manage", action:ev.action, settings:ev.payload?.settings || {} };
    visible.set(id, record);
    await renderRecord(record);
  }

  onWillDisappear(ev) {
    visible.delete(String(ev.action?.id || ""));
  }

  async onKeyDown(ev) {
    try {
      await streamDeck.system.openUrl(ui.managerUrl());
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Could not open the legacy snippet library window.", error);
      await ev.action.showAlert();
    }
  }
}

const RegisteredInsert = action({ UUID: ACTIONS.insert })(InsertSnippetAction, {});
const RegisteredManage = action({ UUID: ACTIONS.manage })(ManageSnippetsAction, {});
streamDeck.actions.registerAction(new RegisteredInsert());
streamDeck.actions.registerAction(new RegisteredManage());

streamDeck.ui.onDidAppear(() => {
  void sendSnippetList();
});
streamDeck.ui.onSendToPlugin((ev) => {
  void handlePropertyMessage(ev);
});

streamDeck.connect();
