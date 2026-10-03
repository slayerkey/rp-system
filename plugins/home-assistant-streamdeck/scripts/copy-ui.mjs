import {cp,copyFile,mkdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const folder=resolve(root,'com.packrat.home-assistant-streamdeck.sdPlugin');
const approved=resolve(root,'../../tools/art/assets/ratpack-icon-transparent.png');
try{await stat(approved)}catch{throw new Error('Approved PackRat brand mark missing. Copy the real canonical tools/art/assets/ratpack-icon-transparent.png; do not fabricate a substitute.')}
await cp(resolve(root,'ui'),resolve(folder,'ui'),{recursive:true,force:true});
await mkdir(resolve(folder,'imgs/brand'),{recursive:true});
await copyFile(approved,resolve(folder,'imgs/brand/ratpack-icon-transparent.png'));
await copyFile(approved,resolve(folder,'imgs/plugin/packrat-logo.png'));
console.log('Copied canonical Property Inspector and approved PackRat brand mark');
