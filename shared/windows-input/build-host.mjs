import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..","..");
const project=resolve(here,"PackRat.InputHost","PackRat.InputHost.csproj");
const program=resolve(here,"PackRat.InputHost","Program.cs");
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

const hash=await sourceHash();
let current="";
try{current=(await readFile(stamp,"utf8")).trim();}catch{}

if(!force&&current===hash&&await exists(exe)){
  console.log(`PackRat.InputHost is current (${hash.slice(0,12)}).`);
  process.exit(0);
}

await mkdir(output,{recursive:true});
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
const result=spawnSync("dotnet",args,{stdio:"inherit",shell:false});
if(result.error){
  throw new Error(`Could not run dotnet publish: ${result.error.message}`);
}
if(result.status!==0)process.exit(result.status??1);
if(!(await exists(exe)))throw new Error("dotnet publish did not produce PackRat.InputHost.exe.");
await writeFile(stamp,hash+"\n","utf8");
console.log(`Built PackRat.InputHost from source ${hash.slice(0,12)}.`);
