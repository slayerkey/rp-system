import { setTimeout as delay } from "node:timers/promises";
import crypto from "node:crypto";
import streamDeck, { action, SingletonAction } from "@elgato/streamdeck";
import { TextExpanderLibrary } from "./library.mjs";
import {
  analyzeTemplateFields, counterNames, renderSnippet, chooseInsertionMode
} from "./core.mjs";
import { LocalUiServer } from "./server.mjs";
import { getWindowsContext, getClipboardText, focusWindow, insertText } from "./windows.mjs";
import { EDITION, ACTIONS, VERIFIED_PRO_URL } from "./edition.mjs";

const library = new TextExpanderLibrary({ edition: EDITION });
const ui = await new LocalUiServer({ edition: EDITION, library }).start();
let insertionQueue = Promise.resolve();

function enqueue(work) {
  const next = insertionQueue.then(work, work);
  insertionQueue = next.catch(() => {});
  return next;
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

async function insertAction(ev) {
  const settings = ev.payload?.settings && typeof ev.payload.settings === "object"
    ? ev.payload.settings
    : await ev.action.getSettings();

  const snippet = await library.getSnippet(String(settings.snippetId || ""));
  if (!snippet) {
    await ev.action.showAlert();
    return;
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

async function sendSnippetList(ev, extra = {}) {
  const current = await library.load();
  await ev.action.sendToPropertyInspector({
    type: "snippetList",
    edition: EDITION,
    snippets: current.snippets.map(({ id, name, folder, content }) => ({ id, name, folder, content })),
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

async function saveSnippetFromInspector(ev) {
  const current = await library.load();
  const raw = ev.payload?.snippet && typeof ev.payload.snippet === "object" ? ev.payload.snippet : {};
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
  await sendSnippetList(ev, { selectedId:id, status:"Saved locally." });
}

async function deleteSnippetFromInspector(ev) {
  const current = await library.load();
  const id = String(ev.payload?.snippetId || "").trim();
  if (!id) throw new Error("Choose a snippet to delete.");
  const snippets = current.snippets.filter(item => item.id !== id);
  if (snippets.length === current.snippets.length) throw new Error("Snippet was not found.");
  await library.replace({ ...current, snippets });
  await sendSnippetList(ev, { selectedId:snippets[0]?.id || "", status:"Deleted." });
}

async function handlePropertyMessage(ev) {
  try {
    if (ev.payload?.type === "listSnippets") return sendSnippetList(ev);
    if (ev.payload?.type === "saveSnippet") return saveSnippetFromInspector(ev);
    if (ev.payload?.type === "deleteSnippet") return deleteSnippetFromInspector(ev);
    if (ev.payload?.type === "openManager") return streamDeck.system.openUrl(ui.managerUrl());
  } catch (error) {
    streamDeck.logger.error("Text Expander Property Inspector request failed.", error);
    await ev.action.sendToPropertyInspector({
      type:"snippetError",
      message:String(error?.message || "Could not update snippets.")
    });
  }
}

class InsertSnippetAction extends SingletonAction {
  async onKeyDown(ev) {
    await insertAction(ev);
  }
  async onSendToPlugin(ev) {
    await handlePropertyMessage(ev);
  }
  async onPropertyInspectorDidAppear(ev) {
    await sendSnippetList(ev);
  }
}

class ManageSnippetsAction extends SingletonAction {
  async onKeyDown(ev) {
    try {
      await streamDeck.system.openUrl(ui.managerUrl());
      await ev.action.showOk();
    } catch (error) {
      streamDeck.logger.error("Could not open the legacy snippet library window.", error);
      await ev.action.showAlert();
    }
  }
  async onSendToPlugin(ev) {
    await handlePropertyMessage(ev);
  }
  async onPropertyInspectorDidAppear(ev) {
    await sendSnippetList(ev);
  }
}

const RegisteredInsert = action({ UUID: ACTIONS.insert })(InsertSnippetAction, {});
const RegisteredManage = action({ UUID: ACTIONS.manage })(ManageSnippetsAction, {});

streamDeck.actions.registerAction(new RegisteredInsert());
streamDeck.actions.registerAction(new RegisteredManage());
streamDeck.connect();
