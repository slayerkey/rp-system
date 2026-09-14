import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const bridgePath = path.join(here, "..", "runtime", "win-bridge.ps1");

function run(mode, payload = {}) {
  if (process.platform !== "win32") return Promise.reject(new Error("Text Expander v1 requires Windows."));
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Sta",
      "-File", bridgePath, "-Mode", mode
    ], { windowsHide:true, stdio:["pipe","pipe","pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeout = null;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      fn(value);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => stdout += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    child.on("error", error => finish(reject, error));
    child.on("close", code => {
      if (settled) return;
      if (code !== 0) return finish(reject, new Error(stderr.trim() || `Windows bridge failed (${code}).`));
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        finish(resolve, lines.length ? JSON.parse(lines.at(-1)) : { ok:true });
      } catch (error) {
        finish(reject, new Error(`Windows bridge returned invalid JSON: ${error.message}`));
      }
    });
    timeout = setTimeout(() => {
      try { child.kill(); } catch {}
      finish(reject, new Error(`Windows bridge timed out while running ${mode}.`));
    }, 15000);
    child.stdin.end(JSON.stringify(payload));
  });
}

function b64(text) {
  return Buffer.from(String(text), "utf8").toString("base64");
}

export async function getWindowsContext() {
  return run("context");
}
export async function getClipboardText() {
  const result = await run("clipboard");
  return String(result.text ?? "");
}
export async function focusWindow(hwnd) {
  if (!hwnd) return false;
  const result = await run("focus", { hwnd:String(hwnd) });
  return Boolean(result.focused);
}
export async function insertText({ text, mode, cursorBack = 0, afterInsert = "none" }) {
  return run(mode === "clipboard" ? "paste" : "type", {
    textB64:b64(text),
    cursorBack:Number(cursorBack) || 0,
    afterInsert:["none","tab","enter"].includes(afterInsert) ? afterInsert : "none"
  });
}
