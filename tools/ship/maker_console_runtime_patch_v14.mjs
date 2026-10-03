import {patchMakerConsoleSource as patchBase} from './maker_console_runtime_patch_v13.mjs';

export function patchMakerConsoleSource(source,options) {
  source=patchBase(source,options);
  const anchor='\nfunction normalizeReleaseNotes(text) {';
  if(source.split(anchor).length!==2)throw new Error('Structured description helper anchor changed');
  const helper="\nasync function writeMarketplaceDescription(target,locator,text) {\n  if (prod.description_format !== 'structured-v1') return proseMirror(target,locator,text);\n  // Enter creates actual editor paragraphs. Sending one multi-line insertText\n  // event previously collapsed descriptions into a single rich-text block.\n  const lines=String(text || '').replace(/\\r/g,'').trim().split('\\n');\n  if (lines.filter(s=>s.startsWith('• ')).length < 3 || lines.filter(s=>s.trim()==='').length < 3) {\n    throw new Error('Structured description lacks sections or feature bullets');\n  }\n  await locator.click();\n  await target.keyboard.press('ControlOrMeta+A');\n  await target.keyboard.press('Delete');\n  for (let i=0;i<lines.length;i++) {\n    if (i>0) await target.keyboard.press('Enter');\n    if (lines[i]) await target.keyboard.insertText(lines[i]);\n  }\n  await target.waitForTimeout(550);\n  const proof=await locator.evaluate(el=>({\n    blocks:el.querySelectorAll('p,li,h1,h2,h3').length,\n    contentEditable:el.getAttribute('contenteditable')==='true',\n    text:el.innerText || el.value || ''\n  })).catch(()=>({blocks:0,contentEditable:false,text:''}));\n  const normalized=String(proof.text || '').replace(/\\s+/g,' ');\n  if (!lines.filter(s=>s.trim() && !s.startsWith('• ')).every(s=>normalized.includes(s.trim()))) {\n    throw new Error('Structured Marketplace description did not persist all sections');\n  }\n  if (proof.contentEditable && proof.blocks < 5) {\n    throw new Error('Marketplace rich text collapsed into too few blocks; refusing blob description');\n  }\n  state.descriptionProof={format:'structured-v1',blocks:proof.blocks,\n    bulletCount:lines.filter(s=>s.startsWith('• ')).length};\n  save();\n  console.log('Marketplace description saved as '+proof.blocks+' editor blocks, '+state.descriptionProof.bulletCount+' bullets');\n}\n";
  source=source.replace(anchor,helper+anchor);
  const call="await proseMirror(page,desc,readFileSync(join(KIT,'PASTE_description.txt'),'utf8').trim());";
  const after="await writeMarketplaceDescription(page,desc,readFileSync(join(KIT,'PASTE_description.txt'),'utf8').trim());";
  const found=source.split(call).length-1;
  if(found!==3)throw new Error('Structured description patch expected three call sites; got '+found);
  return source.split(call).join(after);
}
