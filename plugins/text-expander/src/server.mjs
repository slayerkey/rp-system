import http from "node:http";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LITE_LIMIT, PRO_LIMIT } from "./core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const managerPath = path.join(here, "..", "ui", "manager.html");

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type":"application/json; charset=utf-8",
    "Content-Length":Buffer.byteLength(body),
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer"
  });
  res.end(body);
}
function html(res, status, body) {
  res.writeHead(status, {
    "Content-Type":"text/html; charset=utf-8",
    "Content-Length":Buffer.byteLength(body),
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer",
    "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
  res.end(body);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));
}
async function bodyJson(req, maxBytes = 16 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
function templateDocument(job, token) {
  const fields = job.fields.map(name => `
    <label><span>${escapeHtml(name)}</span><textarea name="${escapeHtml(name)}" rows="3" required autocomplete="off"></textarea></label>`
  ).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fill Text Template</title><style>
body{font:15px system-ui;background:#111;color:#f5f5f5;margin:0;padding:28px}.card{max-width:720px;margin:auto;background:#1c1c1c;border:1px solid #333;border-radius:16px;padding:24px}
h1{margin-top:0}label{display:block;margin:16px 0}label span{display:block;font-weight:700;margin-bottom:6px}textarea{width:100%;box-sizing:border-box;background:#0d0d0d;color:#fff;border:1px solid #444;border-radius:8px;padding:10px;resize:vertical}
.row{display:flex;gap:10px;margin-top:20px}button{border:0;border-radius:9px;padding:10px 16px;font-weight:700;cursor:pointer}.primary{background:#fff;color:#111}.secondary{background:#333;color:#fff}.status{min-height:22px;color:#bbb}
</style></head><body><main class="card"><h1>Fill template</h1><p>Complete the required fields, then Text Expander will return focus to the app you were using and insert the finished text.</p>
<form id="form">${fields}<div class="row"><button class="primary" type="submit">Insert</button><button class="secondary" id="cancel" type="button">Cancel</button></div><p class="status" id="status"></p></form>
<script>
const token=${JSON.stringify(token)}, jobId=${JSON.stringify(job.id)};
const status=document.getElementById("status");
document.getElementById("form").addEventListener("submit",async e=>{e.preventDefault();status.textContent="Inserting…";const values={};for(const el of new FormData(e.currentTarget).entries())values[el[0]]=el[1];const r=await fetch("/api/template/submit?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId,values})});const data=await r.json();status.textContent=data.ok?"Inserted. You can close this tab.":(data.error||"Could not insert.");if(data.ok)e.currentTarget.querySelectorAll("textarea,button").forEach(x=>x.disabled=true)});
document.getElementById("cancel").addEventListener("click",async()=>{await fetch("/api/template/cancel?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId})});status.textContent="Cancelled. Nothing was inserted.";document.querySelectorAll("textarea,button").forEach(x=>x.disabled=true)});
</script></main></body></html>`;
}

export class LocalUiServer {
  constructor({ edition, library } = {}) {
    this.edition = edition;
    this.library = library;
    this.token = crypto.randomBytes(24).toString("base64url");
    this.jobs = new Map();
    this.server = null;
    this.port = null;
  }
  async start() {
    if (this.server) return this;
    this.server = http.createServer((req,res) => this.#handle(req,res).catch(error => json(res,500,{ok:false,error:error.message})));
    await new Promise((resolve,reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", reject);
        resolve();
      });
    });
    this.port = this.server.address().port;
    return this;
  }
  managerUrl() {
    return `http://127.0.0.1:${this.port}/manage?token=${encodeURIComponent(this.token)}`;
  }
  createTemplate({ fields, name, onSubmit, onCancel }) {
    const id = crypto.randomUUID();
    const job = { id, fields:[...fields], name:String(name || "Template"), onSubmit, onCancel, createdAt:Date.now() };
    this.jobs.set(id, job);
    setTimeout(() => {
      const existing = this.jobs.get(id);
      if (existing && Date.now() - existing.createdAt >= 10 * 60 * 1000) {
        this.jobs.delete(id);
        existing.onCancel?.("expired");
      }
    }, 10 * 60 * 1000 + 1000).unref?.();
    return `http://127.0.0.1:${this.port}/template?id=${encodeURIComponent(id)}&token=${encodeURIComponent(this.token)}`;
  }
  async #handle(req,res) {
    const url = new URL(req.url || "/", `http://127.0.0.1:${this.port}`);
    if (url.searchParams.get("token") !== this.token) return json(res,403,{ok:false,error:"Forbidden"});
    if (req.method === "GET" && url.pathname === "/manage") {
      return html(res,200,await fs.readFile(managerPath,"utf8"));
    }
    if (req.method === "GET" && url.pathname === "/api/library") {
      const library = await this.library.load();
      return json(res,200,{
        ok:true, edition:this.edition, limit:this.edition === "pro" ? PRO_LIMIT : LITE_LIMIT,
        library,
        upgradeReasons:["more snippets","folders","advanced dynamic variables","fill-in templates","counters","app-aware behavior"]
      });
    }
    if (req.method === "POST" && url.pathname === "/api/library") {
      const incoming = await bodyJson(req);
      const library = await this.library.replace(incoming.library);
      return json(res,200,{ok:true,library});
    }
    if (req.method === "GET" && url.pathname === "/template") {
      const job = this.jobs.get(url.searchParams.get("id"));
      if (!job) return html(res,404,"<!doctype html><title>Template expired</title><p>This template request expired or was already used.</p>");
      return html(res,200,templateDocument(job,this.token));
    }
    if (req.method === "POST" && url.pathname === "/api/template/submit") {
      const payload = await bodyJson(req, 4 * 1024 * 1024);
      const job = this.jobs.get(String(payload.jobId || ""));
      if (!job) return json(res,404,{ok:false,error:"Template request expired."});
      const values = {};
      for (const field of job.fields) {
        const value = String(payload.values?.[field] ?? "");
        if (!value.trim()) return json(res,400,{ok:false,error:`${field} is required.`});
        values[field] = value;
      }
      this.jobs.delete(job.id);
      await job.onSubmit(values);
      return json(res,200,{ok:true});
    }
    if (req.method === "POST" && url.pathname === "/api/template/cancel") {
      const payload = await bodyJson(req, 128 * 1024);
      const job = this.jobs.get(String(payload.jobId || ""));
      if (job) {
        this.jobs.delete(job.id);
        await job.onCancel?.("cancelled");
      }
      return json(res,200,{ok:true});
    }
    return json(res,404,{ok:false,error:"Not found"});
  }
}
