import {mkdir,writeFile} from "node:fs/promises";import {existsSync} from "node:fs";import {tmpdir,homedir} from "node:os";import {join,resolve} from "node:path";import {spawnSync} from "node:child_process";
const SDK="8.0.425",root=resolve(import.meta.dirname,".."),project=resolve(root,"native","PackRat.AudioManagerLite.Helper","PackRat.AudioManagerLite.Helper.csproj"),output=resolve(root,"com.packrat.audio-manager-lite.sdPlugin","native","win-x64");
const run=(cmd,args,o={})=>spawnSync(cmd,args,{cwd:root,encoding:"utf8",stdio:o.capture?"pipe":"inherit",windowsHide:true,env:o.env||process.env});
const has=(cmd,env=process.env)=>{const p=run(cmd,["--list-sdks"],{capture:true,env});return !p.error&&p.status===0&&String(p.stdout||"").split(/\r?\n/).some(x=>/^8\./.test(x.trim()));};
async function dl(url,dest){const r=await fetch(url,{redirect:"follow"});if(!r.ok)throw new Error(`HTTP ${r.status}`);await writeFile(dest,Buffer.from(await r.arrayBuffer()));}
async function sdk(){
 if(has("dotnet"))return{command:"dotnet",env:process.env};
 if(process.platform!=="win32")throw new Error("No .NET 8 SDK found.");
 const base=process.env.LOCALAPPDATA||join(homedir(),"AppData","Local"),dir=join(base,"PackRat","tools","dotnet",SDK),dotnet=join(dir,"dotnet.exe"),env={...process.env,DOTNET_ROOT:dir,DOTNET_MULTILEVEL_LOOKUP:"0"};
 if(existsSync(dotnet)&&has(dotnet,env))return{command:dotnet,env};await mkdir(dir,{recursive:true});
 const installer=join(tmpdir(),"packrat-dotnet-install.ps1");await dl("https://dot.net/v1/dotnet-install.ps1",installer);
 const p=run("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File",installer,"-Version",SDK,"-InstallDir",dir,"-Architecture","x64","-NoPath"]);
 if(p.error||p.status!==0||!existsSync(dotnet)||!has(dotnet,env))throw new Error("Private .NET SDK bootstrap failed.");return{command:dotnet,env};
}
const d=await sdk();await mkdir(output,{recursive:true});const p=run(d.command,["publish",project,"-c","Release","-r","win-x64","--self-contained","true","-o",output],{env:d.env});if(p.error||p.status!==0)process.exit(1);
