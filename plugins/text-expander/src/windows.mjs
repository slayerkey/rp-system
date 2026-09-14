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
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => stdout += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) return reject(new Error(stderr.trim() || `Windows bridge failed (${code}).`));
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        resolve(lines.length ? JSON.parse(lines.at(-1)) : { ok:true });
      } catch (error) {
        reject(new Error(`Windows bridge returned invalid JSON: ${error.message}`));
      }
    });
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
