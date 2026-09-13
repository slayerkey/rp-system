import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..","..");
const project=resolve(here,"PackRat.InputHost","PackRat.InputHost.csproj");
const output=resolve(root,"artifacts","input-host");
const exe=resolve(output,"PackRat.InputHost.exe");
const stamp=resolve(output,"source.sha256");
const force=process.argv.includes("--force");

async function exists(path){try{await stat(path);return true;}catch{return false;}}
async function sourceHash(){
  const h=createHash("sha256");
  const sourceDir=resolve(here,"PackRat.InputHost");
  const names=(await readdir(sourceDir)).filter(name=>/\.(?:cs|csproj|props|targets)$/i.test(name)).sort();
  for(const name of names){
    h.update(name);
    h.update(await readFile(resolve(sourceDir,name)));
  }
  return h.digest("hex");
}

function hasModernSdk(command){
  const probe=spawnSync(command,["--list-sdks"],{
    encoding:"utf8",
    windowsHide:true,
    shell:false
  });
  if(probe.error||probe.status!==0)return false;
  const outputText=`${probe.stdout??""}\n${probe.stderr??""}`;
  return outputText.split(/\r?\n/).some(line=>{
    const match=line.trim().match(/^(\d+)\./);
    return match&&Number(match[1])>=8;
  });
}

async function resolveDotNet(){
  if(hasModernSdk("dotnet")){
    return "dotnet";
  }

  if(process.platform!=="win32"){
    throw new Error("PackRat.InputHost requires a .NET 8+ SDK to build on this host.");
  }

  const toolsRoot=resolve(
    process.env.LOCALAPPDATA||process.env.TEMP||root,
    "PackRat","tools"
  );
  const installDir=resolve(toolsRoot,"dotnet8");
  const localDotNet=resolve(installDir,"dotnet.exe");

  if(hasModernSdk(localDotNet)){
    console.log(`Using PackRat private .NET SDK: ${localDotNet}`);
    return localDotNet;
  }

  await mkdir(installDir,{recursive:true});
  const installer=resolve(toolsRoot,"dotnet-install.ps1");
  console.log("No .NET 8+ SDK found. Installing a private PackRat .NET 8 SDK once...");
  console.log(`Install location: ${installDir}`);

  const response=await fetch("https://dot.net/v1/dotnet-install.ps1",{redirect:"follow"});
  if(!response.ok){
    throw new Error(`Could not download the official .NET installer (HTTP ${response.status}).`);
  }
  await writeFile(installer,await response.text(),"utf8");

  const systemRoot=process.env.SystemRoot||"C:\\Windows";
  const windowsPowerShell=resolve(systemRoot,"System32","WindowsPowerShell","v1.0","powershell.exe");
  const powerShell=await exists(windowsPowerShell)?windowsPowerShell:"powershell.exe";
  const install=spawnSync(powerShell,[
    "-NoProfile",
    "-ExecutionPolicy","Bypass",
    "-File",installer,
    "-Channel","8.0",
    "-Architecture","x64",
    "-InstallDir",installDir,
    "-NoPath"
  ],{
    stdio:"inherit",
    windowsHide:false,
    shell:false
  });

  if(install.error){
    throw new Error(`Could not launch the official .NET installer: ${install.error.message}`);
  }
  if(install.status!==0){
    throw new Error(`Private .NET SDK installation failed with exit code ${install.status??1}.`);
  }
  if(!hasModernSdk(localDotNet)){
    throw new Error("Private .NET SDK installation completed but no .NET 8+ SDK was detected.");
  }

  console.log("Private PackRat .NET 8 SDK is ready.");
  return localDotNet;
}

const hash=await sourceHash();
let current="";
try{current=(await readFile(stamp,"utf8")).trim();}catch{}

if(!force&&current===hash&&await exists(exe)){
  console.log(`PackRat.InputHost is current (${hash.slice(0,12)}).`);
  process.exit(0);
}

await mkdir(output,{recursive:true});
const dotnet=await resolveDotNet();
const args=[
  "publish",project,
  "-c","Release",
  "-r","win-x64",
  "--self-contained","true",
  "-p:PublishSingleFile=true",
  "-p:DebugType=None",
  "-p:DebugSymbols=false",
  "-o",output
];
const result=spawnSync(dotnet,args,{stdio:"inherit",shell:false});
if(result.error){
  throw new Error(`Could not run dotnet publish: ${result.error.message}`);
}
if(result.status!==0)process.exit(result.status??1);
if(!(await exists(exe)))throw new Error("dotnet publish did not produce PackRat.InputHost.exe.");
await writeFile(stamp,hash+"\n","utf8");
console.log(`Built PackRat.InputHost from source ${hash.slice(0,12)}.`);
console.log("The published helper is self-contained; Macro Recorder customers do not need the .NET SDK or runtime.");
